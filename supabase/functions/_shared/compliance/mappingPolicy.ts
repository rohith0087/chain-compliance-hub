import type { OutcomeResult } from './outcome.ts';

// Phase 3 (plasma_clone/update.md): per-mapping human decisions layered on top
// of machine matching. A mapping is one (requirement, evidence version) pair.
// Machine matching proposes; only a human decision makes a mapping approved or
// rejected. Rejected mappings exclude that evidence for that requirement even
// if it is machine-eligible; in strict mode, evidence without an approved
// mapping cannot make a requirement compliant.

export type MappingStatus = 'proposed' | 'approved' | 'rejected';

export interface RequirementEvidenceMapping {
  id: string;
  framework_code: string;
  requirement_key: string;
  evidence_version_id: string;
  status: MappingStatus;
  decided_by: string | null;
  decided_at: string | null;
}

export function mappingKey(frameworkCode: string, requirementKey: string): string {
  return `${frameworkCode}::${requirementKey}`;
}

export function groupMappings(
  mappings: RequirementEvidenceMapping[],
): Map<string, RequirementEvidenceMapping[]> {
  const grouped = new Map<string, RequirementEvidenceMapping[]>();
  for (const mapping of mappings) {
    const key = mappingKey(mapping.framework_code, mapping.requirement_key);
    grouped.set(key, [...(grouped.get(key) || []), mapping]);
  }
  return grouped;
}

export function rejectedVersionIds(
  mappings: RequirementEvidenceMapping[] | undefined,
): Set<string> {
  return new Set((mappings || [])
    .filter((mapping) => mapping.status === 'rejected')
    .map((mapping) => mapping.evidence_version_id));
}

export function findMappingForVersion(
  mappings: RequirementEvidenceMapping[] | undefined,
  evidenceVersionId: string,
): RequirementEvidenceMapping | undefined {
  return (mappings || []).find((mapping) => mapping.evidence_version_id === evidenceVersionId);
}

export interface MappingPolicyInput {
  requireMappingApproval: boolean;
  usedMapping: RequirementEvidenceMapping | undefined;
  reviewerName?: string | null;
  validUntil?: string | null;
}

/**
 * Adjusts a computed outcome for the mapping-approval policy.
 *
 * - Approved mapping backing a compliant outcome -> append the chain sentence
 *   ("approved evidence satisfies this rule until <date>").
 * - Strict mode + compliant outcome whose evidence mapping is not approved ->
 *   downgrade to under_review awaiting a human mapping decision.
 * - Everything else passes through unchanged.
 */
export function applyMappingPolicy(
  result: OutcomeResult,
  input: MappingPolicyInput,
): OutcomeResult {
  if (result.outcome !== 'compliant') return result;

  if (input.usedMapping?.status === 'approved') {
    const reviewer = input.reviewerName ? ` by ${input.reviewerName}` : '';
    const until = input.validUntil ? ` until ${input.validUntil}` : '';
    return {
      outcome: 'compliant',
      explanation: `${result.explanation} Compliant because this approved evidence mapping${reviewer} satisfies this requirement${until}.`,
    };
  }

  if (input.requireMappingApproval && input.usedMapping?.status !== 'approved') {
    return {
      outcome: 'under_review',
      explanation: `${result.explanation} Awaiting reviewer approval of the requirement-evidence mapping before this requirement can be marked compliant.`,
    };
  }

  return result;
}
