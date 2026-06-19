export type EvidenceSharingPurpose = 'compliance_decision' | 'audit_review' | 'due_diligence';

export interface EvidenceSharingGrant {
  id: string;
  owner_organization_id: string;
  granted_to_organization_id: string;
  claim_id: string | null;
  document_type: string | null;
  purpose: EvidenceSharingPurpose;
  status: 'active' | 'revoked';
  expires_at: string | null;
}

export interface GrantableClaim {
  id: string;
  supplier_id: string;
  document_type: string | null;
}

export function normalizeDocType(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

export function isGrantActive(grant: EvidenceSharingGrant, now: string): boolean {
  if (grant.status !== 'active') return false;
  if (grant.expires_at && grant.expires_at <= now) return false;
  return true;
}

/**
 * A claim is in scope for a grant if the grant's owner is the claim's
 * supplier, and either the grant names this exact claim, or the grant's
 * document_type matches the claim's (normalized) document_type. Purpose is
 * deliberately not checked here -- visibility and decision-eligibility are
 * separate concerns; callers that need decision-eligibility should also
 * filter grants by purpose before calling this.
 */
export function matchesGrant(claim: GrantableClaim, grant: EvidenceSharingGrant): boolean {
  if (claim.supplier_id !== grant.owner_organization_id) return false;
  if (grant.claim_id) return grant.claim_id === claim.id;
  if (grant.document_type) return normalizeDocType(claim.document_type) === normalizeDocType(grant.document_type);
  return false;
}
