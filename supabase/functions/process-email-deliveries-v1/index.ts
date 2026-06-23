import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { isAuthorizedCronRequest } from '../_shared/systemAuth.ts';
import { encodeCrockfordBase32 } from '../_shared/inboundRouting.ts';

// Cron authentication uses the Vault-backed SYSTEM_INVOCATION_SECRET through
// isAuthorizedCronRequest; direct service-role recovery remains supported.

const APP_URL=(Deno.env.get('APP_BASE_URL')||'https://compliance.tracer2c.com').replace(/\/$/,'');
const RETRY_MINUTES=[1,5,30,120];
function esc(value:unknown){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]!));}
function hex(bytes:ArrayBuffer){return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function inboundReplyAddress(admin:ReturnType<typeof createClient>,delivery:{id:string;buyer_id:string;supplier_id:string;recipient_email:string},requestIds:string[]){
  const now=new Date().toISOString();
  const [{data:flag},{data:override}]=await Promise.all([
    admin.from('feature_flags').select('default_enabled').eq('key','email_reply_ingestion_v1').maybeSingle(),
    admin.from('organization_feature_flags').select('enabled,expires_at').eq('organization_id',delivery.buyer_id).eq('organization_type','buyer').eq('feature_key','email_reply_ingestion_v1').maybeSingle(),
  ]);
  const enabled=override&&(!override.expires_at||override.expires_at>now)?override.enabled===true:flag?.default_enabled===true;
  if(!enabled)return null;
  const secret=Deno.env.get('INBOUND_ROUTING_SECRET');const domain=Deno.env.get('INBOUND_EMAIL_DOMAIN');
  if(!secret||!domain)throw new Error('Inbound routing is enabled but routing secrets are not configured');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`delivery:${delivery.id}`)));
  const token=encodeCrockfordBase32(signed.slice(0,16));
  const tokenHash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
  const expiresAt=new Date(Date.now()+180*86400000).toISOString();const graceUntil=new Date(Date.now()+210*86400000).toISOString();
  await admin.from('inbound_routing_tokens').update({status:'superseded',superseded_at:now,expires_at:now,grace_until:new Date(Date.now()+30*86400000).toISOString(),updated_at:now})
    .eq('buyer_id',delivery.buyer_id).eq('supplier_id',delivery.supplier_id).eq('recipient_email',delivery.recipient_email).eq('status','active').overlaps('request_ids',requestIds).neq('delivery_id',delivery.id);
  const {error}=await admin.from('inbound_routing_tokens').upsert({token_hash:tokenHash,delivery_id:delivery.id,buyer_id:delivery.buyer_id,supplier_id:delivery.supplier_id,recipient_email:delivery.recipient_email,request_ids:requestIds,status:'active',expires_at:expiresAt,grace_until:graceUntil,updated_at:now},{onConflict:'delivery_id'});
  if(error)throw error;
  return `reply+r2c-${token}@${domain.toLowerCase().replace(/^@/,'')}`;
}

