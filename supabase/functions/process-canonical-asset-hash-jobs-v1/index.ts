import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { sha256Hex } from '../_shared/canonicalEvidence/hash.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { isAuthorizedCronRequest } from '../_shared/systemAuth.ts';

interface HashJob { id:string; document_asset_id:string; storage_bucket:string; storage_path:string; attempts:number; max_attempts:number }

// Scheduled calls authenticate with the Vault-backed SYSTEM_INVOCATION_SECRET
// through isAuthorizedCronRequest; service-role recovery calls remain valid.

Deno.serve(async(req)=>{
  const context=createRequestContext(req);const preflight=handleCorsPreflightRequest(req);if(preflight)return preflight;
  if(req.method!=='POST')return jsonResponse(context,{error:'Method not allowed'},405,{Allow:'POST'});
  const admin=createClient(requireEnv('SUPABASE_URL'),getSupabaseSecretKey(),{auth:{persistSession:false,autoRefreshToken:false}});
  if(!(await isAuthorizedCronRequest(req,admin)))return jsonResponse(context,{error:'System authorization required'},403);
  const summary={processed:0,completed:0,merged:0,failed:0,dead_letter:0};
  try{
    const {data:jobs,error:claimError}=await admin.rpc('claim_canonical_asset_hash_jobs_v1',{p_batch_size:20});if(claimError)throw claimError;
    for(const job of (jobs||[]) as HashJob[]){summary.processed+=1;try{
      const {data:file,error:downloadError}=await admin.storage.from(job.storage_bucket).download(job.storage_path);if(downloadError||!file)throw downloadError||new Error('Storage object not found');
      const digest=await sha256Hex(file);
      const {data:retainedAssetId,error:hydrateError}=await admin.rpc('hydrate_canonical_asset_hash_v1',{p_document_asset_id:job.document_asset_id,p_content_sha256:digest});if(hydrateError)throw hydrateError;
      if(retainedAssetId!==job.document_asset_id)summary.merged+=1;
      await admin.from('canonical_asset_hash_jobs').update({status:'completed',completed_at:new Date().toISOString(),last_error:null}).eq('id',job.id);
      summary.completed+=1;
    }catch(error){const message=error instanceof Error?error.message:String(error);const dead=job.attempts>=job.max_attempts;
      await admin.from('canonical_asset_hash_jobs').update({status:dead?'dead_letter':'pending',last_error:message,scheduled_at:new Date(Date.now()+Math.min(3600000,30000*2**job.attempts)).toISOString()}).eq('id',job.id);
      if(dead)summary.dead_letter+=1;else summary.failed+=1;logEvent('error','canonical_asset_hash_failed',context,{job_id:job.id,asset_id:job.document_asset_id,error:message});}}
    return jsonResponse(context,summary);
  }catch(error){logEvent('error','canonical_asset_hash_batch_failed',context,{error:error instanceof Error?error.message:String(error)});return jsonResponse(context,{error:'Canonical asset hash processor failed'},500);}
});
