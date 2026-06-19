import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { requirementEvaluationRequestV1Schema } from '../_shared/requirements/contracts.ts';
import { parseIdempotencyKey, requirementRequestHash } from '../_shared/requirements/requestContract.ts';
import { normalizeRequirementFacts } from '../_shared/requirements/facts.ts';
import { hasBuyerAccess, loadCatalogResults, loadLegacyResults, loadSubject } from '../_shared/requirements/applicability.ts';
import { isBuyerFeatureEnabled } from '../_shared/featureFlags.ts';
import {
  complianceDecisionResponseV1Schema,
  DECISION_ENGINE_VERSION,
  type ComplianceDecisionResultV1,
} from '../_shared/compliance/contracts.ts';
import { deriveComplianceOutcome, type CoverageState } from '../_shared/compliance/outcome.ts';

type SupabaseAdmin = ReturnType<typeof createClient>;

interface ClaimRow {
  id: string;
  document_type: string | null;
  status: string;
  expiry_date: string | null;
}

interface RequestRow {
  id: string;
  document_type: string;
  status: string;
}

interface CoverageData {
  claims: ClaimRow[];
  requests: RequestRow[];
  uploadedRequestIds: Set<string>;
}

function normalizeDocType(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

async function loadCoverageData(admin: SupabaseAdmin, buyerId: string, supplierId: string): Promise<CoverageData> {
  const [{ data: claims, error: claimsError }, { data: requests, error: requestsError }] = await Promise.all([
    admin.from('evidence_claims')
      .select('id, document_type, status, expiry_date')
      .eq('supplier_id', supplierId)
      .neq('status', 'superseded'),
    admin.from('document_requests')
      .select('id, document_type, status')
      .eq('buyer_id', buyerId).eq('supplier_id', supplierId),
  ]);
  if (claimsError) throw claimsError;
  if (requestsError) throw requestsError;

  const requestIds = (requests || []).map((request) => request.id);
  let uploadedRequestIds = new Set<string>();
  if (requestIds.length) {
    const { data, error } = await admin.from('document_uploads').select('request_id').in('request_id', requestIds);
    if (error) throw error;
    uploadedRequestIds = new Set((data || []).map((upload) => upload.request_id).filter(Boolean));
  }

  return { claims: claims || [], requests: requests || [], uploadedRequestIds };
}

function buildCoverage(documentType: string, data: CoverageData): { coverage: CoverageState; claimIds: string[] } {
  const target = normalizeDocType(documentType);
  const matchingClaims = data.claims.filter((claim) => normalizeDocType(claim.document_type) === target);
  const matchingRequests = data.requests.filter((request) => normalizeDocType(request.document_type) === target);

  const verified = matchingClaims.find((claim) => claim.status === 'verified');
  const rejected = matchingClaims.some((claim) => claim.status === 'rejected');
  const unverified = matchingClaims.some((claim) => claim.status === 'extracted');
  const hasUpload = matchingRequests.some((request) => data.uploadedRequestIds.has(request.id));
  const hasOpenRequest = matchingRequests.some((request) => request.status === 'pending');

  return {
    coverage: {
      hasVerifiedClaim: Boolean(verified),
      verifiedExpiryDate: verified?.expiry_date ?? null,
      hasRejectedClaim: rejected,
      hasUnverifiedClaim: unverified,
      hasUpload,
      hasOpenRequest,
    },
    claimIds: matchingClaims.map((claim) => claim.id),
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

    const limit = checkRateLimit(`compliance:${user.id}`, 30, 60_000);
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
      logEvent('warn', 'compliance_decision_forbidden', context, { actor_id: user.id, buyer_id: input.buyer_id });
      return jsonResponse(context, { error: 'Buyer access required' }, 403);
    }
    if (!(await isBuyerFeatureEnabled(admin, input.buyer_id, 'compliance_decisions_v1'))) {
      logEvent('warn', 'compliance_decision_feature_disabled', context, { actor_id: user.id, buyer_id: input.buyer_id });
      return jsonResponse(context, { error: 'Compliance decision engine is disabled for this organization' }, 403);
    }

    const requestHash = await requirementRequestHash(input);
    const { data: existing } = await admin.from('compliance_evaluations').select('id, request_hash')
      .eq('buyer_id', input.buyer_id).eq('actor_id', user.id)
      .eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) {
      if (existing.request_hash !== requestHash) {
        return jsonResponse(context, { error: 'Idempotency key was already used for a different request' }, 409);
      }
      const { data: replayResults, error: replayError } = await admin.from('compliance_decision_results')
        .select('*').eq('evaluation_id', existing.id).order('framework_code').order('requirement_key');
      if (replayError) throw replayError;
      const replayResponse = complianceDecisionResponseV1Schema.parse({
        evaluation_id: existing.id,
        idempotent_replay: true,
        evaluator_version: DECISION_ENGINE_VERSION,
        correlation_id: context.correlationId,
        subject_type: input.subject_type,
        subject_id: input.subject_id,
        effective_at: input.effective_at,
        results: (replayResults || []).map((row) => ({
          requirement_version_id: row.requirement_version_id,
          legacy_mapping_id: row.legacy_mapping_id,
          framework_code: row.framework_code,
          framework_version: row.framework_version,
          requirement_key: row.requirement_key,
          title: row.title,
          applicability_outcome: row.applicability_outcome,
          outcome: row.outcome,
          explanation: row.explanation,
          evidence_claim_ids: row.evidence_claim_ids || [],
          decision_version: row.decision_version,
          effective_from: row.effective_from,
          effective_to: row.effective_to,
        })),
      });
      logEvent('info', 'compliance_decision_replayed', context, {
        evaluation_id: existing.id,
        buyer_id: input.buyer_id,
        latency_ms: Math.round(performance.now() - startedAt),
      });
      return jsonResponse(context, replayResponse);
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

    const [catalogResults, legacy, coverageData] = await Promise.all([
      loadCatalogResults(admin, input.buyer_id, input.subject_type, input.effective_at, facts),
      loadLegacyResults(admin, input.buyer_id, input.subject_type, subjectContext.supplierId),
      loadCoverageData(admin, input.buyer_id, subjectContext.supplierId),
    ]);
    const applicabilityResults = [...catalogResults, ...legacy.results];

    const decisionResults: ComplianceDecisionResultV1[] = applicabilityResults.map((result) => {
      const primaryDocType = result.required_evidence[0]?.document_type;
      const { coverage, claimIds } = primaryDocType
        ? buildCoverage(primaryDocType, coverageData)
        : {
          coverage: {
            hasVerifiedClaim: false, verifiedExpiryDate: null, hasRejectedClaim: false,
            hasUnverifiedClaim: false, hasUpload: false, hasOpenRequest: false,
          },
          claimIds: [],
        };

      const mapped = deriveComplianceOutcome(result.outcome, result.required_evidence.length > 0, coverage, input.effective_at);

      return {
        requirement_version_id: result.requirement_version_id,
        legacy_mapping_id: result.legacy_mapping_id,
        framework_code: result.framework_code,
        framework_version: result.framework_version,
        requirement_key: result.requirement_key,
        title: result.title,
        applicability_outcome: result.outcome,
        outcome: mapped.outcome,
        explanation: `${result.explanation} ${mapped.explanation}`,
        evidence_claim_ids: claimIds,
        decision_version: DECISION_ENGINE_VERSION,
        effective_from: result.effective_from,
        effective_to: result.effective_to,
      };
    });

    const { data: evaluationId, error: recordError } = await admin.rpc('record_compliance_decision_v1', {
      p_evaluation: {
        buyer_id: input.buyer_id,
        subject_type: input.subject_type,
        subject_id: input.subject_id,
        effective_at: input.effective_at,
        input_snapshot: { ...input, resolved_subject: subjectContext.subject },
        request_hash: requestHash,
        evaluator_version: DECISION_ENGINE_VERSION,
        actor_id: user.id,
        idempotency_key: idempotencyKey,
        correlation_id: context.correlationId,
      },
      p_results: decisionResults,
    });
    if (recordError) throw recordError;

    logEvent('info', 'compliance_decision_completed', context, {
      evaluation_id: evaluationId,
      actor_id: user.id,
      buyer_id: input.buyer_id,
      subject_type: input.subject_type,
      result_count: decisionResults.length,
      outcome_counts: decisionResults.reduce<Record<string, number>>((acc, result) => {
        acc[result.outcome] = (acc[result.outcome] || 0) + 1;
        return acc;
      }, {}),
      latency_ms: Math.round(performance.now() - startedAt),
    });

    const response = complianceDecisionResponseV1Schema.parse({
      evaluation_id: evaluationId,
      idempotent_replay: false,
      evaluator_version: DECISION_ENGINE_VERSION,
      correlation_id: context.correlationId,
      subject_type: input.subject_type,
      subject_id: input.subject_id,
      effective_at: input.effective_at,
      results: decisionResults,
    });
    return jsonResponse(context, response);
  } catch (error) {
    logEvent('error', 'compliance_decision_failed', context, {
      error: error instanceof Error ? error.message : String(error),
      latency_ms: Math.round(performance.now() - startedAt),
    });
    return jsonResponse(context, { error: 'Compliance decision evaluation failed', correlation_id: context.correlationId }, 500);
  }
});
