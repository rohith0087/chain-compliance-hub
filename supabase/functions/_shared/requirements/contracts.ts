import { z } from 'zod';

export const requirementOutcomeSchema = z.enum(['applies', 'does_not_apply', 'indeterminate']);
export type RequirementOutcome = z.infer<typeof requirementOutcomeSchema>;

export const subjectTypeSchema = z.enum(['supplier', 'facility', 'product']);
export type SubjectType = z.infer<typeof subjectTypeSchema>;

const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);

export type ApplicabilityRuleV1 =
  | { all: ApplicabilityRuleV1[] }
  | { any: ApplicabilityRuleV1[] }
  | { not: ApplicabilityRuleV1 }
  | {
      fact: string;
      operator: 'eq' | 'in' | 'contains' | 'present' | 'gt' | 'gte' | 'lt' | 'lte' | 'before' | 'after';
      value?: string | number | boolean | Array<string | number | boolean>;
    };

export const applicabilityRuleSchema = z.lazy(() =>
  z.union([
    z.object({ all: z.array(applicabilityRuleSchema).min(1) }).strict(),
    z.object({ any: z.array(applicabilityRuleSchema).min(1) }).strict(),
    z.object({ not: applicabilityRuleSchema }).strict(),
    z.object({
      fact: z.string().min(1).max(128),
      operator: z.enum(['eq', 'in', 'contains', 'present', 'gt', 'gte', 'lt', 'lte', 'before', 'after']),
      value: z.union([scalarSchema, z.array(scalarSchema)]).optional(),
    }).strict(),
  ]),
) as unknown as z.ZodType<ApplicabilityRuleV1>;

export function validateApplicabilityRuleV1(rule: ApplicabilityRuleV1): string[] {
  if ('all' in rule) return rule.all.flatMap(validateApplicabilityRuleV1);
  if ('any' in rule) return rule.any.flatMap(validateApplicabilityRuleV1);
  if ('not' in rule) return validateApplicabilityRuleV1(rule.not);

  if (rule.operator === 'present') {
    return rule.value === undefined ? [] : [`${rule.fact}: present does not accept a value`];
  }
  if (rule.value === undefined) return [`${rule.fact}: ${rule.operator} requires a value`];
  if (rule.operator === 'in' && !Array.isArray(rule.value)) return [`${rule.fact}: in requires an array value`];
  if (rule.operator !== 'in' && Array.isArray(rule.value)) return [`${rule.fact}: ${rule.operator} requires a scalar value`];
  if (['gt', 'gte', 'lt', 'lte'].includes(rule.operator) && typeof rule.value !== 'number') {
    return [`${rule.fact}: ${rule.operator} requires a numeric value`];
  }
  if (['before', 'after'].includes(rule.operator) && (
    typeof rule.value !== 'string' || Number.isNaN(Date.parse(rule.value))
  )) return [`${rule.fact}: ${rule.operator} requires a valid date value`];
  return [];
}

export const requiredEvidenceDefinitionSchema = z.object({
  type: z.enum(['document', 'data', 'label', 'attestation']),
  document_type: z.string().min(1).max(100),
  name: z.string().min(1).max(240),
  description: z.string().max(2000).optional(),
  required_fields: z.array(z.string().min(1).max(128)).optional(),
  required_standards: z.array(z.string().min(1).max(200)).optional(),
  jurisdiction: z.string().min(2).max(100).optional(),
}).strict();
export type RequiredEvidenceDefinitionV1 = z.infer<typeof requiredEvidenceDefinitionSchema>;

export const requirementFactsSchema = z.object({
  destination_country: z.string().length(2).transform((value) => value.toUpperCase()).optional(),
  is_children_product: z.boolean().optional(),
  intended_user_age_max: z.number().int().min(0).max(120).optional(),
  consumer_product_under_cpsc: z.boolean().optional(),
  subject_to_cpsc_rule: z.boolean().optional(),
  applicable_rule_ids: z.array(z.string().min(1).max(100)).max(100).optional(),
  domestic_import_status: z.enum(['domestic', 'imported']).optional(),
  import_entry_mode: z.enum(['general', 'foreign_trade_zone']).optional(),
}).strict();

export const requirementEvaluationRequestV1Schema = z.object({
  buyer_id: z.string().uuid(),
  subject_type: subjectTypeSchema,
  subject_id: z.string().uuid(),
  effective_at: z.string().date(),
  facts: requirementFactsSchema,
}).strict();
export type RequirementEvaluationRequestV1 = z.infer<typeof requirementEvaluationRequestV1Schema>;

export const requirementEvaluationResultV1Schema = z.object({
  requirement_version_id: z.string().uuid().nullable().optional(),
  legacy_mapping_id: z.string().uuid().nullable().optional(),
  framework_code: z.string(),
  framework_version: z.string(),
  requirement_key: z.string(),
  title: z.string(),
  outcome: requirementOutcomeSchema,
  explanation: z.string(),
  matched_facts: z.record(z.unknown()),
  missing_inputs: z.array(z.string()),
  citation: z.string().nullable().optional(),
  source_url: z.string().url().nullable().optional(),
  required_evidence: z.array(requiredEvidenceDefinitionSchema),
  effective_from: z.string().date().nullable().optional(),
  effective_to: z.string().date().nullable().optional(),
}).strict();
export type RequirementEvaluationResultV1 = z.infer<typeof requirementEvaluationResultV1Schema>;

export const requirementEvaluationResponseV1Schema = z.object({
  evaluation_id: z.string().uuid(),
  idempotent_replay: z.boolean(),
  evaluator_version: z.string(),
  correlation_id: z.string(),
  subject_type: subjectTypeSchema,
  subject_id: z.string().uuid(),
  effective_at: z.string().date(),
  results: z.array(requirementEvaluationResultV1Schema),
}).strict();
export type RequirementEvaluationResponseV1 = z.infer<typeof requirementEvaluationResponseV1Schema>;
