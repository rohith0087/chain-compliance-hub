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
import { isGrantActive, matchesGrant, normalizeDocType, type EvidenceSharingGrant } from '../_shared/compliance/grants.ts';
import { matchCanonicalEvidence, type CanonicalCoverageData, type CanonicalEvidenceMatch } from '../_shared/compliance/canonicalCoverage.ts';
import {
  applyMappingPolicy, findMappingForVersion, groupMappings, mappingKey, rejectedVersionIds,
  type RequirementEvidenceMapping,
} from '../_shared/compliance/mappingPolicy.ts';
import { isInternalSystemRequest } from '../_shared/systemAuth.ts';

type SupabaseAdmin = ReturnType<typeof createClient>;

interface ClaimRow {
  id: string;
  buyer_id: string;
  supplier_id: string;
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
  grants: EvidenceSharingGrant[];
}

async function loadCanonicalCoverageData(admin: SupabaseAdmin, buyerId: string, supplierId: string): Promise<CanonicalCoverageData> {
  const { data: records, error: recordsError } = await admin.from('evidence_records').select('id,canonical_document_type').eq('supplier_id',supplierId).eq('status','active');
  if (recordsError) throw recordsError;
  const recordIds = (records || []).map((row) => row.id);
  if (!recordIds.length) return { records: [], versions: [], attestations: [], validations: [], grants: [], requestLinks: [], observations: [] };
  const { data: versions, error: versionsError } = await admin.from('evidence_versions')
    .select('id,evidence_record_id,lifecycle_status,expiry_date,jurisdiction,standards,covered_product_ids,covered_facility_ids,validation_completeness,legacy_evidence_claim_id').in('evidence_record_id',recordIds);
  if (versionsError) throw versionsError;
  const versionIds = (versions || []).map((row) => row.id);
  if (!versionIds.length) return { records: records || [], versions: [], attestations: [], validations: [], grants: [], requestLinks: [], observations: [] };
  const [{ data: attestations, error: attestationsError }, { data: validations, error: validationsError }, { data: grants, error: grantsError }, { data: links, error: linksError }, { data: observations, error: observationsError }] = await Promise.all([
    admin.from('evidence_attestations').select('evidence_version_id,attestation_type,outcome,organization_id,created_at').in('evidence_version_id',versionIds).or(`organization_id.eq.${supplierId},organization_id.eq.${buyerId}`).order('created_at',{ascending:false}),
    admin.from('evidence_validation_runs').select('evidence_version_id,status,created_at').in('evidence_version_id',versionIds).order('created_at',{ascending:false}),
    admin.from('evidence_sharing_grants').select('id,evidence_version_id,status,expires_at').eq('granted_to_organization_id',buyerId).in('evidence_version_id',versionIds),
    admin.from('request_evidence_links').select('evidence_version_id,relation,document_requests!inner(buyer_id)').in('evidence_version_id',versionIds).eq('document_requests.buyer_id',buyerId),
    admin.from('evidence_field_observations').select('evidence_version_id,field_name').in('evidence_version_id',versionIds),
  ]);
  if (attestationsError) throw attestationsError; if (validationsError) throw validationsError; if (grantsError) throw grantsError; if (linksError) throw linksError; if (observationsError) throw observationsError;
  return { records: records || [], versions: versions || [], attestations: attestations || [], validations: validations || [], grants: grants || [], requestLinks: links || [], observations: observations || [] } as CanonicalCoverageData;
}

