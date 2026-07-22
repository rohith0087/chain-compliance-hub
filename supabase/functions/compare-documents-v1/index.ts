import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { z } from 'zod';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { hasBuyerAccess } from '../_shared/requirements/applicability.ts';
import { aiComplete, resolveAiConfig } from '../_shared/ai/complete.ts';
import { extractTextFromStorage } from '../_shared/ai/extractText.ts';

// Auditor AI: read 2-4 documents and produce a grounded, structured comparison
// (summary, similarities, differences, field-by-field). Reads the real files
// (PDF/text; scanned images fall back to unreadable). Advisory only — every call
// logged to agent_activities. Buyer/auditor-scoped (no cross-tenant access).

const DOC_CHARS = 9000;

const requestSchema = z.object({
  buyer_id: z.string().uuid(),
  document_ids: z.array(z.string().uuid()).min(2).max(4),
  focus: z.string().max(500).optional(),
}).strict();

const comparisonSchema = z.object({
  summary: z.string().max(1500),
  similarities: z.array(z.string().max(400)).max(10).default([]),
  differences: z.array(z.string().max(400)).max(12).default([]),
  field_comparison: z.array(z.object({
    field: z.string().max(80),
    values: z.array(z.object({ doc: z.string().max(120), value: z.string().max(300) })).max(4),
  })).max(14).default([]),
  recommendation: z.string().max(600).default(''),
});

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse(context, { error: 'Authentication required' }, 401);

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return jsonResponse(context, { error: 'Invalid request', details: parsed.error.flatten() }, 400);
    const { buyer_id, document_ids, focus } = parsed.data;

    const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.slice('Bearer '.length));
    if (authError || !user) return jsonResponse(context, { error: 'Invalid authentication' }, 401);
    if (!(await hasBuyerAccess(admin, user.id, buyer_id))) {
      return jsonResponse(context, { error: 'Access required' }, 403);
    }

    // Fetch the selected documents (buyer-scoped) and read their content.
    const { data: docs } = await admin.from('document_uploads')
      .select('id, file_path, document_name, file_name, status, mime_type, document_requests!inner(document_type, buyer_id, supplier_id, suppliers(company_name))')
      .eq('document_requests.buyer_id', buyer_id).in('id', document_ids);
    const rows = (docs ?? []) as Array<Record<string, unknown>>;
    if (rows.length < 2) return jsonResponse(context, { error: 'Select at least two documents you have access to.' }, 400);

    const documents = [];
    for (const d of rows) {
      const dr = d.document_requests as Record<string, unknown>;
      const name = (d.document_name as string) || (d.file_name as string) || (dr?.document_type as string) || 'Document';
      let text = '';
      const filePath = d.file_path as string | null;
      if (filePath) {
        const clean = filePath.replace(/^documents\//, '');
        text = await extractTextFromStorage(admin, 'documents', clean, (d.mime_type as string | null) ?? null, DOC_CHARS);
      }
      documents.push({
        id: d.id as string, name,
        document_type: (dr?.document_type as string) ?? null,
        supplier: ((dr?.suppliers as Record<string, unknown>)?.company_name as string) ?? null,
        readable: text.trim().length > 0,
        text,
      });
    }

    const aiConfig = await resolveAiConfig(admin, buyer_id);
    if (!aiConfig) return jsonResponse(context, { error: 'AI is not configured — set a provider key in Settings → Integrations → AI' }, 503);

    const payload = JSON.stringify({
      focus: focus ?? 'General compliance comparison',
      documents: documents.map((d, i) => ({
        label: `Doc ${i + 1}: ${d.name}${d.supplier ? ` (${d.supplier})` : ''}`,
        document_type: d.document_type,
        readable: d.readable,
        content: d.readable ? d.text.slice(0, DOC_CHARS) : '(document could not be read — likely a scanned image)',
      })),
    });

    const system = `You are an audit analyst comparing compliance documents for an auditor. Read the provided documents and compare them factually. Base every point ONLY on the provided content; never invent facts. Cite which document a point refers to using its label. Respond with strict JSON:
{
  "summary": "2-4 sentence overview of how these documents relate",
  "similarities": ["point (cite Doc N)", ...],
  "differences": ["point (cite Doc N)", ...],
  "field_comparison": [ {"field": "Issuer", "values": [{"doc": "Doc 1: ...", "value": "..."}, ...]}, {"field": "Valid until", "values": [...]}, ... ],
  "recommendation": "what the auditor should note or follow up on"
}`;

    const raw = await aiComplete(aiConfig, { system, user: payload, jsonMode: true, maxTokens: 1600 });
    const comparison = comparisonSchema.parse(JSON.parse(raw));

    await admin.from('agent_activities').insert({
      agent_type: 'auditor_document_comparison', action_type: 'compare_documents',
      entity_type: 'document_comparison', reasoning: comparison.summary,
      details: { document_ids, model: `${aiConfig.provider}:${aiConfig.model}`, unreadable: documents.filter((d) => !d.readable).map((d) => d.id) },
      success: true,
    });

    logEvent('info', 'documents_compared', context, { actor_id: user.id, buyer_id, count: documents.length });
    return jsonResponse(context, {
      documents: documents.map((d) => ({ id: d.id, name: d.name, document_type: d.document_type, supplier: d.supplier, readable: d.readable })),
      ...comparison,
    });
  } catch (error) {
    logEvent('error', 'document_comparison_failed', context, { error: error instanceof Error ? error.message : String(error) });
    return jsonResponse(context, { error: 'Document comparison failed' }, 500);
  }
});
