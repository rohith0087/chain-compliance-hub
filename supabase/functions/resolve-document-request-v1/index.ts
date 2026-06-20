import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { canonicalEvidenceErrorStatus, createCanonicalEvidenceClients } from '../_shared/canonicalEvidence/auth.ts';
import { z } from 'zod';

const schema = z.object({ request_id: z.string().uuid(), action: z.enum(['submit_existing','upload_new_version','ask_clarification','decline_sharing','cancel_duplicate']), evidence_version_id: z.string().uuid().nullable().optional(), reason: z.string().max(2000).nullable().optional() });
Deno.serve(async (req) => {
  const context = createRequestContext(req); const preflight = handleCorsPreflightRequest(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });
  try {
    const parsed = schema.safeParse(await req.json()); if (!parsed.success) return jsonResponse(context, { error: 'Invalid request', details: parsed.error.flatten() }, 400);
    const { client, user } = await createCanonicalEvidenceClients(req);
    const { data, error } = await client.rpc('resolve_document_request_v1', { p_request_id: parsed.data.request_id, p_action: parsed.data.action, p_evidence_version_id: parsed.data.evidence_version_id ?? null, p_reason: parsed.data.reason ?? null });
    if (error) throw error; logEvent('info', 'document_request_resolved', context, { actor_id: user.id, request_id: parsed.data.request_id, action: parsed.data.action });
    return jsonResponse(context, data);
  } catch (error) { return jsonResponse(context, { error: error instanceof Error ? error.message : 'Resolution failed' }, canonicalEvidenceErrorStatus(error)); }
});
