import { Webhook } from 'npm:svix@1.42.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';

type Event={type:string;created_at:string;data:{email_id:string;[key:string]:unknown}};
function emailAddress(value:unknown){const normalized=String(value??'').trim().toLowerCase();const angle=normalized.match(/<([^<>\s]+@[^<>\s]+)>/);return(angle?.[1]||normalized).replace(/^mailto:/,'');}
function verifyEvent(raw:string,headers:Record<string,string>){
  const secrets=[Deno.env.get('RESEND_WEBHOOK_SECRET_CURRENT'),Deno.env.get('RESEND_WEBHOOK_SECRET'),Deno.env.get('RESEND_WEBHOOK_SECRET_PREVIOUS')].filter((value):value is string=>Boolean(value));
  if(!secrets.length)throw new Error('Resend webhook signing secret is not configured');
  let last:unknown;for(const secret of secrets){try{return new Webhook(secret).verify(raw,headers) as Event;}catch(error){last=error;}}
  throw last instanceof Error?last:new Error('Webhook signature verification failed');
}

Deno.serve(async(req)=>{
  const context=createRequestContext(req);if(req.method!=='POST')return jsonResponse(context,{error:'Method not allowed'},405,{Allow:'POST'});
  try{
    const raw=await req.text();
    const event=verifyEvent(raw,{
      'svix-id':req.headers.get('svix-id')||'',
      'svix-timestamp':req.headers.get('svix-timestamp')||'',
      'svix-signature':req.headers.get('svix-signature')||'',
    }) as Event;
    const eventId=req.headers.get('svix-id')!;const admin=createClient(requireEnv('SUPABASE_URL'),getSupabaseSecretKey(),{auth:{persistSession:false,autoRefreshToken:false}});
    const inserted=await admin.from('email_delivery_events').insert({provider_event_id:eventId,provider_message_id:event.data.email_id,event_type:event.type,event_at:event.created_at,payload:event}).select('id').maybeSingle();
    if(inserted.error?.code==='23505')return jsonResponse(context,{received:true,duplicate:true});if(inserted.error)throw inserted.error;
    if(event.type==='email.received'){
      const from=emailAddress(event.data.from);
      const {data:message,error:messageError}=await admin.from('inbound_email_messages').upsert({
        provider_email_id:event.data.email_id,webhook_event_id:eventId,rfc_message_id:event.data.message_id||null,
        envelope_from:String(event.data.from||''),normalized_sender:from,
        recipients:Array.isArray(event.data.to)?event.data.to:[],cc:Array.isArray(event.data.cc)?event.data.cc:[],bcc:Array.isArray(event.data.bcc)?event.data.bcc:[],
        subject:String(event.data.subject||''),status:'received',received_at:event.data.created_at||event.created_at,updated_at:new Date().toISOString(),
      },{onConflict:'provider_email_id'}).select('id').single();
      if(messageError)throw messageError;
      const {error:jobError}=await admin.from('inbound_processing_jobs').upsert({message_id:message.id,idempotency_key:`resend-inbound/${event.data.email_id}`,status:'pending',scheduled_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'message_id'});
      if(jobError)throw jobError;
      await admin.from('email_delivery_events').update({processed_at:new Date().toISOString()}).eq('id',inserted.data!.id);
      logEvent('info','resend_inbound_queued',context,{event_id:eventId,email_id:event.data.email_id,message_id:message.id});
      return jsonResponse(context,{received:true,queued:true});
    }
    const transport=!['email.opened','email.clicked'].includes(event.type);
    const patch:Record<string,unknown>={last_event_at:event.created_at,updated_at:new Date().toISOString()};
    if(transport)patch.transport_last_event_at=event.created_at;
    if(event.type==='email.sent')Object.assign(patch,{status:'provider_accepted',provider_accepted_at:event.created_at});
    else if(event.type==='email.delivered')Object.assign(patch,{status:'delivered',delivered_at:event.created_at});
    else if(event.type==='email.delivery_delayed')Object.assign(patch,{status:'delivery_delayed',delayed_at:event.created_at});
    else if(event.type==='email.bounced')Object.assign(patch,{status:'bounced',bounced_at:event.created_at,error_code:'resend_bounced',error_message:JSON.stringify(event.data.bounce||{}).slice(0,1000)});
    else if(event.type==='email.failed')Object.assign(patch,{status:'failed',failed_at:event.created_at,error_code:'resend_failed'});
    else if(event.type==='email.complained')Object.assign(patch,{status:'complained',complained_at:event.created_at});
    else if(event.type==='email.opened')Object.assign(patch,{opened_at:event.created_at});
    else if(event.type==='email.clicked')Object.assign(patch,{clicked_at:event.created_at});
    let update=admin.from('email_deliveries').update(patch).eq('provider_message_id',event.data.email_id);
    if(transport)update=update.or(`transport_last_event_at.is.null,transport_last_event_at.lte.${event.created_at}`);
    const {error:updateError}=await update;if(updateError)throw updateError;
    if(event.type==='email.bounced'||event.type==='email.complained'){
      const {data:delivery}=await admin.from('email_deliveries').select('recipient_email').eq('provider_message_id',event.data.email_id).maybeSingle();
      if(delivery?.recipient_email)await admin.from('email_recipient_suppressions').upsert({normalized_email:delivery.recipient_email,reason:event.type==='email.bounced'?'hard_bounce':'complaint',provider_event_id:eventId,suppressed_at:event.created_at,released_at:null,metadata:{provider_message_id:event.data.email_id}},{onConflict:'normalized_email'});
    }
    await admin.from('email_delivery_events').update({processed_at:new Date().toISOString()}).eq('id',inserted.data!.id);
    logEvent('info','resend_webhook_processed',context,{event_id:eventId,event_type:event.type,email_id:event.data.email_id});return jsonResponse(context,{received:true});
  }catch(error){logEvent('error','resend_webhook_rejected',context,{error:error instanceof Error?error.message:String(error)});return jsonResponse(context,{error:'Invalid webhook'},400);}
});
