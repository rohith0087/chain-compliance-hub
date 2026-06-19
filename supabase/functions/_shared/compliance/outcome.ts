import type { RequirementOutcome } from '../requirements/contracts.ts';
import type { ComplianceOutcome } from './contracts.ts';

export interface CoverageState {
  hasVerifiedClaim: boolean;
  verifiedExpiryDate: string | null;
  hasRejectedClaim: boolean;
  hasUnverifiedClaim: boolean;
  hasUpload: boolean;
  hasOpenRequest: boolean;
}

export interface OutcomeResult {
  outcome: ComplianceOutcome;
  explanation: string;
}

/**
 * Deterministic mapping from Phase 1 applicability + Phase 2 evidence/legacy
 * request state into a compliance outcome. Never returns 'conditional' -
 * that outcome only exists as a human-approved override layered on top of a
 * computed result (see compliance_decision_overrides), never as something
 * this function decides on its own.
 */
export function deriveComplianceOutcome(
  applicability: RequirementOutcome,
  hasRequiredEvidence: boolean,
  coverage: CoverageState,
  effectiveAt: string,
): OutcomeResult {
  if (applicability === 'does_not_apply') {
    return { outcome: 'not_applicable', explanation: 'This requirement does not apply based on the recorded facts.' };
  }
  if (applicability === 'indeterminate') {
    return { outcome: 'missing', explanation: 'Applicability cannot be determined yet; more facts are needed.' };
  }

  // applicability === 'applies'
  if (!hasRequiredEvidence) {
    return {
      outcome: 'compliant',
      explanation: 'No evidence is required for this requirement; it is satisfied by the recorded facts alone.',
    };
  }
  if (coverage.hasVerifiedClaim) {
    if (coverage.verifiedExpiryDate && coverage.verifiedExpiryDate < effectiveAt) {
      return {
        outcome: 'expired',
        explanation: `Verified evidence expired on ${coverage.verifiedExpiryDate}, before the evaluation date ${effectiveAt}.`,
      };
    }
    return { outcome: 'compliant', explanation: 'Verified evidence covers this requirement and is currently valid.' };
  }
  if (coverage.hasRejectedClaim) {
    return { outcome: 'noncompliant', explanation: 'Submitted evidence for this requirement was reviewed and rejected.' };
  }
  if (coverage.hasUnverifiedClaim) {
    return {
      outcome: 'under_review',
      explanation: 'Evidence has been extracted from an uploaded document and is awaiting human verification.',
    };
  }
  if (coverage.hasUpload) {
    return {
      outcome: 'submitted',
      explanation: 'A document has been uploaded for this requirement; structured evidence has not been extracted yet.',
    };
  }
  if (coverage.hasOpenRequest) {
    return {
      outcome: 'requested',
      explanation: 'This requirement has been requested from the supplier but no document has been uploaded yet.',
    };
  }
  return { outcome: 'missing', explanation: 'This requirement applies but no evidence has been requested or submitted yet.' };
}
