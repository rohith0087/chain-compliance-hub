import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { canonicalEvidenceErrorStatus, createCanonicalEvidenceClients } from '../_shared/canonicalEvidence/auth.ts';
import { z } from 'zod';

const inputSchema = z.object({
  buyer_id: z.string().uuid(),
  items: z.array(z.object({
    client_key: z.string().min(1).max(200),
    supplier_id: z.string().uuid(),
    document_type: z.string().min(1).max(200),
    subject_type: z.enum(['supplier', 'facility', 'product']).default('supplier'),
    subject_id: z.string().uuid().nullable().optional(),
    jurisdiction: z.string().max(100).nullable().optional(),
    required_standards: z.array(z.string().max(200)).default([]),
    minimum_validity_days: z.number().int().min(0).max(3650).optional(),
  })).min(1).max(500),
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
    const { data, error } = await client.rpc('preflight_document_requests_v1', {
      p_buyer_id: parsed.data.buyer_id,
      p_items: parsed.data.items,
    });
    if (error) throw error;
    logEvent('info', 'document_request_preflight_completed', context, { actor_id: user.id, item_count: parsed.data.items.length });
    return jsonResponse(context, { results: data });
  } catch (error) {
    logEvent('error', 'document_request_preflight_failed', context, { error: error instanceof Error ? error.message : String(error) });
    return jsonResponse(context, { error: error instanceof Error ? error.message : 'Preflight failed' }, canonicalEvidenceErrorStatus(error));
  }
});
