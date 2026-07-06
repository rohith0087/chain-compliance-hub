import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import {
  applicabilityRuleSchema,
  requiredEvidenceDefinitionSchema,
  validateApplicabilityRuleV1,
  type RequirementEvaluationResultV1,
  type SubjectType,
} from './contracts.ts';
import { evaluateApplicabilityRule } from './evaluator.ts';
import {
  adaptLegacyRequirement,
  deduplicateLegacyRequirements,
  legacyRequirementKey,
  type LegacyRequirementSource,
} from './legacyAdapter.ts';

type SupabaseAdmin = ReturnType<typeof createClient>;

export interface SubjectContext {
  subject: Record<string, unknown>;
  supplierId: string;
}

export interface LegacyLoadResult {
  results: RequirementEvaluationResultV1[];
  sourceCount: number;
}

export async function hasBuyerAccess(admin: SupabaseAdmin, userId: string, buyerId: string): Promise<boolean> {
  const [{ data: owner }, { data: member }, { data: platformAdmin }] = await Promise.all([
    admin.from('buyers').select('id').eq('id', buyerId).eq('profile_id', userId).maybeSingle(),
    admin.from('company_users').select('id').eq('profile_id', userId).eq('company_id', buyerId)
      .eq('company_type', 'buyer').eq('status', 'active').limit(1).maybeSingle(),
    admin.from('platform_administrators').select('id').eq('auth_user_id', userId).eq('is_active', true)
      .limit(1).maybeSingle(),
  ]);
  return Boolean(owner || member || platformAdmin);
}

export async function hasApprovedConnection(admin: SupabaseAdmin, buyerId: string, supplierId: string): Promise<boolean> {
  const { data } = await admin.from('buyer_supplier_connections').select('id')
    .eq('buyer_id', buyerId).eq('supplier_id', supplierId).eq('status', 'approved')
    .limit(1).maybeSingle();
  return Boolean(data);
}

export async function loadSubject(
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

export async function loadCatalogResults(
  admin: SupabaseAdmin,
  buyerId: string,
  subjectType: SubjectType,
  effectiveAt: string,
  facts: Record<string, unknown>,
  supplierId?: string,
): Promise<RequirementEvaluationResultV1[]> {
  const [{ data: frameworks, error: frameworkError }, { data: activations, error: activationError }] = await Promise.all([
    admin.from('requirement_frameworks').select('id, code, owner_buyer_id'),
    admin.from('buyer_framework_activations').select('framework_id, supplier_id')
      .eq('buyer_id', buyerId).is('deactivated_at', null),
  ]);
  if (frameworkError) throw frameworkError;
  if (activationError) throw activationError;

  // Global frameworks are opt-in: they only apply where the buyer activated
  // them (buyer-wide when supplier_id is null, else for that supplier). The
  // buyer's own custom frameworks always apply, as before.
  const activatedFrameworkIds = new Set(
    (activations || [])
      .filter((activation) => activation.supplier_id === null
        || (supplierId !== undefined && activation.supplier_id === supplierId))
      .map((activation) => activation.framework_id),
  );
  const accessibleFrameworks = (frameworks || []).filter((framework) =>
    framework.owner_buyer_id === buyerId
    || (framework.owner_buyer_id === null && activatedFrameworkIds.has(framework.id))
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

export async function loadLegacyResults(
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

  const results: RequirementEvaluationResultV1[] = [];
  for (const item of deduplicateLegacyRequirements(combined)) {
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
