import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { isAuthorizedCronRequest } from '../_shared/systemAuth.ts';
import {
  EVIDENCE_EXTRACTION_MODEL_VERSION,
  parseEvidenceExtractionResponse,
  toEvidenceClaimInput,
} from '../_shared/evidence/contracts.ts';
import { buildEvidenceInputContent } from '../_shared/evidence/openAiInput.ts';
import { sha256Hex } from '../_shared/canonicalEvidence/hash.ts';

// Cron calls are authenticated with the Vault-backed SYSTEM_INVOCATION_SECRET
// through isAuthorizedCronRequest; direct service-role recovery remains valid.

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

async function isFeatureEnabled(admin: SupabaseAdmin, organizationId: string, featureKey = FEATURE_KEY, organizationType = 'buyer'): Promise<boolean> {
  const now = new Date().toISOString();
  const [{ data: catalog }, { data: override }] = await Promise.all([
    admin.from('feature_flags').select('default_enabled').eq('key', featureKey).maybeSingle(),
    admin.from('organization_feature_flags').select('enabled, expires_at')
      .eq('organization_id', organizationId).eq('organization_type', organizationType)
      .eq('feature_key', featureKey).maybeSingle(),
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

async function extractEvidence(
  openAiApiKey: string,
  base64Data: string,
  mimeType: string,
  filename: string,
) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: buildEvidenceInputContent(
          EXTRACTION_PROMPT,
          base64Data,
          mimeType,
          filename,
        ),
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
      status: 'skipped', last_error: null, completed_at: new Date().toISOString(),
    }).eq('id', job.id);
    return 'skipped';
  }

  const { data: upload, error: uploadError } = await admin.from('document_uploads')
    .select('file_path, file_name, document_name, mime_type, document_requests(document_type)')
    .eq('id', job.document_upload_id).maybeSingle();
  if (uploadError || !upload) throw new Error(`document_uploads row not found: ${uploadError?.message ?? job.document_upload_id}`);

  const { data: fileData, error: downloadError } = await admin.storage
    .from('compliance-documents').download(upload.file_path);
  if (downloadError || !fileData) throw new Error(`Failed to download file: ${downloadError?.message}`);

  const fileBuffer = await fileData.arrayBuffer();
  const base64Data = arrayBufferToBase64(fileBuffer);
  const mimeType = detectMimeType(upload.file_path, upload.mime_type);

  const filename = upload.file_path.split('/').pop() || 'evidence-document';
  const extracted = await extractEvidence(openAiApiKey, base64Data, mimeType, filename);
  const claimInput = toEvidenceClaimInput(extracted);

  const canonicalEnabled = await isFeatureEnabled(admin, job.buyer_id, 'canonical_evidence_v1');
  if (canonicalEnabled) {
    const contentSha256 = await sha256Hex(new Blob([fileBuffer], { type: mimeType }));
    const request = Array.isArray(upload.document_requests) ? upload.document_requests[0] : upload.document_requests;
    const { error: finalizeError } = await admin.rpc('finalize_canonical_upload_v1', {
      p_source_type: 'document_upload', p_source_id: job.document_upload_id,
      p_content_sha256: contentSha256, p_document_type: request?.document_type || 'generic_evidence',
      p_display_name: upload.document_name || upload.file_name || filename,
      p_logical_identity_key: extracted.certificate_number
        ? `${job.supplier_id}:${extracted.issuer || ''}:${extracted.certificate_number}`.toLowerCase()
        : null,
      p_fields: [],
      p_metadata: {
        issue_date: extracted.issue_date, expiry_date: extracted.expiry_date,
        standards: extracted.standards, extraction_model_version: EVIDENCE_EXTRACTION_MODEL_VERSION,
        schema_version: 1, malware_scan_status: 'not_available',
      },
    });
    if (finalizeError) throw new Error(`finalize_canonical_upload_v1 failed: ${finalizeError.message}`);
  }

  const { data: claimId, error: recordError } = await admin.rpc('record_evidence_claim_v1', {
    p_job_id: job.id,
    p_claim: claimInput,
  });
  if (recordError) throw new Error(`record_evidence_claim_v1 failed: ${recordError.message}`);
  if (canonicalEnabled && claimId) {
    const fields = [
      { field_name: 'issuer', value: extracted.issuer },
      { field_name: 'certificate_number', value: extracted.certificate_number },
      { field_name: 'issue_date', value: extracted.issue_date },
      { field_name: 'expiry_date', value: extracted.expiry_date },
      { field_name: 'standards', value: extracted.standards },
      { field_name: 'covered_products', value: extracted.covered_products },
      { field_name: 'covered_facilities', value: extracted.covered_facilities },
    ].filter(({ value }) => value !== null && (!Array.isArray(value) || value.length > 0)).map(({ field_name, value }) => ({
      field_name, value, normalized_value: value, source_page: extracted.source_page,
      source_quote: extracted.source_text, confidence: extracted.confidence,
    }));
    const { error: canonicalRecordError } = await admin.rpc('record_canonical_extraction_v1', { p_claim_id: claimId, p_fields: fields });
    if (canonicalRecordError) throw new Error(`record_canonical_extraction_v1 failed: ${canonicalRecordError.message}`);
  }

  await admin.from('evidence_extraction_jobs').update({
    status: 'succeeded', last_error: null, completed_at: new Date().toISOString(),
  }).eq('id', job.id);
  return 'succeeded';
}

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });

  const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (!(await isAuthorizedCronRequest(req, admin))) {
    return jsonResponse(context, { error: 'System authorization required' }, 403);
  }
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
