import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { canonicalEvidenceErrorStatus, createCanonicalEvidenceClients } from '../_shared/canonicalEvidence/auth.ts';
import { sha256Hex } from '../_shared/canonicalEvidence/hash.ts';
import { z } from 'zod';

const inputSchema = z.object({
  source_type: z.enum(['document_upload', 'supplier_library']), source_id: z.string().uuid(),
  document_type: z.string().min(1).max(200), display_name: z.string().min(1).max(500),
  logical_identity_key: z.string().max(500).nullable().optional(), fields: z.array(z.record(z.unknown())).default([]),
  metadata: z.record(z.unknown()).default({}),
});

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });
  try {
    const parsed = inputSchema.safeParse(await req.json());
    if (!parsed.success) return jsonResponse(context, { error: 'Invalid request', details: parsed.error.flatten() }, 400);
    const { client, user } = await createCanonicalEvidenceClients(req);
    const source = parsed.data.source_type === 'document_upload'
      ? await client.from('document_uploads').select('file_path').eq('id', parsed.data.source_id).single()
      : await client.from('supplier_document_library').select('file_path').eq('id', parsed.data.source_id).single();
    if (source.error || !source.data) throw new Error('Upload source not found or not accessible');
    const download = await client.storage.from('compliance-documents').download(source.data.file_path);
    if (download.error || !download.data) throw new Error('Document could not be downloaded');
    const contentSha256 = await sha256Hex(download.data);
    const { data, error } = await client.rpc('finalize_canonical_upload_v1', {
      p_source_type: parsed.data.source_type, p_source_id: parsed.data.source_id,
      p_content_sha256: contentSha256, p_document_type: parsed.data.document_type,
      p_display_name: parsed.data.display_name, p_logical_identity_key: parsed.data.logical_identity_key ?? null,
      p_fields: parsed.data.fields, p_metadata: parsed.data.metadata,
    });
    if (error) throw error;
    logEvent('info', 'canonical_upload_finalized', context, { actor_id: user.id, source_type: parsed.data.source_type, source_id: parsed.data.source_id });
    return jsonResponse(context, data);
  } catch (error) {
    logEvent('error', 'canonical_upload_finalize_failed', context, { error: error instanceof Error ? error.message : String(error) });
    return jsonResponse(context, { error: error instanceof Error ? error.message : 'Finalization failed' }, canonicalEvidenceErrorStatus(error));
  }
});
