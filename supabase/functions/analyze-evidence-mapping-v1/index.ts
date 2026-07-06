import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { z } from 'zod';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { hasBuyerAccess } from '../_shared/requirements/applicability.ts';
import { aiComplete, resolveAiConfig, type AiConfig } from '../_shared/ai/complete.ts';
import { extractTextFromStorage } from '../_shared/ai/extractText.ts';

const DOC_EXCERPT_CHARS = 12000;

// Phase 5A (final_output.md §11.6, §13): an AI second opinion on a proposed
// requirement<->evidence mapping. The deterministic matcher already decided
// eligibility; this reads the requirement + the evidence's structured facts and
// returns an explainable confidence + verdict + reasoning + concerns. It never
// changes compliance status — it only annotates the proposal for the human
// reviewer, and every call is logged to agent_activities.

const requestSchema = z.object({
  buyer_id: z.string().uuid(),
  mapping_ids: z.array(z.string().uuid()).min(1).max(25),
}).strict();

type SupabaseAdmin = ReturnType<typeof createClient>;

const analysisSchema = z.object({
  confidence: z.number().min(0).max(1),
  verdict: z.enum(['satisfies', 'partial', 'insufficient']),
  reasoning: z.string().max(1500),
  concerns: z.array(z.string().max(300)).max(6).default([]),
  // What the reviewer wants to see: the concrete facts the AI pulled from the
  // document and used to judge it (issuer, dates, scope, standards, etc.).
  key_findings: z.array(z.object({
    label: z.string().max(80),
    value: z.string().max(300),
    supports: z.enum(['yes', 'no', 'partial']).default('partial'),
  })).max(12).default([]),
});

async function gatherContext(admin: SupabaseAdmin, mapping: Record<string, unknown>) {
  // Requirement detail (title/description/citation/required evidence).
  const { data: requirement } = await admin.from('requirements')
    .select('id, stable_key').eq('stable_key', mapping.requirement_key as string).maybeSingle();
  let requirementDetail: Record<string, unknown> | null = null;
  if (requirement?.id) {
    const { data: version } = await admin.from('requirement_versions')
      .select('title, description, citation, required_evidence')
      .eq('requirement_id', requirement.id).order('effective_from', { ascending: false }).limit(1).maybeSingle();
    requirementDetail = version ?? null;
  }

  // Evidence detail + any extracted field observations.
  const { data: evidenceVersion } = await admin.from('evidence_versions')
    .select('id, document_asset_id, expiry_date, jurisdiction, standards, covered_product_ids, covered_facility_ids, record:evidence_records!inner(display_name, canonical_document_type)')
    .eq('id', mapping.evidence_version_id as string).maybeSingle();
  const { data: observations } = await admin.from('evidence_field_observations')
    .select('field_name, normalized_value, raw_value, confidence, source_quote')
    .eq('evidence_version_id', mapping.evidence_version_id as string).limit(40);

  // Actually READ the document so the verdict is grounded in its content, not
  // just its type/metadata. PDFs and text formats extract; scanned images return
  // empty (documentRead=false) and we fall back to metadata reasoning.
  let documentText = '';
  let documentRead = false;
  const assetId = (evidenceVersion as Record<string, unknown> | null)?.document_asset_id as string | undefined;
  if (assetId) {
    const { data: asset } = await admin.from('document_assets')
      .select('storage_bucket, storage_path, mime_type').eq('id', assetId).maybeSingle();
    if (asset?.storage_path && asset?.storage_bucket) {
      documentText = await extractTextFromStorage(
        admin, asset.storage_bucket as string, asset.storage_path as string,
        asset.mime_type as string | null, DOC_EXCERPT_CHARS);
      documentRead = documentText.trim().length > 0;
    }
  }

  return { requirementDetail, evidenceVersion, observations: observations ?? [], documentText, documentRead };
}

function buildPrompt(mapping: Record<string, unknown>, ctx: Awaited<ReturnType<typeof gatherContext>>): string {
  const record = Array.isArray((ctx.evidenceVersion as Record<string, unknown> | null)?.record)
    ? (ctx.evidenceVersion as Record<string, unknown> & { record: unknown[] }).record[0]
    : (ctx.evidenceVersion as Record<string, unknown> | null)?.record;
  return JSON.stringify({
    requirement: {
      framework: `${mapping.framework_code} ${mapping.framework_version}`,
      key: mapping.requirement_key,
      title: ctx.requirementDetail?.title ?? mapping.requirement_title,
      description: ctx.requirementDetail?.description ?? null,
      citation: ctx.requirementDetail?.citation ?? null,
      required_evidence: ctx.requirementDetail?.required_evidence ?? null,
    },
    submitted_evidence: {
      document_type: (record as Record<string, unknown>)?.canonical_document_type ?? mapping.evidence_document_type,
      display_name: (record as Record<string, unknown>)?.display_name ?? null,
      expiry_date: (ctx.evidenceVersion as Record<string, unknown> | null)?.expiry_date ?? null,
      jurisdiction: (ctx.evidenceVersion as Record<string, unknown> | null)?.jurisdiction ?? null,
      standards: (ctx.evidenceVersion as Record<string, unknown> | null)?.standards ?? [],
      extracted_fields: ctx.observations,
      document_readable: ctx.documentRead,
      document_text: ctx.documentText ? ctx.documentText.slice(0, DOC_EXCERPT_CHARS) : null,
    },
    deterministic_match: {
      score: mapping.match_score,
      reasons: mapping.match_reasons,
    },
  });
}

