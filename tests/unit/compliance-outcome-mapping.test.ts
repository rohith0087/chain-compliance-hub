import { describe, expect, it } from 'vitest';
import { deriveComplianceOutcome, type CoverageState } from '../../supabase/functions/_shared/compliance/outcome';

const noCoverage: CoverageState = {
  hasVerifiedClaim: false,
  verifiedExpiryDate: null,
  hasRejectedClaim: false,
  hasUnverifiedClaim: false,
  hasUpload: false,
  hasOpenRequest: false,
};

describe('compliance outcome mapping', () => {
  it('maps does_not_apply to not_applicable regardless of evidence', () => {
    expect(deriveComplianceOutcome('does_not_apply', true, noCoverage, '2026-06-18').outcome).toBe('not_applicable');
  });

  it('maps indeterminate applicability to missing', () => {
    expect(deriveComplianceOutcome('indeterminate', true, noCoverage, '2026-06-18').outcome).toBe('missing');
  });

  it('is compliant immediately when applies and no evidence is required', () => {
    expect(deriveComplianceOutcome('applies', false, noCoverage, '2026-06-18').outcome).toBe('compliant');
  });

  it('is missing when applies, evidence required, and nothing has happened yet', () => {
    expect(deriveComplianceOutcome('applies', true, noCoverage, '2026-06-18').outcome).toBe('missing');
  });

  it('is requested when an open document request exists but nothing uploaded', () => {
    const coverage: CoverageState = { ...noCoverage, hasOpenRequest: true };
    expect(deriveComplianceOutcome('applies', true, coverage, '2026-06-18').outcome).toBe('requested');
  });

  it('is submitted when a document was uploaded but no structured claim extracted yet', () => {
    const coverage: CoverageState = { ...noCoverage, hasOpenRequest: true, hasUpload: true };
    expect(deriveComplianceOutcome('applies', true, coverage, '2026-06-18').outcome).toBe('submitted');
  });

  it('is under_review when an unverified claim exists', () => {
    const coverage: CoverageState = { ...noCoverage, hasUpload: true, hasUnverifiedClaim: true };
    expect(deriveComplianceOutcome('applies', true, coverage, '2026-06-18').outcome).toBe('under_review');
  });

  it('is noncompliant when a claim was rejected, even if an unverified claim also exists', () => {
    const coverage: CoverageState = { ...noCoverage, hasRejectedClaim: true, hasUnverifiedClaim: true };
    expect(deriveComplianceOutcome('applies', true, coverage, '2026-06-18').outcome).toBe('noncompliant');
  });

  it('is compliant when a verified claim has no expiry date', () => {
    const coverage: CoverageState = { ...noCoverage, hasVerifiedClaim: true, verifiedExpiryDate: null };
    expect(deriveComplianceOutcome('applies', true, coverage, '2026-06-18').outcome).toBe('compliant');
  });

  it('is compliant when a verified claim expires after the evaluation date', () => {
    const coverage: CoverageState = { ...noCoverage, hasVerifiedClaim: true, verifiedExpiryDate: '2027-01-01' };
    expect(deriveComplianceOutcome('applies', true, coverage, '2026-06-18').outcome).toBe('compliant');
  });

  it('is expired when a verified claim expired before the evaluation date', () => {
    const coverage: CoverageState = { ...noCoverage, hasVerifiedClaim: true, verifiedExpiryDate: '2026-01-01' };
    expect(deriveComplianceOutcome('applies', true, coverage, '2026-06-18').outcome).toBe('expired');
  });

  it('never returns conditional - that only exists as a human-approved override', () => {
    const allCoverageStates: CoverageState[] = [
      noCoverage,
      { ...noCoverage, hasOpenRequest: true },
      { ...noCoverage, hasUpload: true },
      { ...noCoverage, hasUnverifiedClaim: true },
      { ...noCoverage, hasRejectedClaim: true },
      { ...noCoverage, hasVerifiedClaim: true, verifiedExpiryDate: null },
      { ...noCoverage, hasVerifiedClaim: true, verifiedExpiryDate: '2020-01-01' },
    ];
    for (const coverage of allCoverageStates) {
      for (const applicability of ['applies', 'does_not_apply', 'indeterminate'] as const) {
        for (const hasRequiredEvidence of [true, false]) {
          expect(deriveComplianceOutcome(applicability, hasRequiredEvidence, coverage, '2026-06-18').outcome).not.toBe('conditional');
        }
      }
    }
  });
});
