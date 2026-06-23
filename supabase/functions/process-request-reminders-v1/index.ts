import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { isAuthorizedCronRequest } from '../_shared/systemAuth.ts';

// Cron authentication uses the Vault-backed SYSTEM_INVOCATION_SECRET through
// isAuthorizedCronRequest; direct service-role recovery remains supported.

type Admin=ReturnType<typeof createClient>;

function localParts(now:Date,timeZone:string){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
  return {date:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour'))};
}
function dayDiff(from:string,to:string){return Math.round((Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000);}

async function recipients(admin:Admin,supplierId:string,branchId:string|null){
  const emails=new Map<string,{email:string;name:string;role:string;profileId:string|null}>();
  const {data:supplier}=await admin.from('suppliers').select('profile_id').eq('id',supplierId).single();
  if(supplier?.profile_id){const {data:p}=await admin.from('profiles').select('id,email,full_name').eq('id',supplier.profile_id).single();if(p?.email)emails.set(p.email.toLowerCase(),{email:p.email.toLowerCase(),name:p.full_name||'Supplier team',role:'owner',profileId:p.id});}
  const query=admin.from('company_users').select('profile_id,role,branch_id,profiles(id,email,full_name)').eq('company_id',supplierId).eq('company_type','supplier').eq('status','active');
  const {data:users}=await query;
  for(const row of users||[]){const p=Array.isArray(row.profiles)?row.profiles[0]:row.profiles;if(!p?.email)continue;if(row.role==='company_admin'||(branchId&&row.branch_id===branchId))emails.set(p.email.toLowerCase(),{email:p.email.toLowerCase(),name:p.full_name||'Supplier team',role:row.role||'member',profileId:p.id});}
  return [...emails.values()];
}

Deno.serve(async(req)=>{
  const context=createRequestContext(req);const preflight=handleCorsPreflightRequest(req);if(preflight)return preflight;
  const admin=createClient(requireEnv('SUPABASE_URL'),getSupabaseSecretKey(),{auth:{persistSession:false,autoRefreshToken:false}});
  if(!(await isAuthorizedCronRequest(req,admin)))return jsonResponse(context,{error:'Unauthorized'},401);
  const now=new Date();let queued=0;
  try{
    const {data:policies,error:policyError}=await admin.from('request_reminder_policies').select('*').eq('enabled',true);if(policyError)throw policyError;
    for(const policy of policies||[]){
      const local=localParts(now,policy.timezone);const sendHour=Number(String(policy.send_time_local).slice(0,2));if(local.hour!==sendHour)continue;
      const weekday=new Date(`${local.date}T12:00:00Z`).getUTCDay();if(!policy.include_weekends&&(weekday===0||weekday===6))continue;
      const {data:requests,error}=await admin.from('document_requests').select('id,title,due_date,status,buyer_id,supplier_id,supplier_branch_id,buyers(company_name)').eq('buyer_id',policy.buyer_id).eq('status','pending').not('due_date','is',null);if(error)throw error;
      for(const request of requests||[]){
        const days=dayDiff(local.date,request.due_date);let type:string|null=null,stage:string|null=null;
        if((policy.pre_due_days||[]).includes(days)){type='pre_due_reminder';stage=`pre_due_${days}`;}
        else if(days===0&&policy.send_due_today){type='due_today';stage='due_today';}
        else if(days<0&&Math.abs(days)%policy.overdue_interval_days===0&&Math.abs(days)/policy.overdue_interval_days<=policy.max_overdue_reminders){type='overdue_reminder';stage=`overdue_${Math.abs(days)/policy.overdue_interval_days}`;}
        if(!type||!stage)continue;
        const rs=await recipients(admin,request.supplier_id,request.supplier_branch_id);
        for(const recipient of rs){
          const dedupe=`${request.id}:${recipient.email}:${type}:${stage}:v${policy.policy_version}`;const id=crypto.randomUUID();
          const subject=days<0?`Overdue: ${request.title}`:`Reminder: ${request.title} is due ${days===0?'today':`in ${days} days`}`;
          const base={id,buyer_id:request.buyer_id,supplier_id:request.supplier_id,recipient_profile_id:recipient.profileId,recipient_email:recipient.email,recipient_name:recipient.name,recipient_role:recipient.role,message_type:type,status:'queued',idempotency_key:`request-reminder/${id}`,dedupe_key:dedupe,template_key:'document_request_reminder',template_version:1,subject,metadata:{reminder_stage:stage,due_date:request.due_date}};
          const {data:delivery,error:insertError}=await admin.from('email_deliveries').insert(base).select('id').maybeSingle();if(insertError){if(insertError.code==='23505')continue;throw insertError;}queued++;
          await admin.from('email_delivery_requests').insert({delivery_id:delivery.id,request_id:request.id,purpose:type,reminder_stage:stage,policy_version:policy.policy_version});
        }
      }
    }
    logEvent('info','request_reminders_queued',context,{queued});return jsonResponse(context,{queued});
  }catch(error){logEvent('error','request_reminders_failed',context,{error:error instanceof Error?error.message:String(error)});return jsonResponse(context,{error:error instanceof Error?error.message:'Reminder processing failed'},500);}
});