Deno.serve(async(req)=>{
  const context=createRequestContext(req);const preflight=handleCorsPreflightRequest(req);if(preflight)return preflight;
  const admin=createClient(requireEnv('SUPABASE_URL'),getSupabaseSecretKey(),{auth:{persistSession:false,autoRefreshToken:false}});
  if(!(await isAuthorizedCronRequest(req,admin)))return jsonResponse(context,{error:'Unauthorized'},401);
  const resendKey=Deno.env.get('RESEND_API_KEY');if(!resendKey)return jsonResponse(context,{error:'RESEND_API_KEY not configured'},503);
  let sent=0,retried=0,failed=0,canceled=0;
  try{
    const {data:claimed,error:claimError}=await admin.rpc('claim_email_deliveries_v1',{p_batch_size:25});if(claimError)throw claimError;
    for(const delivery of claimed||[]){
      try{
        const {data:links,error:linkError}=await admin.from('email_delivery_requests').select('request_id,purpose,document_requests(id,title,public_reference,due_date,status,buyer_id,supplier_id)').eq('delivery_id',delivery.id);if(linkError||!links?.length)throw new Error('Delivery has no request');
        const requests=links.map((l)=>Array.isArray(l.document_requests)?l.document_requests[0]:l.document_requests).filter(Boolean);
        if(!requests.length||requests.some((r)=>r.buyer_id!==delivery.buyer_id||r.supplier_id!==delivery.supplier_id))throw new Error('Delivery request ownership mismatch');
        if(requests.every((r)=>!['pending','rejected'].includes(r.status))){await admin.from('email_deliveries').update({status:'canceled',error_code:'request_resolved',updated_at:new Date().toISOString()}).eq('id',delivery.id);canceled++;continue;}
        const mandatory=['document_correction_required','intake_clarification_required'].includes(delivery.message_type);
        const {data:suppression}=await admin.from('email_recipient_suppressions').select('reason').eq('normalized_email',delivery.recipient_email).is('released_at',null).maybeSingle();
        if(suppression){await admin.from('email_deliveries').update({status:'suppressed',error_code:`recipient_${suppression.reason}`,updated_at:new Date().toISOString()}).eq('id',delivery.id);continue;}
        const {data:settings}=await admin.from('supplier_notification_settings').select('enabled,new_request_email_enabled').eq('supplier_id',delivery.supplier_id).maybeSingle();
        if(!mandatory&&(settings?.enabled===false||settings?.new_request_email_enabled===false)){await admin.from('email_deliveries').update({status:'suppressed',error_code:'supplier_email_disabled',updated_at:new Date().toISOString()}).eq('id',delivery.id);continue;}
        const {data:buyer}=await admin.from('buyers').select('company_name').eq('id',delivery.buyer_id).single();
        const active=requests.filter((r)=>['pending','rejected'].includes(r.status));
        const list=active.map((r)=>`<li><strong>${esc(r.title)}</strong>${r.due_date?` — due ${esc(r.due_date)}`:''} — <a href="${APP_URL}/supplier/requests/${r.id}">open request</a></li>`).join('');
        const metadata=delivery.metadata&&typeof delivery.metadata==='object'?delivery.metadata:{};
        const correction=delivery.message_type==='document_correction_required'||delivery.message_type==='intake_clarification_required';
        const html=correction
          ?`<p>Hi ${esc(delivery.recipient_name||'Supplier team')},</p><p>${esc(buyer?.company_name||'A buyer')} requires a corrected compliance document.</p><div style="border-left:4px solid #dc2626;padding:12px 16px;background:#fef2f2"><strong>Reason:</strong> ${esc(metadata.reason_notes||'Correction required')}</div><ul>${list}</ul><p>Reply to this email with the corrected document, or upload it securely through TraceR2C.</p><p>TraceR2C</p>`
          :`<p>Hi ${esc(delivery.recipient_name||'Supplier team')},</p><p>${esc(buyer?.company_name||'A buyer')} is requesting compliance evidence:</p><ul>${list}</ul><p>Reply with the requested document, or upload securely through TraceR2C.</p><p>TraceR2C</p>`;
        const text=correction
          ?`${buyer?.company_name||'A buyer'} requires a corrected document. Reason: ${String(metadata.reason_notes||'Correction required')}\n${active.map((r)=>`${r.title}: ${APP_URL}/supplier/requests/${r.id}`).join('\n')}\nReply with the corrected document or use the secure links above.`
          :`${buyer?.company_name||'A buyer'} requested: ${active.map((r)=>`${r.title}: ${APP_URL}/supplier/requests/${r.id}`).join('\n')}\nReply with the requested document or use the secure links above.`;
        const replyTo=await inboundReplyAddress(admin,delivery,active.map((r)=>r.id));
        const reference=active[0]?.public_reference;const subject=reference&&!String(delivery.subject).includes(`[${reference}]`)?`[${reference}] ${delivery.subject}`:delivery.subject;
        const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':delivery.idempotency_key},body:JSON.stringify({from:'TraceR2C <notifications@tracer2c.com>',to:[delivery.recipient_email],reply_to:replyTo||undefined,subject,html,text,tags:[{name:'message_type',value:delivery.message_type},{name:'delivery_id',value:delivery.id}]})});
        const result=await response.json();
        if(response.ok&&result.id){await admin.from('email_deliveries').update({status:'provider_accepted',provider_message_id:result.id,provider_accepted_at:new Date().toISOString(),next_attempt_at:null,error_code:null,error_message:null,updated_at:new Date().toISOString()}).eq('id',delivery.id);sent++;continue;}
        const retryable=response.status===429||response.status>=500;
        if(retryable&&delivery.attempt_count<=RETRY_MINUTES.length){const next=new Date(Date.now()+RETRY_MINUTES[delivery.attempt_count-1]*60000).toISOString();await admin.from('email_deliveries').update({status:'queued',next_attempt_at:next,error_code:`resend_${response.status}`,error_message:String(result?.message||'Retryable Resend failure').slice(0,1000),updated_at:new Date().toISOString()}).eq('id',delivery.id);retried++;}
        else{await admin.from('email_deliveries').update({status:'failed',failed_at:new Date().toISOString(),error_code:`resend_${response.status}`,error_message:String(result?.message||'Resend rejected email').slice(0,1000),updated_at:new Date().toISOString()}).eq('id',delivery.id);failed++;}
      }catch(error){
        if(delivery.attempt_count<=RETRY_MINUTES.length){const next=new Date(Date.now()+RETRY_MINUTES[Math.max(0,delivery.attempt_count-1)]*60000).toISOString();await admin.from('email_deliveries').update({status:'queued',next_attempt_at:next,error_code:'processor_error',error_message:error instanceof Error?error.message:String(error),updated_at:new Date().toISOString()}).eq('id',delivery.id);retried++;}
        else{await admin.from('email_deliveries').update({status:'failed',failed_at:new Date().toISOString(),error_code:'processor_exhausted',error_message:error instanceof Error?error.message:String(error),updated_at:new Date().toISOString()}).eq('id',delivery.id);failed++;}
      }
    }
    logEvent('info','email_deliveries_processed',context,{sent,retried,failed,canceled});return jsonResponse(context,{sent,retried,failed,canceled});
  }catch(error){logEvent('error','email_delivery_processor_failed',context,{error:error instanceof Error?error.message:String(error)});return jsonResponse(context,{error:error instanceof Error?error.message:'Delivery processing failed'},500);}
});
