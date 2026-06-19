import { z } from 'zod';
import { subjectTypeSchema } from '../requirements/contracts.ts';

export const DOSSIER_GENERATOR_VERSION = 'dossier-v1';

export const generateDossierRequestV1Schema = z.object({
  buyer_id: z.string().uuid(),
  subject_type: subjectTypeSchema,
  subject_id: z.string().uuid(),
  effective_at: z.string().date(),
}).strict();
export type GenerateDossierRequestV1 = z.infer<typeof generateDossierRequestV1Schema>;

export const dossierEvidenceSchema = z.object({
  id: z.string().uuid(),
  document_type: z.string().nullable(),
  issuer: z.string().nullable(),
  certificate_number: z.string().nullable(),
  issue_date: z.string().nullable(),
  expiry_date: z.string().nullable(),
  status: z.string(),
}).strict();

export const dossierStatementSchema = z.object({
  decision_result_id: z.string().uuid(),
  requirement_version_id: z.string().uuid().nullable(),
  legacy_mapping_id: z.string().uuid().nullable(),
  framework_code: z.string(),
  framework_version: z.string(),
  requirement_key: z.string(),
  title: z.string(),
  outcome: z.string(),
  is_overridden: z.boolean(),
  applicability_outcome: z.string(),
  explanation: z.string(),
  citation: z.string().nullable(),
  source_url: z.string().nullable(),
  evidence_claim_ids: z.array(z.string().uuid()),
  evidence: z.array(dossierEvidenceSchema),
  decision_version: z.string(),
  effective_from: z.string().nullable(),
  effective_to: z.string().nullable(),
  evaluated_at: z.string(),
}).strict();
export type DossierStatementV1 = z.infer<typeof dossierStatementSchema>;

export const dossierContentSnapshotV1Schema = z.object({
  schema_version: z.literal('dossier-v1'),
  buyer_id: z.string().uuid(),
  subject_type: subjectTypeSchema,
  subject_id: z.string().uuid(),
  subject_display_name: z.string(),
  effective_at: z.string().date(),
  generated_at: z.string(),
  statements: z.array(dossierStatementSchema),
}).strict();
export type DossierContentSnapshotV1 = z.infer<typeof dossierContentSnapshotV1Schema>;

export const generateDossierResponseV1Schema = z.object({
  dossier_id: z.string().uuid(),
  version_id: z.string().uuid(),
  version_number: z.number().int(),
  idempotent_replay: z.boolean(),
  content_hash: z.string(),
  signature: z.string(),
  signing_key_id: z.string().uuid(),
  correlation_id: z.string(),
  content_snapshot: dossierContentSnapshotV1Schema,
}).strict();
export type GenerateDossierResponseV1 = z.infer<typeof generateDossierResponseV1Schema>;
