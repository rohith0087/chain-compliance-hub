import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createCanonicalEvidenceClients,canonicalEvidenceErrorStatus } from '../_shared/canonicalEvidence/auth.ts';
import { createRequestContext,jsonResponse,logEvent } from '../_shared/requestContext.ts';
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
    return jsonResponse(context,data);
  }catch(error){
    logEvent('error','document_submission_review_failed',context,{error:error instanceof Error?error.message:String(error)});
    return jsonResponse(context,{error:error instanceof Error?error.message:'Review failed'},canonicalEvidenceErrorStatus(error));
  }
});
