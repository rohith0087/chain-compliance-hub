import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createCanonicalEvidenceClients, canonicalEvidenceErrorStatus } from '../_shared/canonicalEvidence/auth.ts';
import { sha256Hex } from '../_shared/canonicalEvidence/hash.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { z } from 'zod';

const inputSchema=z.object({ session_id:z.string().uuid() });
const allowed=new Set(['application/pdf','image/png','image/jpeg']);

function detectMime(bytes:Uint8Array):string {
  if (bytes.length>=5 && String.fromCharCode(...bytes.slice(0,5))==='%PDF-') return 'application/pdf';
  if (bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return 'image/png';
  if (bytes.length>=3 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return 'image/jpeg';
  return 'application/octet-stream';
}

async function scan(blob:Blob,sessionId:string) {
  const url=Deno.env.get('MALWARE_SCAN_URL'); const token=Deno.env.get('MALWARE_SCAN_TOKEN');
  if (!url || !token) throw new Error('Malware scanning service is not configured');
  const response=await fetch(url,{ method:'POST',headers:{ Authorization:`Bearer ${token}`,'Content-Type':blob.type||'application/octet-stream','X-Upload-Session':sessionId },body:blob,signal:AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Malware scan failed with status ${response.status}`);
  const result=await response.json();
  if (result?.status!=='clean') throw new Error(result?.status==='infected'?'Malware detected':'Malware scan did not return a clean result');
  return result;
}

Deno.serve(async(req)=>{
  const context=createRequestContext(req); const preflight=handleCorsPreflightRequest(req); if(preflight)return preflight;
  if(req.method!=='POST')return jsonResponse(context,{error:'Method not allowed'},405,{Allow:'POST'});
  let sessionId:string|undefined;
  try {
    const parsed=inputSchema.safeParse(await req.json()); if(!parsed.success)return jsonResponse(context,{error:'Invalid request'},400);
    sessionId=parsed.data.session_id;
    const {admin,client,user}=await createCanonicalEvidenceClients(req);
    const {data:session,error:sessionError}=await client.from('supplier_upload_sessions').select('id,storage_path,file_size,status').eq('id',sessionId).single();
    if(sessionError||!session)throw new Error('Upload session not found or inaccessible');
    if(session.status==='completed')return jsonResponse(context,{session_id:session.id,status:'completed',idempotent:true});
    await admin.from('supplier_upload_sessions').update({status:'verifying',updated_at:new Date().toISOString()}).eq('id',session.id);
    const downloaded=await admin.storage.from('compliance-documents').download(session.storage_path); if(downloaded.error||!downloaded.data)throw new Error('Uploaded object was not found');
    const blob=downloaded.data; const size=blob.size; if(size!==session.file_size||size<1||size>10*1024*1024)throw new Error('Uploaded file size mismatch');
    const bytes=new Uint8Array(await blob.arrayBuffer()); const mime=detectMime(bytes); if(!allowed.has(mime))throw new Error('Unsupported or mismatched file type');
    await admin.from('supplier_upload_sessions').update({status:'scanning',detected_mime_type:mime,updated_at:new Date().toISOString()}).eq('id',session.id);
    const scanResult=await scan(new Blob([bytes],{type:mime}),session.id); const sha=await sha256Hex(new Blob([bytes],{type:mime}));
    const completed=await admin.rpc('complete_supplier_upload_v1',{p_actor_id:user.id,p_session_id:session.id,p_detected_mime_type:mime,p_file_size:size,p_sha256:sha,p_scan_status:'clean',p_scan_provider:scanResult.provider??'configured_scanner',p_scan_result:scanResult});
    if(completed.error)throw completed.error;
    logEvent('info','transactional_supplier_upload_completed',context,{actor_id:user.id,session_id:session.id});
    return jsonResponse(context,completed.data,200);
  } catch(error) {
    if(sessionId) try { const {admin}=await createCanonicalEvidenceClients(req); await admin.from('supplier_upload_sessions').update({status:'failed',error_code:'finalization_failed',error_message:error instanceof Error?error.message:String(error),updated_at:new Date().toISOString()}).eq('id',sessionId).neq('status','completed'); } catch { /* preserve primary error */ }
    logEvent('error','transactional_supplier_upload_failed',context,{session_id:sessionId,error:error instanceof Error?error.message:String(error)});
    return jsonResponse(context,{error:error instanceof Error?error.message:'Upload finalization failed'},canonicalEvidenceErrorStatus(error));
  }
});
