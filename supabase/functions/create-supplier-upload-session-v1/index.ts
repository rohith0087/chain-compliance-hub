import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createCanonicalEvidenceClients, canonicalEvidenceErrorStatus } from '../_shared/canonicalEvidence/auth.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { z } from 'zod';

const inputSchema = z.object({
  request_id: z.string().uuid(), idempotency_key: z.string().min(8).max(200),
  file_name: z.string().min(1).max(255), mime_type: z.string().min(1).max(150),
  file_size: z.number().int().min(1).max(10 * 1024 * 1024),
  expiration_date: z.string().date().nullable(), no_expiration: z.boolean(),
  document_name: z.string().max(300).nullable().optional(), notes: z.string().max(5000).nullable().optional(),
  linked_item_ids: z.array(z.string().uuid()).max(500).default([]),
}).superRefine((value, ctx) => {
  if (!value.no_expiration && !value.expiration_date) ctx.addIssue({ code: 'custom', message: 'Expiration date is required' });
});

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context,{ error:'Method not allowed' },405,{ Allow:'POST' });
  try {
    const parsed=inputSchema.safeParse(await req.json());
    if (!parsed.success) return jsonResponse(context,{ error:'Invalid request',details:parsed.error.flatten() },400);
    const { admin,client,user }=await createCanonicalEvidenceClients(req);
    const v=parsed.data;
    const { data,error }=await client.rpc('create_supplier_upload_session_v1',{
      p_request_id:v.request_id,p_idempotency_key:v.idempotency_key,p_file_name:v.file_name,
      p_mime_type:v.mime_type,p_file_size:v.file_size,p_expiration_date:v.expiration_date,
      p_no_expiration:v.no_expiration,p_document_name:v.document_name??null,p_notes:v.notes??null,
      p_linked_item_ids:v.linked_item_ids,
    });
    if (error) throw error;
    const session=data as { session_id:string;storage_path:string;expires_at:string };
    const signed=await admin.storage.from('compliance-documents').createSignedUploadUrl(session.storage_path,{ upsert:false });
    if (signed.error || !signed.data) {
      await admin.from('supplier_upload_sessions').update({ status:'failed',error_code:'signed_url_failed',error_message:signed.error?.message }).eq('id',session.session_id);
      throw new Error('Could not create upload URL');
    }
    logEvent('info','supplier_upload_session_created',context,{ actor_id:user.id,session_id:session.session_id,request_id:v.request_id });
    return jsonResponse(context,{ session_id:session.session_id,path:signed.data.path,token:signed.data.token,expires_at:session.expires_at },201);
  } catch (error) {
    logEvent('error','supplier_upload_session_failed',context,{ error:error instanceof Error?error.message:String(error) });
    return jsonResponse(context,{ error:error instanceof Error?error.message:'Upload session failed' },canonicalEvidenceErrorStatus(error));
  }
});
