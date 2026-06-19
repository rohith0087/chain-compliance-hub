import { describe, expect, it } from 'vitest';
import { isGrantActive, matchesGrant, type EvidenceSharingGrant, type GrantableClaim } from '../../supabase/functions/_shared/compliance/grants';

const baseGrant: EvidenceSharingGrant = {
  id: 'grant-1',
  owner_organization_id: 'supplier-1',
  granted_to_organization_id: 'buyer-1',
  claim_id: null,
  document_type: null,
  purpose: 'compliance_decision',
  status: 'active',
  expires_at: null,
};

const baseClaim: GrantableClaim = {
  id: 'claim-1',
  supplier_id: 'supplier-1',
  document_type: 'Business License',
};

describe('isGrantActive', () => {
  it('is active when status is active and there is no expiry', () => {
    expect(isGrantActive(baseGrant, '2026-06-18')).toBe(true);
  });

  it('is active when the expiry date is after the evaluation date', () => {
    expect(isGrantActive({ ...baseGrant, expires_at: '2027-01-01' }, '2026-06-18')).toBe(true);
  });

  it('is inactive when the expiry date is on or before the evaluation date', () => {
    expect(isGrantActive({ ...baseGrant, expires_at: '2026-06-18' }, '2026-06-18')).toBe(false);
    expect(isGrantActive({ ...baseGrant, expires_at: '2026-01-01' }, '2026-06-18')).toBe(false);
  });

  it('is inactive when revoked, regardless of expiry', () => {
    expect(isGrantActive({ ...baseGrant, status: 'revoked' }, '2026-06-18')).toBe(false);
    expect(isGrantActive({ ...baseGrant, status: 'revoked', expires_at: '2027-01-01' }, '2026-06-18')).toBe(false);
  });
});

describe('matchesGrant', () => {
  it('matches a claim-id grant for the same claim', () => {
    const grant: EvidenceSharingGrant = { ...baseGrant, claim_id: 'claim-1' };
    expect(matchesGrant(baseClaim, grant)).toBe(true);
  });

  it('does not match a claim-id grant for a different claim', () => {
    const grant: EvidenceSharingGrant = { ...baseGrant, claim_id: 'claim-2' };
    expect(matchesGrant(baseClaim, grant)).toBe(false);
  });

  it('matches a document-type grant with normalized (trim/case-insensitive) comparison', () => {
    const grant: EvidenceSharingGrant = { ...baseGrant, document_type: '  business license  ' };
    expect(matchesGrant(baseClaim, grant)).toBe(true);
  });

  it('does not match a document-type grant for a different document type', () => {
    const grant: EvidenceSharingGrant = { ...baseGrant, document_type: 'Insurance Certificate' };
    expect(matchesGrant(baseClaim, grant)).toBe(false);
  });

  it('never matches a grant owned by a different supplier than the claim', () => {
    const claimGrant: EvidenceSharingGrant = { ...baseGrant, owner_organization_id: 'supplier-2', claim_id: 'claim-1' };
    const docTypeGrant: EvidenceSharingGrant = { ...baseGrant, owner_organization_id: 'supplier-2', document_type: 'Business License' };
    expect(matchesGrant(baseClaim, claimGrant)).toBe(false);
    expect(matchesGrant(baseClaim, docTypeGrant)).toBe(false);
  });

  it('never matches a grant with neither claim_id nor document_type set', () => {
    expect(matchesGrant(baseClaim, baseGrant)).toBe(false);
  });
});
