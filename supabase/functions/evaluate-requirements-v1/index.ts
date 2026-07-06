import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import {
  requirementEvaluationRequestV1Schema,
  requirementEvaluationResponseV1Schema,
  type RequirementEvaluationResultV1,
} from '../_shared/requirements/contracts.ts';
import { REQUIREMENT_EVALUATOR_VERSION } from '../_shared/requirements/evaluator.ts';
import { parseIdempotencyKey, requirementRequestHash } from '../_shared/requirements/requestContract.ts';
import { normalizeRequirementFacts } from '../_shared/requirements/facts.ts';
import { hasBuyerAccess, loadCatalogResults, loadLegacyResults, loadSubject } from '../_shared/requirements/applicability.ts';
import { isBuyerFeatureEnabled } from '../_shared/featureFlags.ts';

type SupabaseAdmin = ReturnType<typeof createClient>;

function storedResultToContract(row: Record<string, unknown>): RequirementEvaluationResultV1 {
  return {
    requirement_version_id: typeof row.requirement_version_id === 'string' ? row.requirement_version_id : null,
    legacy_mapping_id: typeof row.legacy_mapping_id === 'string' ? row.legacy_mapping_id : null,
    framework_code: String(row.framework_code),
    framework_version: String(row.framework_version),
    requirement_key: String(row.requirement_key),
    title: String(row.title),
    outcome: row.outcome as RequirementEvaluationResultV1['outcome'],
    explanation: String(row.explanation),
    matched_facts: (row.matched_facts || {}) as Record<string, unknown>,
    missing_inputs: Array.isArray(row.missing_inputs) ? row.missing_inputs.map(String) : [],
    citation: typeof row.citation === 'string' ? row.citation : null,
    source_url: typeof row.source_url === 'string' ? row.source_url : null,
    required_evidence: (row.required_evidence || []) as RequirementEvaluationResultV1['required_evidence'],
    effective_from: typeof row.effective_from === 'string' ? row.effective_from : null,
    effective_to: typeof row.effective_to === 'string' ? row.effective_to : null,
  };
}

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const startedAt = performance.now();
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse(context, { error: 'Authentication required' }, 401);

    const idempotencyKey = parseIdempotencyKey(req);
    if (!idempotencyKey) {
      return jsonResponse(context, { error: 'A valid x-idempotency-key header is required' }, 400);
    }

    const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authHeader.slice('Bearer '.length);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return jsonResponse(context, { error: 'Invalid authentication' }, 401);

    const limit = checkRateLimit(`requirements:${user.id}`, 30, 60_000);
    if (!limit.allowed) {
      return jsonResponse(context, { error: 'Too many requests' }, 429, {
        'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)),
      });
    }

    const parsed = requirementEvaluationRequestV1Schema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse(context, { error: 'Invalid request', details: parsed.error.flatten() }, 400);
    }
    const input = parsed.data;

    if (!(await hasBuyerAccess(admin, user.id, input.buyer_id))) {
      logEvent('warn', 'requirement_evaluation_forbidden', context, { actor_id: user.id, buyer_id: input.buyer_id });
      return jsonResponse(context, { error: 'Buyer access required' }, 403);
    }
    if (!(await isBuyerFeatureEnabled(admin, input.buyer_id, 'compliance_requirements_v1'))) {
      logEvent('warn', 'requirement_evaluation_feature_disabled', context, {
        actor_id: user.id,
        buyer_id: input.buyer_id,
      });
      return jsonResponse(context, { error: 'Requirement engine is disabled for this organization' }, 403);
    }

    const requestHash = await requirementRequestHash(input);
    const { data: existing } = await admin.from('requirement_evaluations').select('id, request_hash')
      .eq('buyer_id', input.buyer_id).eq('actor_id', user.id)
      .eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) {
      if (existing.request_hash !== requestHash) {
        return jsonResponse(context, { error: 'Idempotency key was already used for a different request' }, 409);
      }
      const { data: replayResults, error: replayError } = await admin.from('requirement_evaluation_results')
        .select('*').eq('evaluation_id', existing.id).order('framework_code').order('requirement_key');
      if (replayError) throw replayError;
      const replayResponse = {
        evaluation_id: existing.id,
        idempotent_replay: true,
        evaluator_version: REQUIREMENT_EVALUATOR_VERSION,
        correlation_id: context.correlationId,
        subject_type: input.subject_type,
        subject_id: input.subject_id,
        effective_at: input.effective_at,
        results: (replayResults || []).map((result) => storedResultToContract(result)),
      };
      const validatedReplay = requirementEvaluationResponseV1Schema.parse(replayResponse);
      logEvent('info', 'requirement_evaluation_replayed', context, {
        evaluation_id: existing.id,
        buyer_id: input.buyer_id,
        latency_ms: Math.round(performance.now() - startedAt),
      });
      return jsonResponse(context, validatedReplay);
    }

    const subjectContext = await loadSubject(admin, input.buyer_id, input.subject_type, input.subject_id);
    if (!subjectContext) return jsonResponse(context, { error: 'Subject not found or not accessible' }, 404);

    const authoritativeFacts = normalizeRequirementFacts(input.facts);

    const facts: Record<string, unknown> = {
      ...authoritativeFacts,
      subject_type: input.subject_type,
      subject_id: input.subject_id,
      supplier_id: subjectContext.supplierId,
      effective_at: input.effective_at,
    };
    const [catalogResults, legacy] = await Promise.all([
      loadCatalogResults(admin, input.buyer_id, input.subject_type, input.effective_at, facts, subjectContext.supplierId),
      loadLegacyResults(admin, input.buyer_id, input.subject_type, subjectContext.supplierId),
    ]);
    const results = [...catalogResults, ...legacy.results];

    const { data: evaluationId, error: recordError } = await admin.rpc('record_requirement_evaluation_v1', {
      p_evaluation: {
        buyer_id: input.buyer_id,
        subject_type: input.subject_type,
        subject_id: input.subject_id,
        effective_at: input.effective_at,
        input_snapshot: { ...input, resolved_subject: subjectContext.subject },
        request_hash: requestHash,
        evaluator_version: REQUIREMENT_EVALUATOR_VERSION,
        actor_id: user.id,
        idempotency_key: idempotencyKey,
        correlation_id: context.correlationId,
      },
      p_results: results,
    });
    if (recordError) throw recordError;

    logEvent('info', 'requirement_evaluation_completed', context, {
      evaluation_id: evaluationId,
      actor_id: user.id,
      buyer_id: input.buyer_id,
      subject_type: input.subject_type,
      result_count: results.length,
      indeterminate_count: results.filter((result) => result.outcome === 'indeterminate').length,
      rule_versions: [...new Set(results.map((result) => `${result.framework_code}:${result.framework_version}`))],
      legacy_mapping_count: legacy.results.length,
      legacy_source_count: legacy.sourceCount,
      legacy_mapping_coverage: legacy.sourceCount === 0 ? 1 : legacy.results.length / legacy.sourceCount,
      latency_ms: Math.round(performance.now() - startedAt),
    });

    const response = requirementEvaluationResponseV1Schema.parse({
      evaluation_id: evaluationId,
      idempotent_replay: false,
      evaluator_version: REQUIREMENT_EVALUATOR_VERSION,
      correlation_id: context.correlationId,
      subject_type: input.subject_type,
      subject_id: input.subject_id,
      effective_at: input.effective_at,
      results,
    });
    return jsonResponse(context, response);
  } catch (error) {
    logEvent('error', 'requirement_evaluation_failed', context, {
      error: error instanceof Error ? error.message : String(error),
      latency_ms: Math.round(performance.now() - startedAt),
    });
    return jsonResponse(context, { error: 'Requirement evaluation failed', correlation_id: context.correlationId }, 500);
  }
});