async function loadCoverageData(admin: SupabaseAdmin, buyerId: string, supplierId: string): Promise<CoverageData> {
  const [{ data: claims, error: claimsError }, { data: requests, error: requestsError }, { data: grants, error: grantsError }] = await Promise.all([
    admin.from('evidence_claims')
      .select('id, buyer_id, supplier_id, document_type, status, expiry_date')
      .eq('supplier_id', supplierId)
      .neq('status', 'superseded'),
    admin.from('document_requests')
      .select('id, document_type, status')
      .eq('buyer_id', buyerId).eq('supplier_id', supplierId),
    admin.from('evidence_sharing_grants')
      .select('id, owner_organization_id, granted_to_organization_id, claim_id, document_type, purpose, status, expires_at')
      .eq('owner_organization_id', supplierId)
      .eq('granted_to_organization_id', buyerId)
      .eq('status', 'active')
      .eq('purpose', 'compliance_decision'),
  ]);
  if (claimsError) throw claimsError;
  if (requestsError) throw requestsError;
  if (grantsError) throw grantsError;

  const requestIds = (requests || []).map((request) => request.id);
  let uploadedRequestIds = new Set<string>();
  if (requestIds.length) {
    const { data, error } = await admin.from('document_uploads').select('request_id').in('request_id', requestIds);
    if (error) throw error;
    uploadedRequestIds = new Set((data || []).map((upload) => upload.request_id).filter(Boolean));
  }

  return { claims: claims || [], requests: requests || [], uploadedRequestIds, grants: (grants || []) as EvidenceSharingGrant[] };
}

