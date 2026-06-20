import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabasePublishableKey, getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { isAuthorizedCronRequest } from '../_shared/systemAuth.ts';

// Cron calls are authenticated with the Vault-backed SYSTEM_INVOCATION_SECRET
// through isAuthorizedCronRequest; direct service-role recovery remains valid.

interface QueueRow { id:string; buyer_id:string; subject_type:'supplier'|'facility'|'product'; subject_id:string; attempts:number; max_attempts:number }

Deno.serve(async (req) => {
  const context=createRequestContext(req); const preflight=handleCorsPreflightRequest(req); if(preflight)return preflight;
  if(req.method!=='POST')return jsonResponse(context,{error:'Method not allowed'},405,{Allow:'POST'});
  const url=requireEnv('SUPABASE_URL');
  const admin=createClient(url,getSupabaseSecretKey(),{auth:{persistSession:false,autoRefreshToken:false}});
  if(!(await isAuthorizedCronRequest(req,admin)))return jsonResponse(context,{error:'System authorization required'},403);
  const summary={processed:0,completed:0,skipped:0,failed:0,dead_letter:0};
  try {
    const {data:rows,error:claimError}=await admin.rpc('claim_compliance_reevaluations_v1',{p_batch_size:20}); if(claimError)throw claimError;
    for(const row of (rows||[]) as QueueRow[]){summary.processed+=1;try{
      const {data:latest,error:latestError}=await admin.from('compliance_evaluations').select('input_snapshot')
        .eq('buyer_id',row.buyer_id).eq('subject_type',row.subject_type).eq('subject_id',row.subject_id).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(latestError)throw latestError;
      if(!latest?.input_snapshot){await admin.from('compliance_reevaluation_queue').update({status:'completed',completed_at:new Date().toISOString(),last_error:null}).eq('id',row.id);summary.skipped+=1;continue;}
      const snapshot=latest.input_snapshot as Record<string,unknown>;
      const body={buyer_id:row.buyer_id,subject_type:row.subject_type,subject_id:row.subject_id,effective_at:new Date().toISOString().slice(0,10),facts:snapshot.facts||{}};
      const response=await fetch(`${url}/functions/v1/evaluate-compliance-v1`,{method:'POST',headers:{
        Authorization:`Bearer ${getSupabasePublishableKey()}`,'Content-Type':'application/json','X-System-Secret':requireEnv('SYSTEM_INVOCATION_SECRET'),
        'x-idempotency-key':`reevaluation:${row.id}:${row.attempts}`,'x-correlation-id':context.correlationId,
      },body:JSON.stringify(body)});
      if(!response.ok)throw new Error(`evaluate-compliance-v1 returned ${response.status}: ${await response.text()}`);
      await admin.from('compliance_reevaluation_queue').update({status:'completed',completed_at:new Date().toISOString(),last_error:null}).eq('id',row.id);summary.completed+=1;
    }catch(error){const message=error instanceof Error?error.message:String(error);const dead=row.attempts>=row.max_attempts;
      await admin.from('compliance_reevaluation_queue').update({status:dead?'dead_letter':'pending',last_error:message,scheduled_at:new Date(Date.now()+Math.min(3600000,30000*2**row.attempts)).toISOString()}).eq('id',row.id);
      if(dead)summary.dead_letter+=1;else summary.failed+=1;logEvent('error','compliance_reevaluation_failed',context,{queue_id:row.id,error:message});}}
    return jsonResponse(context,summary);
  }catch(error){logEvent('error','compliance_reevaluation_batch_failed',context,{error:error instanceof Error?error.message:String(error)});return jsonResponse(context,{error:'Reevaluation processor failed'},500);}
});
