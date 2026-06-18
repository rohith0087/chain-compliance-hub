import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { isServiceRoleRequest } from '../_shared/systemAuth.ts';
import {
  EVIDENCE_EXTRACTION_MODEL_VERSION,
  parseEvidenceExtractionResponse,
  toEvidenceClaimInput,
} from '../_shared/evidence/contracts.ts';

type SupabaseAdmin = ReturnType<typeof createClient>;

const BATCH_SIZE = 5;
const FEATURE_KEY = 'structured_evidence_v1';

interface EvidenceJob {
  id: string;
  document_upload_id: string;
  buyer_id: string;
  supplier_id: string;
  attempts: number;
  max_attempts: number;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32_768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

function detectMimeType(filePath: string, providedMime?: string | null): string {
  const ext = filePath.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return providedMime || 'application/octet-stream';
  }
}

async function isFeatureEnabled(admin: SupabaseAdmin, buyerId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const [{ data: catalog }, { data: override }] = await Promise.all([
    admin.from('feature_flags').select('default_enabled').eq('key', FEATURE_KEY).maybeSingle(),
    admin.from('organization_feature_flags').select('enabled, expires_at')
      .eq('organization_id', buyerId).eq('organization_type', 'buyer')
      .eq('feature_key', FEATURE_KEY).maybeSingle(),
  ]);
  if (override && (!override.expires_at || override.expires_at > now)) return override.enabled === true;
  return catalog?.default_enabled === true;
}

const EXTRACTION_PROMPT = `You are extracting structured compliance evidence from a certificate or compliance document.

Respond with a single JSON object with exactly these keys:
{
  "issuer": string or null,
  "certificate_number": string or null,
  "issue_date": "YYYY-MM-DD" or null,
  "expiry_date": "YYYY-MM-DD" or null,
  "standards": array of strings (e.g. ["ISO 9001", "HACCP"]),
  "covered_products": array of strings naming products/product categories the document covers,
  "covered_facilities": array of strings naming facilities/locations the document covers,
  "source_page": integer page number where the key data was found, or null,
  "source_text": a short verbatim quote (under 300 characters) from the document supporting the extraction, or null,
  "confidence": number between 0 and 1 reflecting how confident you are in this extraction
}

Only use information explicitly present in the document. Use null/empty arrays for anything not found. Do not guess dates or numbers.`;

async function extractEvidence(openAiApiKey: string, base64Data: string, mimeType: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}`, detail: 'high' } },
        ],
      }],
      max_tokens: 1200,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  }
  const result = await response.json();
  const raw = result.choices?.[0]?.message?.content;
  if (typeof raw !== 'string') throw new Error('OpenAI response had no content');
  return parseEvidenceExtractionResponse(raw);
}

async function processJob(admin: SupabaseAdmin, openAiApiKey: string, job: EvidenceJob): Promise<'succeeded' | 'skipped' | 'failed'> {
  if (!(await isFeatureEnabled(admin, job.buyer_id))) {
    await admin.from('evidence_extraction_jobs').update({
      status: 'skipped', completed_at: new Date().toISOString(),
    }).eq('id', job.id);
    return 'skipped';
  }

  const { data: upload, error: uploadError } = await admin.from('document_uploads')
    .select('file_path, mime_type').eq('id', job.document_upload_id).maybeSingle();
  if (uploadError || !upload) throw new Error(`document_uploads row not found: ${uploadError?.message ?? job.document_upload_id}`);

  const { data: fileData, error: downloadError } = await admin.storage
    .from('compliance-documents').download(upload.file_path);
  if (downloadError || !fileData) throw new Error(`Failed to download file: ${downloadError?.message}`);

  const base64Data = arrayBufferToBase64(await fileData.arrayBuffer());
  const mimeType = detectMimeType(upload.file_path, upload.mime_type);

  const extracted = await extractEvidence(openAiApiKey, base64Data, mimeType);
  const claimInput = toEvidenceClaimInput(extracted);

  const { error: recordError } = await admin.rpc('record_evidence_claim_v1', {
    p_job_id: job.id,
    p_claim: claimInput,
  });
  if (recordError) throw new Error(`record_evidence_claim_v1 failed: ${recordError.message}`);

  await admin.from('evidence_extraction_jobs').update({
    status: 'succeeded', completed_at: new Date().toISOString(),
  }).eq('id', job.id);
  return 'succeeded';
}

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });
  if (!isServiceRoleRequest(req)) return jsonResponse(context, { error: 'Service role required' }, 403);

  const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const openAiApiKey = requireEnv('OPENAI_API_KEY');

  const summary = { processed: 0, succeeded: 0, skipped: 0, failed: 0, dead_letter: 0 };

  try {
    const { data: jobs, error: claimError } = await admin.rpc('claim_evidence_extraction_jobs_v1', {
      p_batch_size: BATCH_SIZE,
    });
    if (claimError) throw claimError;

    for (const job of (jobs ?? []) as EvidenceJob[]) {
      summary.processed += 1;
      try {
        const outcome = await processJob(admin, openAiApiKey, job);
        if (outcome === 'succeeded') summary.succeeded += 1;
        if (outcome === 'skipped') summary.skipped += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const attempts = job.attempts + 1;
        if (attempts >= job.max_attempts) {
          summary.dead_letter += 1;
          await admin.from('evidence_extraction_jobs').update({
            status: 'dead_letter', attempts, last_error: message, completed_at: new Date().toISOString(),
          }).eq('id', job.id);
        } else {
          summary.failed += 1;
          const backoffMinutes = attempts * attempts;
          await admin.from('evidence_extraction_jobs').update({
            status: 'pending', attempts, last_error: message,
            scheduled_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
          }).eq('id', job.id);
        }
        logEvent('error', 'evidence_extraction_job_failed', context, {
          job_id: job.id, attempts, error: message,
        });
      }
    }

    logEvent('info', 'evidence_extraction_batch_completed', context, summary);
    return jsonResponse(context, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('error', 'evidence_extraction_batch_failed', context, { error: message });
    return jsonResponse(context, { error: 'Evidence extraction batch failed', correlation_id: context.correlationId }, 500);
  }
});
