import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { canonicalEvidenceErrorStatus, createCanonicalEvidenceClients } from '../_shared/canonicalEvidence/auth.ts';
import { z } from 'zod';

const schema = z.object({ request_id: z.string().uuid(), evidence_version_id: z.string().uuid(), corrections: z.array(z.object({ field_name: z.string().min(1), value: z.unknown(), normalized_value: z.unknown().optional(), source_page: z.number().int().positive().optional(), source_quote: z.string().optional(), source_bbox: z.record(z.unknown()).optional() })).default([]), approve: z.boolean().default(true), notes: z.string().max(5000).nullable().optional() });
Deno.serve(async (req) => {
  const context = createRequestContext(req); const preflight = handleCorsPreflightRequest(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });
  try {
    const parsed = schema.safeParse(await req.json()); if (!parsed.success) return jsonResponse(context, { error: 'Invalid request', details: parsed.error.flatten() }, 400);
    const { client, user } = await createCanonicalEvidenceClients(req);
    const { data, error } = await client.rpc('review_evidence_v2', { p_request_id: parsed.data.request_id, p_evidence_version_id: parsed.data.evidence_version_id, p_corrections: parsed.data.corrections, p_approve: parsed.data.approve, p_notes: parsed.data.notes ?? null });
    if (error) throw error; logEvent('info', 'canonical_evidence_reviewed', context, { actor_id: user.id, request_id: parsed.data.request_id });
    return jsonResponse(context, data);
  } catch (error) { return jsonResponse(context, { error: error instanceof Error ? error.message : 'Review failed' }, canonicalEvidenceErrorStatus(error)); }
});
