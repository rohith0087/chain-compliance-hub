import { describe, expect, it } from 'vitest';
import { matchCanonicalEvidence, type CanonicalCoverageData } from '../../supabase/functions/_shared/compliance/canonicalCoverage';
import {
  applyMappingPolicy, findMappingForVersion, groupMappings, mappingKey, rejectedVersionIds,
  type RequirementEvidenceMapping,
} from '../../supabase/functions/_shared/compliance/mappingPolicy';

const required = [{
  type: 'document' as const,
  document_type: 'ISO 9001 Certificate',
  name: 'ISO certificate',
  required_fields: ['certificate_number'],
}];

const coverageData: CanonicalCoverageData = {
  records: [{ id: 'record-1', canonical_document_type: 'iso_certificate' }],
  versions: [{
    id: 'version-1', evidence_record_id: 'record-1', lifecycle_status: 'current', expiry_date: '2027-12-31',
    covered_product_ids: [], covered_facility_ids: [], validation_completeness: 1, legacy_evidence_claim_id: 'claim-1',
  }],
  attestations: [{ evidence_version_id: 'version-1', attestation_type: 'supplier_verification', outcome: 'accepted' }],
  validations: [{ evidence_version_id: 'version-1', status: 'passed', created_at: '2026-06-19' }],
  grants: [{ id: 'grant-1', evidence_version_id: 'version-1', status: 'active', expires_at: '2027-12-31' }],
  requestLinks: [],
  observations: [{ evidence_version_id: 'version-1', field_name: 'certificate_number' }],
};

const mapping = (overrides: Partial<RequirementEvidenceMapping>): RequirementEvidenceMapping => ({
  id: 'mapping-1', framework_code: 'SQF', requirement_key: 'SQF-FOOD-SAFETY-CERT',
  evidence_version_id: 'version-1', status: 'proposed', decided_by: null, decided_at: null,
  ...overrides,
});

describe('rejected mapping exclusion in canonical matching', () => {
  it('matches normally when nothing is excluded', () => {
    const result = matchCanonicalEvidence(required, coverageData, 'supplier', 'supplier-1', '2026-07-03');
    expect(result.matches).toHaveLength(1);
    expect(result.coverage.hasVerifiedClaim).toBe(true);
  });

  it('excludes reviewer-rejected evidence versions even when machine-eligible', () => {
    const excluded = rejectedVersionIds([mapping({ status: 'rejected' })]);
    const result = matchCanonicalEvidence(required, coverageData, 'supplier', 'supplier-1', '2026-07-03', {}, excluded);
    expect(result.matches).toHaveLength(0);
    expect(result.coverage.hasVerifiedClaim).toBe(false);
  });

  it('does not exclude for approved or proposed mappings', () => {
    expect(rejectedVersionIds([mapping({ status: 'approved' })]).size).toBe(0);
    expect(rejectedVersionIds([mapping({ status: 'proposed' })]).size).toBe(0);
    expect(rejectedVersionIds(undefined).size).toBe(0);
  });
});

describe('mapping grouping and lookup', () => {
  it('groups by framework and requirement key', () => {
    const grouped = groupMappings([
      mapping({ id: 'a' }),
      mapping({ id: 'b', requirement_key: 'SQF-HACCP-PLAN' }),
      mapping({ id: 'c', framework_code: 'HACCP', requirement_key: 'HACCP-PLAN' }),
    ]);
    expect(grouped.get(mappingKey('SQF', 'SQF-FOOD-SAFETY-CERT'))).toHaveLength(1);
    expect(grouped.get(mappingKey('SQF', 'SQF-HACCP-PLAN'))).toHaveLength(1);
    expect(grouped.get(mappingKey('HACCP', 'HACCP-PLAN'))).toHaveLength(1);
  });

  it('finds a mapping by evidence version', () => {
    const rows = [mapping({ id: 'a' }), mapping({ id: 'b', evidence_version_id: 'version-2' })];
    expect(findMappingForVersion(rows, 'version-2')?.id).toBe('b');
    expect(findMappingForVersion(rows, 'version-3')).toBeUndefined();
    expect(findMappingForVersion(undefined, 'version-1')).toBeUndefined();
  });
});

describe('applyMappingPolicy — the chain resolver sentence and strict mode', () => {
  const compliant = { outcome: 'compliant' as const, explanation: 'Verified evidence covers this requirement and is currently valid.' };

  it('appends the approved-by sentence for approved mappings', () => {
    const result = applyMappingPolicy(compliant, {
      requireMappingApproval: true,
      usedMapping: mapping({ status: 'approved', decided_by: 'user-1', decided_at: '2026-07-03' }),
      reviewerName: 'J. Rivera',
      validUntil: '2027-12-31',
    });
    expect(result.outcome).toBe('compliant');
    expect(result.explanation).toContain('approved evidence mapping by J. Rivera');
    expect(result.explanation).toContain('until 2027-12-31');
  });

  it('downgrades compliant to under_review in strict mode without an approved mapping', () => {
    const result = applyMappingPolicy(compliant, {
      requireMappingApproval: true,
      usedMapping: mapping({ status: 'proposed' }),
    });
    expect(result.outcome).toBe('under_review');
    expect(result.explanation).toContain('Awaiting reviewer approval');
  });

  it('downgrades in strict mode when no mapping row exists yet', () => {
    const result = applyMappingPolicy(compliant, { requireMappingApproval: true, usedMapping: undefined });
    expect(result.outcome).toBe('under_review');
  });

  it('keeps compliant in permissive mode without approval', () => {
    const result = applyMappingPolicy(compliant, { requireMappingApproval: false, usedMapping: mapping({ status: 'proposed' }) });
    expect(result.outcome).toBe('compliant');
    expect(result.explanation).toBe(compliant.explanation);
  });

  it('never touches non-compliant outcomes', () => {
    const missing = { outcome: 'missing' as const, explanation: 'No evidence yet.' };
    expect(applyMappingPolicy(missing, { requireMappingApproval: true, usedMapping: undefined })).toEqual(missing);
  });

  it('handles approved mapping without reviewer name or expiry', () => {
    const result = applyMappingPolicy(compliant, {
      requireMappingApproval: false,
      usedMapping: mapping({ status: 'approved' }),
    });
    expect(result.outcome).toBe('compliant');
    expect(result.explanation).toContain('approved evidence mapping satisfies this requirement');
  });
});