async function analyzeOne(admin: SupabaseAdmin, aiConfig: AiConfig, mapping: Record<string, unknown>) {
  const ctx = await gatherContext(admin, mapping);
  const payload = buildPrompt(mapping, ctx);
  const systemPrompt = `You are a supply-chain compliance reviewer. You are given ONE compliance requirement and ONE submitted document (its extracted text when readable, plus machine-extracted fields and metadata). READ the document text and judge ONLY whether it satisfies THIS requirement.

Rules:
- Base your judgment on what the document actually says. If document_text is present, READ IT and cite concrete facts (issuer, certificate number, scope, dates, standard covered).
- Be conservative: missing scope, wrong entity, expired, or an unreadable document (document_readable=false) → verdict "partial" or "insufficient".
- Never invent facts not present in the input.

Respond with strict JSON:
{
  "confidence": 0..1,   // calibrated probability the evidence truly satisfies the requirement
  "verdict": "satisfies" | "partial" | "insufficient",
  "reasoning": "2-4 sentences a human reviewer can act on, citing what you read",
  "concerns": ["short concern", ...],
  "key_findings": [ {"label": "Issuer", "value": "...", "supports": "yes"|"no"|"partial"}, {"label": "Valid until", "value": "2027-06-04", "supports": "yes"}, ... ]  // the concrete facts you extracted and how each bears on the requirement
}`;

  const raw = await aiComplete(aiConfig, { system: systemPrompt, user: payload, jsonMode: true, maxTokens: 900 });
  const parsed = analysisSchema.parse(JSON.parse(raw));

  await admin.from('requirement_evidence_mappings').update({
    ai_confidence: parsed.confidence,
    ai_verdict: parsed.verdict,
    ai_reasoning: parsed.reasoning,
    ai_concerns: parsed.concerns,
    ai_findings: parsed.key_findings,
    ai_document_read: ctx.documentRead,
    ai_document_excerpt: ctx.documentText ? ctx.documentText.slice(0, 1500) : null,
    ai_model: `${aiConfig.provider}:${aiConfig.model}`,
    ai_analyzed_at: new Date().toISOString(),
  }).eq('id', mapping.id as string);

  await admin.from('agent_activities').insert({
    agent_type: 'evidence_mapping_analyst',
    action_type: 'analyze_mapping',
    entity_id: mapping.id as string,
    entity_type: 'requirement_evidence_mapping',
    confidence_score: parsed.confidence,
    reasoning: parsed.reasoning,
    details: { verdict: parsed.verdict, concerns: parsed.concerns, document_read: ctx.documentRead, model: `${aiConfig.provider}:${aiConfig.model}` },
    success: true,
  });

  return { mapping_id: mapping.id, document_read: ctx.documentRead, ...parsed };
}

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

    const { data: mappings, error: mappingsError } = await admin.from('requirement_evidence_mappings')
      .select('id, buyer_id, framework_code, framework_version, requirement_key, requirement_title, evidence_version_id, evidence_document_type, match_score, match_reasons')
      .eq('buyer_id', input.buyer_id).in('id', input.mapping_ids);
    if (mappingsError) throw mappingsError;

    const results: unknown[] = [];
    const failures: unknown[] = [];
    for (const mapping of mappings ?? []) {
      try {
        results.push(await analyzeOne(admin, aiConfig, mapping));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ mapping_id: mapping.id, error: message });
        await admin.from('agent_activities').insert({
          agent_type: 'evidence_mapping_analyst', action_type: 'analyze_mapping',
          entity_id: mapping.id, entity_type: 'requirement_evidence_mapping',
          success: false, error_message: message,
        });
      }
    }

    logEvent('info', 'evidence_mappings_analyzed', context, {
      actor_id: user.id, buyer_id: input.buyer_id, analyzed: results.length, failed: failures.length,
    });
    return jsonResponse(context, { analyzed: results, failed: failures });
  } catch (error) {
    logEvent('error', 'evidence_mapping_analysis_failed', context, {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(context, { error: 'Evidence mapping analysis failed' }, 500);
  }
});
