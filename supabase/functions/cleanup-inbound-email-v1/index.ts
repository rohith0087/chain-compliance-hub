import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey,requireEnv } from '../_shared/env.ts';
import { createRequestContext,jsonResponse,logEvent } from '../_shared/requestContext.ts';
import { isAuthorizedCronRequest } from '../_shared/systemAuth.ts';

// isAuthorizedCronRequest validates the Vault-backed SYSTEM_INVOCATION_SECRET
// (or a direct service-role recovery invocation) before cleanup runs.

type Admin=ReturnType<typeof createClient>;
type Message={id:string;candidate_buyer_id:string|null;status:string;processed_at:string|null;created_at:string;raw_storage_path:string|null;legal_hold:boolean;content_purged_at:string|null};
type Attachment={id:string;message_id:string;review_status:string;scan_status:string;quarantine_storage_path:string|null;legal_hold:boolean;content_purged_at:string|null;created_at:string};

async function retentionDays(admin:Admin,buyerId:string|null,status:string,reviewStatus?:string){
  if(!buyerId)return 30;
  const {data}=await admin.from('inbound_retention_policies').select('accepted_days,rejected_clean_days,unknown_or_malicious_days').eq('buyer_id',buyerId).maybeSingle();
  if(status==='accepted'||reviewStatus==='accepted'||reviewStatus==='reassigned')return data?.accepted_days??2555;
  if(status==='quarantined'||reviewStatus==='malicious')return data?.unknown_or_malicious_days??30;
  return data?.rejected_clean_days??90;
}
async function openAlert(admin:Admin,key:string,severity:'warning'|'critical',details:Record<string,unknown>){
  await admin.from('inbound_operational_alerts').upsert({alert_key:key,severity,status:'open',details,last_seen_at:new Date().toISOString()},{onConflict:'alert_key,status'});
}

Deno.serve(async(req)=>{
  const context=createRequestContext(req);const preflight=handleCorsPreflightRequest(req);if(preflight)return preflight;
  const admin=createClient(requireEnv('SUPABASE_URL'),getSupabaseSecretKey(),{auth:{persistSession:false,autoRefreshToken:false}});
  if(!(await isAuthorizedCronRequest(req,admin)))return jsonResponse(context,{error:'Unauthorized'},401);
  let purgedAttachments=0,purgedMessages=0;
  try{
    const {data:messages,error:messageError}=await admin.from('inbound_email_messages').select('id,candidate_buyer_id,status,processed_at,created_at,raw_storage_path,legal_hold,content_purged_at').eq('legal_hold',false).is('content_purged_at',null).limit(100);
    if(messageError)throw messageError;const messageMap=new Map((messages||[]).map((message:Message)=>[message.id,message]));
    const ids=[...messageMap.keys()];
    if(ids.length){
      const {data:attachments,error:attachmentError}=await admin.from('inbound_email_attachments').select('id,message_id,review_status,scan_status,quarantine_storage_path,legal_hold,content_purged_at,created_at').in('message_id',ids).eq('legal_hold',false).is('content_purged_at',null);
      if(attachmentError)throw attachmentError;
      for(const attachment of (attachments||[]) as Attachment[]){
        const message=messageMap.get(attachment.message_id);if(!message)continue;
        const days=await retentionDays(admin,message.candidate_buyer_id,message.status,attachment.review_status);
        const basis=new Date(message.processed_at||attachment.created_at).getTime();if(Date.now()-basis<days*86400000)continue;
        if(attachment.quarantine_storage_path){const removed=await admin.storage.from('inbound-email-quarantine').remove([attachment.quarantine_storage_path]);if(removed.error)throw removed.error;}
        await admin.from('inbound_email_attachments').update({content_purged_at:new Date().toISOString(),quarantine_storage_path:null,updated_at:new Date().toISOString()}).eq('id',attachment.id);purgedAttachments++;
      }
      for(const message of messageMap.values()){
        const days=await retentionDays(admin,message.candidate_buyer_id,message.status);const basis=new Date(message.processed_at||message.created_at).getTime();if(Date.now()-basis<days*86400000)continue;
        const {count}=await admin.from('inbound_email_attachments').select('id',{count:'exact',head:true}).eq('message_id',message.id).is('content_purged_at',null);if((count||0)>0)continue;
        if(message.raw_storage_path){const removed=await admin.storage.from('inbound-email-provenance').remove([message.raw_storage_path]);if(removed.error)throw removed.error;}
        await admin.from('inbound_email_messages').update({content_purged_at:new Date().toISOString(),raw_storage_path:null,text_body:null,sanitized_html:null,updated_at:new Date().toISOString()}).eq('id',message.id);purgedMessages++;
      }
    }
    const [{count:dead},{count:stale},{count:scanFailures},{count:lateCorrections}]=await Promise.all([
      admin.from('inbound_processing_jobs').select('id',{count:'exact',head:true}).eq('status','dead_letter'),
      admin.from('inbound_processing_jobs').select('id',{count:'exact',head:true}).in('status',['pending','processing','retry']).lt('created_at',new Date(Date.now()-600000).toISOString()),
      admin.from('inbound_email_attachments').select('id',{count:'exact',head:true}).eq('scan_status','failed').gt('created_at',new Date(Date.now()-900000).toISOString()),
      admin.from('email_deliveries').select('id',{count:'exact',head:true}).eq('message_type','document_correction_required').in('status',['queued','processing','provider_accepted','delivery_delayed']).lt('created_at',new Date(Date.now()-900000).toISOString()),
    ]);
    if(dead)await openAlert(admin,'inbound-dead-letters','critical',{count:dead});if(stale)await openAlert(admin,'inbound-stale-jobs','critical',{count:stale});if(scanFailures)await openAlert(admin,'inbound-scan-failures','warning',{count:scanFailures});if(lateCorrections)await openAlert(admin,'late-correction-deliveries','warning',{count:lateCorrections});
    logEvent('info','inbound_retention_completed',context,{purgedAttachments,purgedMessages,dead,stale,scanFailures,lateCorrections});
    return jsonResponse(context,{purged_attachments:purgedAttachments,purged_messages:purgedMessages,alerts:{dead,stale,scan_failures:scanFailures,late_corrections:lateCorrections}});
  }catch(error){logEvent('error','inbound_retention_failed',context,{error:error instanceof Error?error.message:String(error)});return jsonResponse(context,{error:error instanceof Error?error.message:'Cleanup failed'},500);}
});
