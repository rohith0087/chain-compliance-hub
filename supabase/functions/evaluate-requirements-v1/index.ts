import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import {
  applicabilityRuleSchema,
  requirementEvaluationRequestV1Schema,
  requirementEvaluationResponseV1Schema,
  requiredEvidenceDefinitionSchema,
  validateApplicabilityRuleV1,
  type RequirementEvaluationResultV1,
  type SubjectType,
} from '../_shared/requirements/contracts.ts';
import { evaluateApplicabilityRule, REQUIREMENT_EVALUATOR_VERSION } from '../_shared/requirements/evaluator.ts';
import { adaptLegacyRequirement, legacyRequirementKey, type LegacyRequirementSource } from '../_shared/requirements/legacyAdapter.ts';
import { parseIdempotencyKey, requirementRequestHash } from '../_shared/requirements/requestContract.ts';
import { normalizeRequirementFacts } from '../_shared/requirements/facts.ts';

type SupabaseAdmin = ReturnType<typeof createClient>;

interface SubjectContext {
  subject: Record<string, unknown>;
  supplierId: string;
}

interface LegacyLoadResult {
  results: RequirementEvaluationResultV1[];
  sourceCount: number;
}

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

async function hasBuyerAccess(admin: SupabaseAdmin, userId: string, buyerId: string): Promise<boolean> {
  const [{ data: owner }, { data: member }, { data: platformAdmin }] = await Promise.all([
    admin.from('buyers').select('id').eq('id', buyerId).eq('profile_id', userId).maybeSingle(),
    admin.from('company_users').select('id').eq('profile_id', userId).eq('company_id', buyerId)
      .eq('company_type', 'buyer').eq('status', 'active').limit(1).maybeSingle(),
    admin.from('platform_administrators').select('id').eq('auth_user_id', userId).eq('is_active', true)
      .limit(1).maybeSingle(),
  ]);
  return Boolean(owner || member || platformAdmin);
}

async function isFeatureEnabled(admin: SupabaseAdmin, buyerId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const [{ data: catalog }, { data: override }] = await Promise.all([
    admin.from('feature_flags').select('default_enabled').eq('key', 'compliance_requirements_v1').maybeSingle(),
    admin.from('organization_feature_flags').select('enabled, expires_at')
      .eq('organization_id', buyerId).eq('organization_type', 'buyer')
      .eq('feature_key', 'compliance_requirements_v1').maybeSingle(),
  ]);
  if (override && (!override.expires_at || override.expires_at > now)) return override.enabled === true;
  return catalog?.default_enabled === true;
}

async function hasApprovedConnection(admin: SupabaseAdmin, buyerId: string, supplierId: string): Promise<boolean> {
  const { data } = await admin.from('buyer_supplier_connections').select('id')
    .eq('buyer_id', buyerId).eq('supplier_id', supplierId).eq('status', 'approved')
    .limit(1).maybeSingle();
  return Boolean(data);
}

async function loadSubject(
  admin: SupabaseAdmin,
  buyerId: string,
  subjectType: SubjectType,
  subjectId: string,
): Promise<SubjectContext | null> {
  if (subjectType === 'supplier') {
    const { data } = await admin.from('suppliers').select('*').eq('id', subjectId).maybeSingle();
    if (!data || !(await hasApprovedConnection(admin, buyerId, data.id))) return null;
    return { subject: data, supplierId: data.id };
  }

  if (subjectType === 'facility') {
    const { data } = await admin.from('company_branches').select('*').eq('id', subjectId)
      .eq('company_type', 'supplier').maybeSingle();
    if (!data || !(await hasApprovedConnection(admin, buyerId, data.company_id))) return null;
    return { subject: data, supplierId: data.company_id };
  }

  const { data } = await admin.from('supplier_items').select('*').eq('id', subjectId).eq('is_active', true).maybeSingle();
  if (!data || !(await hasApprovedConnection(admin, buyerId, data.supplier_id))) return null;
  return { subject: data, supplierId: data.supplier_id };
}

