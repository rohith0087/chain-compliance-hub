import { z } from 'zod';

// Reference implementation only. Field names/shape are a reasonable
// approximation of a CPSC eFiling submission and are NOT yet validated
// against the official CPSC eFiling XML schema -- that reconciliation, plus
// publishing the underlying US-CPSC requirement catalog, is a content/legal
// decision tracked separately from this engineering scaffold. The
// `regulatory_packs` row for CPSC-EFILING stays status='draft' until both
// are done, so this code path is exercised by tests but never reachable by
// a real buyer yet.
export const CPSC_EFILING_SCHEMA_VERSION = 'v1';

export const cpscEfilingStatementSchema = z.object({
  requirement_key: z.string(),
  title: z.string(),
  outcome: z.string(),
  citation: z.string().nullable(),
  evidence_claim_ids: z.array(z.string().uuid()),
}).strict();

export const cpscEfilingPayloadV1Schema = z.object({
  schema_version: z.literal('v1'),
  subject_type: z.enum(['supplier', 'facility', 'product']),
  subject_id: z.string().uuid(),
  dossier_id: z.string().uuid(),
  dossier_version_number: z.number().int().positive(),
  content_hash: z.string().min(1),
  certifier_name: z.string().min(1),
  certifier_contact_email: z.string().email(),
  product_description: z.string().min(1),
  statements: z.array(cpscEfilingStatementSchema).min(1),
}).strict();

export type CpscEfilingPayloadV1 = z.infer<typeof cpscEfilingPayloadV1Schema>;

export interface CpscEfilingSourceStatement {
  framework_code: string;
  requirement_key: string;
  title: string;
  outcome: string;
  citation: string | null;
  evidence_claim_ids: string[];
}

export interface CpscEfilingSourceSnapshot {
  subject_type: 'supplier' | 'facility' | 'product';
  subject_id: string;
  dossier_id: string;
  version_number: number;
  content_hash: string;
  subject_display_name: string;
  certifier_contact_email: string | null;
  statements: CpscEfilingSourceStatement[];
}

export interface CpscEfilingTransformResult {
  payload: unknown;
  valid: boolean;
  errors: string[];
}

export function transformToCpscEfilingV1(input: CpscEfilingSourceSnapshot): CpscEfilingTransformResult {
  const cpscStatements = input.statements.filter((statement) => statement.framework_code === 'US-CPSC');

  const payload = {
    schema_version: CPSC_EFILING_SCHEMA_VERSION,
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    dossier_id: input.dossier_id,
    dossier_version_number: input.version_number,
    content_hash: input.content_hash,
    certifier_name: input.subject_display_name,
    certifier_contact_email: input.certifier_contact_email ?? '',
    product_description: input.subject_display_name,
    statements: cpscStatements.map((statement) => ({
      requirement_key: statement.requirement_key,
      title: statement.title,
      outcome: statement.outcome,
      citation: statement.citation,
      evidence_claim_ids: statement.evidence_claim_ids,
    })),
  };

  const result = cpscEfilingPayloadV1Schema.safeParse(payload);
  return {
    payload,
    valid: result.success,
    errors: result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  };
}
