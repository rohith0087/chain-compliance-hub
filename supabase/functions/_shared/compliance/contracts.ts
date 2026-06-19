import { z } from 'zod';

export const DECISION_ENGINE_VERSION = 'compliance-decision-v1';

export const complianceOutcomeSchema = z.enum([
  'missing', 'requested', 'submitted', 'under_review', 'compliant',
  'conditional', 'noncompliant', 'expired', 'not_applicable',
]);
export type ComplianceOutcome = z.infer<typeof complianceOutcomeSchema>;

export const complianceDecisionResultV1Schema = z.object({
  requirement_version_id: z.string().uuid().nullable().optional(),
  legacy_mapping_id: z.string().uuid().nullable().optional(),
  framework_code: z.string(),
  framework_version: z.string(),
  requirement_key: z.string(),
  title: z.string(),
  applicability_outcome: z.enum(['applies', 'does_not_apply', 'indeterminate']),
  outcome: complianceOutcomeSchema,
  explanation: z.string(),
  evidence_claim_ids: z.array(z.string().uuid()),
  decision_version: z.string(),
  effective_from: z.string().date().nullable().optional(),
  effective_to: z.string().date().nullable().optional(),
}).strict();
export type ComplianceDecisionResultV1 = z.infer<typeof complianceDecisionResultV1Schema>;

export const complianceDecisionResponseV1Schema = z.object({
  evaluation_id: z.string().uuid(),
  idempotent_replay: z.boolean(),
  evaluator_version: z.string(),
  correlation_id: z.string(),
  subject_type: z.enum(['supplier', 'facility', 'product']),
  subject_id: z.string().uuid(),
  effective_at: z.string().date(),
  results: z.array(complianceDecisionResultV1Schema),
}).strict();
export type ComplianceDecisionResponseV1 = z.infer<typeof complianceDecisionResponseV1Schema>;
