import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createCanonicalEvidenceClients,canonicalEvidenceErrorStatus } from '../_shared/canonicalEvidence/auth.ts';
import { createRequestContext,jsonResponse,logEvent } from '../_shared/requestContext.ts';
import { requireEnv } from '../_shared/env.ts';
import { z } from 'zod';

const reasonCode=z.enum(['approved','expired','wrong_supplier','wrong_facility','wrong_document_type','missing_pages','unreadable','scope_mismatch','signature_missing','validity_insufficient','other']);
const schema=z.object({
  request_id:z.string().uuid(),upload_id:z.string().uuid(),decision:z.enum(['approve','reject']),
  reason_code:reasonCode,reason_notes:z.string().trim().min(3).max(5000),
  idempotency_key:z.string().trim().min(16).max(200),
}).superRefine((value,ctx)=>{
  if(value.decision==='approve'&&value.reason_code!=='approved')ctx.addIssue({code:z.ZodIssueCode.custom,path:['reason_code'],message:'Approval requires the approved reason code'});
  if(value.decision==='reject'&&value.reason_code==='approved')ctx.addIssue({code:z.ZodIssueCode.custom,path:['reason_code'],message:'Rejection requires a rejection reason'});
  if(value.reason_code==='other'&&value.reason_notes.length<10)ctx.addIssue({code:z.ZodIssueCode.custom,path:['reason_notes'],message:'Other requires a detailed explanation'});
});

// Fire-and-forget Slack notification; errors here never affect the review response.
async function notifySlack(
  admin: ReturnType<typeof createCanonicalEvidenceClients extends Promise<infer T> ? () => T : never>,
  requestId: string,
  decision: 'approve' | 'reject',
  reasonCode: string,
): Promise<void> {
  try {
    // Load request details to get buyer_id, doc type, supplier name
    type RequestRow = {
      buyer_id: string;
      document_type: { name: string } | null;
      supplier: { company_name: string } | null;
    };
    const { data: req } = await (admin as any)
      .from('document_requests')
      .select('buyer_id, document_type:document_types(name), supplier:suppliers(company_name)')
      .eq('id', requestId)
      .maybeSingle<RequestRow>();

    if (!req?.buyer_id) return;

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const appUrl = Deno.env.get('APP_URL') || '';

    await fetch(`${supabaseUrl}/functions/v1/slack-notify-v1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        organization_id: req.buyer_id,
        event: decision === 'approve' ? 'document_approved' : 'document_rejected',
        data: {
          request_id: requestId,
          doc_name: req.document_type?.name ?? 'Document',
          supplier_name: req.supplier?.company_name ?? 'Supplier',
          reason: decision === 'reject' ? reasonCode : undefined,
          platform_url: appUrl ? `${appUrl}/documents` : undefined,
        },
      }),
    });
  } catch {
    // swallow — never block the review response
  }
}

Deno.serve(async(req)=>{
  const context=createRequestContext(req);const preflight=handleCorsPreflightRequest(req);if(preflight)return preflight;
  if(req.method!=='POST')return jsonResponse(context,{error:'Method not allowed'},405,{Allow:'POST'});
  try{
    const parsed=schema.safeParse(await req.json());if(!parsed.success)return jsonResponse(context,{error:'Invalid review request',details:parsed.error.flatten()},400);
    const {admin,user}=await createCanonicalEvidenceClients(req);const input=parsed.data;
    const {data,error}=await admin.rpc('review_document_submission_v2',{
      p_actor_id:user.id,p_request_id:input.request_id,p_upload_id:input.upload_id,p_decision:input.decision,
      p_reason_code:input.reason_code,p_reason_notes:input.reason_notes,p_idempotency_key:input.idempotency_key,
    });
    if(error)throw error;
    logEvent('info','document_submission_reviewed',context,{actor_id:user.id,request_id:input.request_id,upload_id:input.upload_id,decision:input.decision});
    // Fire Slack notification without awaiting — does not affect response latency
    void notifySlack(admin as any, input.request_id, input.decision, input.reason_code);
    return jsonResponse(context,data);
  }catch(error){
    logEvent('error','document_submission_review_failed',context,{error:error instanceof Error?error.message:String(error)});
    return jsonResponse(context,{error:error instanceof Error?error.message:'Review failed'},canonicalEvidenceErrorStatus(error));
  }
});