async function loadCatalogResults(
  admin: SupabaseAdmin,
  buyerId: string,
  subjectType: SubjectType,
  effectiveAt: string,
  facts: Record<string, unknown>,
): Promise<RequirementEvaluationResultV1[]> {
  const { data: frameworks, error: frameworkError } = await admin.from('requirement_frameworks')
    .select('id, code, owner_buyer_id');
  if (frameworkError) throw frameworkError;

  const accessibleFrameworks = (frameworks || []).filter((framework) =>
    framework.owner_buyer_id === null || framework.owner_buyer_id === buyerId
  );
  if (accessibleFrameworks.length === 0) return [];

  const frameworkById = new Map(accessibleFrameworks.map((framework) => [framework.id, framework]));
  const { data: frameworkVersions, error: versionError } = await admin.from('requirement_framework_versions')
    .select('id, framework_id, version, effective_from, effective_to')
    .in('framework_id', accessibleFrameworks.map((framework) => framework.id))
    .eq('status', 'published')
    .lte('effective_from', effectiveAt)
    .or(`effective_to.is.null,effective_to.gte.${effectiveAt}`);
  if (versionError) throw versionError;
  if (!frameworkVersions?.length) return [];

  const frameworkVersionById = new Map(frameworkVersions.map((version) => [version.id, version]));
  const { data: versions, error: requirementVersionError } = await admin.from('requirement_versions')
    .select('*')
    .in('framework_version_id', frameworkVersions.map((version) => version.id))
    .lte('effective_from', effectiveAt)
    .or(`effective_to.is.null,effective_to.gte.${effectiveAt}`);
  if (requirementVersionError) throw requirementVersionError;
  if (!versions?.length) return [];

  const requirementIds = [...new Set(versions.map((version) => version.requirement_id))];
  const { data: requirements, error: requirementsError } = await admin.from('requirements')
    .select('id, stable_key, subject_types').in('id', requirementIds);
  if (requirementsError) throw requirementsError;
  const requirementById = new Map((requirements || []).map((requirement) => [requirement.id, requirement]));

  return versions.flatMap((version): RequirementEvaluationResultV1[] => {
    const requirement = requirementById.get(version.requirement_id);
    const frameworkVersion = frameworkVersionById.get(version.framework_version_id);
    const framework = frameworkVersion ? frameworkById.get(frameworkVersion.framework_id) : undefined;
    if (!requirement || !frameworkVersion || !framework || !requirement.subject_types.includes(subjectType)) return [];

    const parsedRule = applicabilityRuleSchema.safeParse(version.applicability_rule);
    const parsedEvidence = requiredEvidenceDefinitionSchema.array().safeParse(version.required_evidence);
    if (!parsedRule.success || !parsedEvidence.success
      || validateApplicabilityRuleV1(parsedRule.data).length > 0) {
      throw new Error(`Published requirement ${requirement.stable_key} has invalid contract data`);
    }

    const evaluation = evaluateApplicabilityRule(parsedRule.data, facts);
    return [{
      requirement_version_id: version.id,
      legacy_mapping_id: null,
      framework_code: framework.code,
      framework_version: frameworkVersion.version,
      requirement_key: requirement.stable_key,
      title: version.title,
      outcome: evaluation.outcome,
      explanation: `${version.explanation_template} ${evaluation.explanation}`,
      matched_facts: evaluation.matchedFacts,
      missing_inputs: evaluation.missingInputs,
      citation: version.citation,
      source_url: version.source_url,
      required_evidence: parsedEvidence.data,
      effective_from: version.effective_from,
      effective_to: version.effective_to,
    }];
  });
}

async function loadLegacyResults(
  admin: SupabaseAdmin,
  buyerId: string,
  subjectType: SubjectType,
  supplierId: string,
): Promise<LegacyLoadResult> {
  const { data: defaults, error: defaultError } = await admin.from('default_document_requirements')
    .select('id, document_type, document_name, description, is_required').eq('buyer_id', buyerId)
    .order('display_order');
  if (defaultError) throw defaultError;

  const { data: onboardingRequests, error: onboardingError } = await admin.from('supplier_onboarding_requests')
    .select('id').eq('buyer_id', buyerId).eq('supplier_id', supplierId);
  if (onboardingError) throw onboardingError;

  let onboardingRequirements: Array<Record<string, unknown>> = [];
  if (onboardingRequests?.length) {
    const { data, error } = await admin.from('onboarding_document_requirements')
      .select('id, document_type, document_name, description, is_required')
      .in('onboarding_request_id', onboardingRequests.map((request) => request.id));
    if (error) throw error;
    onboardingRequirements = data || [];
  }

  const combined: LegacyRequirementSource[] = [
    ...(defaults || []).map((item) => ({ ...item, source_type: 'default_document_requirement' })),
    ...onboardingRequirements.map((item) => ({ ...item, source_type: 'onboarding_document_requirement' })),
  ];

  const unique = new Map<string, LegacyRequirementSource>();
  for (const item of combined) unique.set(`${item.document_type}:${item.document_name}`, item);

  const results: RequirementEvaluationResultV1[] = [];
  for (const item of unique.values()) {
    const key = legacyRequirementKey(item.document_type);
    const evidence = {
      type: 'document' as const,
      document_type: String(item.document_type),
      name: String(item.document_name),
      ...(item.description ? { description: String(item.description) } : {}),
    };
    const { data: mapping, error } = await admin.from('legacy_requirement_mappings').upsert({
      buyer_id: buyerId,
      source_type: item.source_type,
      source_id: item.id,
      requirement_key: key,
      evidence_definition: evidence,
    }, { onConflict: 'buyer_id,source_type,source_id' }).select('id').single();
    if (error) throw error;

    results.push(adaptLegacyRequirement(item, mapping.id));
  }
  return { results, sourceCount: combined.length };
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
    if (!(await isFeatureEnabled(admin, input.buyer_id))) {
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
      loadCatalogResults(admin, input.buyer_id, input.subject_type, input.effective_at, facts),
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
