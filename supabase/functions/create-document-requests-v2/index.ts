import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { canonicalEvidenceErrorStatus, createCanonicalEvidenceClients } from '../_shared/canonicalEvidence/auth.ts';
import { z } from 'zod';

const requestSchema = z.object({
  buyer_id: z.string().uuid(), supplier_id: z.string().uuid(), title: z.string().min(1).max(300),
  document_type: z.string().min(1).max(200), description: z.string().max(5000).nullable().optional(),
  category: z.string().max(200).nullable().optional(), priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  due_date: z.string().nullable().optional(), notes: z.string().max(5000).nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(), supplier_branch_id: z.string().uuid().nullable().optional(),
  subject_type: z.enum(['supplier', 'facility', 'product']).default('supplier'), subject_id: z.string().uuid().nullable().optional(),
  jurisdiction: z.string().max(100).nullable().optional(), required_standards: z.array(z.string()).default([]),
  minimum_validity_days: z.number().int().min(0).max(3650).default(90),
  reuse_preference: z.enum(['use_existing', 'ask_supplier', 'request_new', 'cancel_duplicate', 'create']),
  request_reason_code: z.string().max(100).nullable().optional(), request_reason_notes: z.string().max(2000).nullable().optional(),
  template_sections: z.unknown().optional(), template_type: z.enum(['standard', 'custom']).optional(),
  custom_template_id: z.string().uuid().nullable().optional(), sample_file_path: z.string().nullable().optional(),
  sample_file_name: z.string().nullable().optional(), sample_file_size: z.number().int().nullable().optional(),
  sample_mime_type: z.string().nullable().optional(), sample_uploaded_by: z.string().uuid().nullable().optional(),
  sample_uploaded_at: z.string().nullable().optional(),
  idempotency_key: z.string().min(8).max(200),
});
const inputSchema = z.object({ requests: z.array(requestSchema).min(1).max(500) });

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });
  try {
    const parsed = inputSchema.safeParse(await req.json());
    if (!parsed.success) return jsonResponse(context, { error: 'Invalid request', details: parsed.error.flatten() }, 400);
    const { client, user } = await createCanonicalEvidenceClients(req);
    const { data, error } = await client.rpc('create_document_requests_v2', { p_inputs: parsed.data.requests });
    if (error) throw error;
    logEvent('info', 'document_requests_v2_created', context, { actor_id: user.id, request_count: parsed.data.requests.length });
    return jsonResponse(context, { results: data }, 201);
  } catch (error) {
    logEvent('error', 'document_requests_v2_failed', context, { error: error instanceof Error ? error.message : String(error) });
    return jsonResponse(context, { error: error instanceof Error ? error.message : 'Request creation failed' }, canonicalEvidenceErrorStatus(error));
  }
});