function buildCoverage(
  documentType: string,
  data: CoverageData,
  requestingBuyerId: string,
  effectiveAt: string,
): { coverage: CoverageState; claimIds: string[]; grantSourcedGrantIds: string[] } {
  const target = normalizeDocType(documentType);
  const candidateClaims = data.claims.filter((claim) => normalizeDocType(claim.document_type) === target);
  const matchingRequests = data.requests.filter((request) => normalizeDocType(request.document_type) === target);

  // A claim counts toward coverage if the requesting buyer originated it
  // directly, or if the supplier granted this buyer compliance_decision
  // access to it (by claim id or by document type) and that grant is still
  // active as of the evaluation's effective date.
  const inScopeClaims: ClaimRow[] = [];
  const grantSourcedGrantIds = new Set<string>();
  for (const claim of candidateClaims) {
    if (claim.buyer_id === requestingBuyerId) {
      inScopeClaims.push(claim);
      continue;
    }
    const grant = data.grants.find((g) => isGrantActive(g, effectiveAt) && matchesGrant(claim, g));
    if (grant) {
      inScopeClaims.push(claim);
      grantSourcedGrantIds.add(grant.id);
    }
  }

  const verified = inScopeClaims.find((claim) => claim.status === 'verified');
  const rejected = inScopeClaims.some((claim) => claim.status === 'rejected');
  const unverified = inScopeClaims.some((claim) => claim.status === 'extracted');
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
    claimIds: inScopeClaims.map((claim) => claim.id),
    grantSourcedGrantIds: [...grantSourcedGrantIds],
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
    const parsed = requirementEvaluationRequestV1Schema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse(context, { error: 'Invalid request', details: parsed.error.flatten() }, 400);
    }
    const input = parsed.data;
    // Any trusted internal caller (the reevaluation processor, cron, or a
    // service-role recovery call) is accepted through the one shared door.
    const systemRequest = await isInternalSystemRequest(req, admin);
    let actorId: string;
    if (systemRequest) {
      const { data: owner, error: ownerError } = await admin.from('buyers').select('profile_id').eq('id',input.buyer_id).maybeSingle();
      if (ownerError || !owner?.profile_id) return jsonResponse(context,{error:'Buyer owner is required for system reevaluation'},409);
      actorId = owner.profile_id;
    } else {
      const token = authHeader.slice('Bearer '.length);
      const { data: { user }, error: authError } = await admin.auth.getUser(token);
      if (authError || !user) return jsonResponse(context, { error: 'Invalid authentication' }, 401);
      actorId = user.id;
      const limit = checkRateLimit(`compliance:${actorId}`, 30, 60_000);
      if (!limit.allowed) return jsonResponse(context, { error: 'Too many requests' }, 429, { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) });
    }

    if (!systemRequest && !(await hasBuyerAccess(admin, actorId, input.buyer_id))) {
      logEvent('warn', 'compliance_decision_forbidden', context, { actor_id: actorId, buyer_id: input.buyer_id });
      return jsonResponse(context, { error: 'Buyer access required' }, 403);
    }
    if (!(await isBuyerFeatureEnabled(admin, input.buyer_id, 'compliance_decisions_v1'))) {
      logEvent('warn', 'compliance_decision_feature_disabled', context, { actor_id: actorId, buyer_id: input.buyer_id });
      return jsonResponse(context, { error: 'Compliance decision engine is disabled for this organization' }, 403);
    }

    const requestHash = await requirementRequestHash(input);
    const { data: existing } = await admin.from('compliance_evaluations').select('id, request_hash')
      .eq('buyer_id', input.buyer_id).eq('actor_id', actorId)
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

    const canonicalEnabled = await isBuyerFeatureEnabled(admin, input.buyer_id, 'canonical_evidence_v1');
    const [catalogResults, legacy, coverageData, canonicalCoverageData, reviewPolicy] = await Promise.all([
      loadCatalogResults(admin, input.buyer_id, input.subject_type, input.effective_at, facts, subjectContext.supplierId),
      loadLegacyResults(admin, input.buyer_id, input.subject_type, subjectContext.supplierId),
      loadCoverageData(admin, input.buyer_id, subjectContext.supplierId),
      canonicalEnabled ? loadCanonicalCoverageData(admin,input.buyer_id,subjectContext.supplierId) : Promise.resolve(null),
      canonicalEnabled ? admin.from('evidence_review_policies').select('default_minimum_validity_days,document_type_overrides,require_mapping_approval').eq('buyer_id',input.buyer_id).maybeSingle() : Promise.resolve({data:null,error:null}),
    ]);
    if (reviewPolicy.error) throw reviewPolicy.error;
    const canonicalMatchPolicy = {
      defaultMinimumValidityDays: reviewPolicy.data?.default_minimum_validity_days ?? 90,
      documentTypeOverrides: reviewPolicy.data?.document_type_overrides || {},
    };
    const requireMappingApproval = reviewPolicy.data?.require_mapping_approval === true;

    // Phase 3: human decisions on (requirement, evidence version) mappings.
    // Rejected mappings exclude that evidence; approved mappings carry the
    // reviewer into the compliance explanation; in strict mode canonical
    // evidence without an approved mapping cannot make a requirement compliant.
    const { data: mappingRows, error: mappingRowsError } = canonicalEnabled
      ? await admin.from('requirement_evidence_mappings')
        .select('id, framework_code, requirement_key, evidence_version_id, status, decided_by, decided_at')
        .eq('buyer_id', input.buyer_id).eq('subject_type', input.subject_type).eq('subject_id', input.subject_id)
      : { data: [], error: null };
    if (mappingRowsError) throw mappingRowsError;
    const mappingsByRequirement = groupMappings((mappingRows || []) as RequirementEvidenceMapping[]);
    const approverIds = [...new Set((mappingRows || [])
      .filter((row: RequirementEvidenceMapping) => row.status === 'approved' && row.decided_by)
      .map((row: RequirementEvidenceMapping) => row.decided_by as string))];
    const { data: approverProfiles, error: approverError } = approverIds.length
      ? await admin.from('profiles').select('id, full_name').in('id', approverIds)
      : { data: [], error: null };
    if (approverError) throw approverError;
    const approverNameById = new Map((approverProfiles || []).map((profile: { id: string; full_name: string | null }) => [profile.id, profile.full_name]));
    const recordTypeById = new Map((canonicalCoverageData?.records || []).map((record) => [record.id, record.canonical_document_type]));
    const docTypeByVersionId = new Map((canonicalCoverageData?.versions || []).map((version) => [version.id, recordTypeById.get(version.evidence_record_id) ?? null]));
    const proposedMappingInserts: Array<Record<string, unknown>> = [];
    // Catalog and legacy requirements are independently deduplicated within
    // their own loaders, but a catalog requirement's stable_key can in
    // principle still collide with a legacy normalized key under the same
    // framework_code/version (e.g. an admin-authored framework reusing
    // 'TR2C-LEGACY'). compliance_decision_results has a unique constraint on
    // (evaluation_id, framework_code, requirement_key, framework_version),
    // so guard the merge point the same way legacyAdapter.ts already does:
    // normalized key, last source wins.
    const dedupedApplicability = new Map<string, typeof catalogResults[number] | typeof legacy.results[number]>();
    for (const result of [...catalogResults, ...legacy.results]) {
      dedupedApplicability.set(`${result.framework_code}::${result.requirement_key}::${result.framework_version}`, result);
    }
    const applicabilityResults = [...dedupedApplicability.values()];

    const grantSourcedByRequirement = new Map<string, string[]>();
    const canonicalMatchesByRequirement = new Map<string, CanonicalEvidenceMatch[]>();
    const decisionResults: ComplianceDecisionResultV1[] = applicabilityResults.map((result) => {
      const requirementMappings = mappingsByRequirement.get(mappingKey(result.framework_code, result.requirement_key));
      const canonical = canonicalCoverageData
        ? matchCanonicalEvidence(result.required_evidence,canonicalCoverageData,input.subject_type,input.subject_id,input.effective_at,canonicalMatchPolicy,rejectedVersionIds(requirementMappings))
        : null;
      const primaryDocType = result.required_evidence[0]?.document_type;
      const legacyCoverage = primaryDocType
        ? buildCoverage(primaryDocType, coverageData, input.buyer_id, input.effective_at)
        : {
          coverage: {
            hasVerifiedClaim: false, verifiedExpiryDate: null, hasRejectedClaim: false,
            hasUnverifiedClaim: false, hasUpload: false, hasOpenRequest: false,
          },
          claimIds: [],
          grantSourcedGrantIds: [] as string[],
        };
      const useCanonical = Boolean(canonical && (canonical.matches.length > 0 || canonical.coverage.hasUpload || canonical.coverage.hasRejectedClaim));
      const coverage = useCanonical ? canonical!.coverage : legacyCoverage.coverage;
      const claimIds = useCanonical ? canonical!.matches.map((match) => match.legacyClaimId).filter((id): id is string => Boolean(id)) : legacyCoverage.claimIds;
      const grantSourcedGrantIds = useCanonical ? canonical!.grantIds : legacyCoverage.grantSourcedGrantIds;
      if (useCanonical && canonical!.matches.length) canonicalMatchesByRequirement.set(result.requirement_key,canonical!.matches);

      const mapped = deriveComplianceOutcome(result.outcome, result.required_evidence.length > 0, coverage, input.effective_at);

      // Queue machine-eligible matches without a mapping row as proposals for
      // the human review queue, then apply the mapping-approval policy.
      if (canonical) {
        for (const match of canonical.matches) {
          if (!findMappingForVersion(requirementMappings, match.evidenceVersionId)) {
            proposedMappingInserts.push({
              buyer_id: input.buyer_id,
              supplier_id: subjectContext.supplierId,
              subject_type: input.subject_type,
              subject_id: input.subject_id,
              framework_code: result.framework_code,
              framework_version: result.framework_version,
              requirement_key: result.requirement_key,
              requirement_title: result.title,
              evidence_version_id: match.evidenceVersionId,
              evidence_document_type: docTypeByVersionId.get(match.evidenceVersionId) ?? null,
              match_score: match.score,
              match_reasons: match.reasons,
            });
          }
        }
      }
      const usedMatch = useCanonical && canonical!.matches.length ? canonical!.matches[0] : null;
      const usedMapping = usedMatch ? findMappingForVersion(requirementMappings, usedMatch.evidenceVersionId) : undefined;
      const policyAdjusted = applyMappingPolicy(mapped, {
        // Strict mode only gates compliance derived from canonical evidence;
        // facts-only compliant outcomes have no mapping to approve.
        requireMappingApproval: requireMappingApproval && Boolean(usedMatch),
        usedMapping,
        reviewerName: usedMapping?.decided_by ? approverNameById.get(usedMapping.decided_by) ?? null : null,
        validUntil: usedMatch?.expiryDate ?? null,
      });

      const sharedNote = grantSourcedGrantIds.length > 0
        ? ' This decision includes evidence shared by the supplier under an active sharing grant.'
        : '';
      if (grantSourcedGrantIds.length > 0) {
        grantSourcedByRequirement.set(result.requirement_key, grantSourcedGrantIds);
      }

      return {
        requirement_version_id: result.requirement_version_id,
        legacy_mapping_id: result.legacy_mapping_id,
        framework_code: result.framework_code,
        framework_version: result.framework_version,
        requirement_key: result.requirement_key,
        title: result.title,
        applicability_outcome: result.outcome,
        outcome: policyAdjusted.outcome,
        explanation: `${result.explanation} ${policyAdjusted.explanation}${sharedNote}`,
        evidence_claim_ids: claimIds,
        decision_version: DECISION_ENGINE_VERSION,
        effective_from: result.effective_from,
        effective_to: result.effective_to,
      };
    });

    if (proposedMappingInserts.length) {
      const { error: proposalError } = await admin.from('requirement_evidence_mappings').upsert(
        proposedMappingInserts,
        { onConflict: 'buyer_id,subject_type,subject_id,framework_code,requirement_key,evidence_version_id', ignoreDuplicates: true },
      );
      if (proposalError) throw proposalError;
    }

    const { data: evaluationId, error: recordError } = await admin.rpc('record_compliance_decision_v1', {
      p_evaluation: {
        buyer_id: input.buyer_id,
        subject_type: input.subject_type,
        subject_id: input.subject_id,
        effective_at: input.effective_at,
        input_snapshot: { ...input, resolved_subject: subjectContext.subject },
        request_hash: requestHash,
        evaluator_version: DECISION_ENGINE_VERSION,
        actor_id: actorId,
        idempotency_key: idempotencyKey,
        correlation_id: context.correlationId,
      },
      p_results: decisionResults,
    });
    if (recordError) throw recordError;

    if (grantSourcedByRequirement.size > 0) {
      const { data: storedResults, error: storedResultsError } = await admin.from('compliance_decision_results')
        .select('id, requirement_key').eq('evaluation_id', evaluationId)
        .in('requirement_key', [...grantSourcedByRequirement.keys()]);
      if (storedResultsError) throw storedResultsError;

      const accessAuditRows = (storedResults || []).flatMap((row) =>
        (grantSourcedByRequirement.get(row.requirement_key) || []).map((grantId) => ({
          grant_id: grantId,
          event_type: 'accessed',
          actor_id: null,
          organization_id: input.buyer_id,
          metadata: { decision_result_id: row.id, requirement_key: row.requirement_key, evaluation_id: evaluationId },
        }))
      );
      if (accessAuditRows.length > 0) {
        const { error: auditError } = await admin.from('evidence_sharing_audit_log').insert(accessAuditRows);
        if (auditError) throw auditError;
      }
    }

    if (canonicalMatchesByRequirement.size > 0) {
      const { data: storedCanonicalResults, error: canonicalResultError } = await admin.from('compliance_decision_results')
        .select('id,requirement_key,requirement_version_id,legacy_mapping_id').eq('evaluation_id',evaluationId)
        .in('requirement_key',[...canonicalMatchesByRequirement.keys()]);
      if (canonicalResultError) throw canonicalResultError;
      const linkRows = (storedCanonicalResults || []).flatMap((row) => (canonicalMatchesByRequirement.get(row.requirement_key) || []).map((match) => ({
        requirement_version_id: row.requirement_version_id, legacy_mapping_id: row.legacy_mapping_id,
        buyer_id: input.buyer_id, subject_type: input.subject_type, subject_id: input.subject_id,
        evidence_version_id: match.evidenceVersionId, decision_result_id: row.id, match_outcome: 'eligible',
        match_score: match.score, match_reasons: match.reasons, scope_result: match.scopeResult, validation_result: match.validationResult,
      })));
      if (linkRows.length) { const { error: linkError } = await admin.from('requirement_evidence_links').insert(linkRows); if (linkError) throw linkError; }
    }

    logEvent('info', 'compliance_decision_completed', context, {
      evaluation_id: evaluationId,
      actor_id: actorId,
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
