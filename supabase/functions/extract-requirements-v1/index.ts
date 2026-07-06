import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { z } from 'zod';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { hasBuyerAccess } from '../_shared/requirements/applicability.ts';
import { aiComplete, resolveAiConfig } from '../_shared/ai/complete.ts';
import { extractTextFromStorage } from '../_shared/ai/extractText.ts';

// Phase 5B (final_output.md §8.3): AI reads a customer spec / standard and
// drafts structured compliance requirements. AI proposes, a human reviews each
// draft. Nothing here becomes a live requirement without human promotion.
// Source text can be pasted directly or extracted from an uploaded document.

const requestSchema = z.object({
  buyer_id: z.string().uuid(),
  source_name: z.string().min(1).max(200),
  text: z.string().min(40).max(40000).optional(),
  storage_bucket: z.string().max(100).optional(),
  storage_path: z.string().max(500).optional(),
  mime_type: z.string().max(150).nullable().optional(),
}).strict().refine((v) => (v.text?.length ?? 0) >= 40 || Boolean(v.storage_path), {
  message: 'Provide pasted text or an uploaded document',
});

const draftSchema = z.object({
  requirement_statement: z.string().min(4).max(600),
  suggested_document_type: z.string().max(100).nullable().optional(),
  suggested_evidence_name: z.string().max(200).nullable().optional(),
  responsible_party: z.enum(['supplier', 'internal']).nullable().optional(),
  rationale: z.string().max(600).nullable().optional(),
  source_quote: z.string().max(600).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});
const resultSchema = z.object({ requirements: z.array(draftSchema).max(40) });

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
    const input = parsed.data;

    const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.slice('Bearer '.length));
    if (authError || !user) return jsonResponse(context, { error: 'Invalid authentication' }, 401);
    if (!(await hasBuyerAccess(admin, user.id, input.buyer_id))) {
      return jsonResponse(context, { error: 'Buyer access required' }, 403);
    }

    const aiConfig = await resolveAiConfig(admin, input.buyer_id);
    if (!aiConfig) return jsonResponse(context, { error: 'AI is not configured — set a provider key in Settings → Integrations → AI' }, 503);
    const modelLabel = `${aiConfig.provider}:${aiConfig.model}`;

    // Resolve the source text: pasted text, or extracted from an uploaded doc.
    let sourceText = input.text ?? '';
    if (!sourceText && input.storage_path) {
      sourceText = await extractTextFromStorage(
        admin, input.storage_bucket ?? 'compliance-documents', input.storage_path, input.mime_type ?? null);
      if (sourceText.trim().length < 40) {
        return jsonResponse(context, { error: 'Could not read enough text from that document. It may be a scanned image — paste the text instead.' }, 422);
      }
    }

    const systemPrompt = `You extract discrete, supplier-facing compliance requirements from a standard, customer specification, or policy document. Rules: split compound clauses into one obligation each; only include genuine obligations ("shall/must/is required"), not background or definitions; never invent obligations not supported by the text; for each, propose the evidence a supplier would submit to prove it. Respond with strict JSON: {"requirements":[{"requirement_statement":"one clear obligation","suggested_document_type":"snake_case type e.g. food_safety_certificate","suggested_evidence_name":"human name of the document","responsible_party":"supplier"|"internal","rationale":"why this is a requirement","source_quote":"the clause text it came from","confidence":0..1}]}. Return at most 40, highest-value first.`;

    const raw = await aiComplete(aiConfig, {
      system: systemPrompt,
      user: `Source: ${input.source_name}\n\n${sourceText}`,
      jsonMode: true,
      maxTokens: 3000,
    });
    const extracted = resultSchema.parse(JSON.parse(raw));

    const rows = extracted.requirements.map((r) => ({
      buyer_id: input.buyer_id,
      source_name: input.source_name,
      requirement_statement: r.requirement_statement,
      suggested_document_type: r.suggested_document_type ?? null,
      suggested_evidence_name: r.suggested_evidence_name ?? null,
      responsible_party: r.responsible_party ?? null,
      rationale: r.rationale ?? null,
      source_quote: r.source_quote ?? null,
      ai_confidence: r.confidence ?? null,
      ai_model: modelLabel,
      created_by: user.id,
    }));

    let inserted: unknown[] = [];
    if (rows.length) {
      const { data: insertedRows, error: insertError } = await admin
        .from('requirement_extraction_drafts').insert(rows).select('id');
      if (insertError) throw insertError;
      inserted = insertedRows ?? [];
    }

    await admin.from('agent_activities').insert({
      agent_type: 'requirement_extractor', action_type: 'extract_requirements',
      entity_type: 'buyer', entity_id: input.buyer_id,
      details: { source_name: input.source_name, count: rows.length, model: modelLabel },
      success: true,
    });

    logEvent('info', 'requirements_extracted', context, {
      actor_id: user.id, buyer_id: input.buyer_id, count: rows.length,
    });
    return jsonResponse(context, { extracted_count: inserted.length });
  } catch (error) {
    logEvent('error', 'requirement_extraction_failed', context, {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(context, { error: 'Requirement extraction failed' }, 500);
  }
});
