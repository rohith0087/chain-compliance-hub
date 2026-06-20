import { describe, expect, it } from 'vitest';
import { canonicalDocumentType, matchCanonicalEvidence, type CanonicalCoverageData } from '../../supabase/functions/_shared/compliance/canonicalCoverage';

const required = [{ type: 'document' as const, document_type: 'ISO 9001 Certificate', name: 'ISO certificate', required_fields: ['certificate_number'] }];
const base: CanonicalCoverageData = {
  records: [{ id: 'record-1', canonical_document_type: 'iso_certificate' }],
  versions: [{ id: 'version-1', evidence_record_id: 'record-1', lifecycle_status: 'current', expiry_date: '2027-12-31', covered_product_ids: [], covered_facility_ids: [], validation_completeness: 1, legacy_evidence_claim_id: 'claim-1' }],
  attestations: [{ evidence_version_id: 'version-1', attestation_type: 'supplier_verification', outcome: 'accepted' }],
  validations: [{ evidence_version_id: 'version-1', status: 'passed', created_at: '2026-06-19' }],
  grants: [{ id: 'grant-1', evidence_version_id: 'version-1', status: 'active', expires_at: '2027-12-31' }],
  requestLinks: [], observations: [{ evidence_version_id: 'version-1', field_name: 'certificate_number' }],
};

describe('canonical evidence matching', () => {
  it('normalizes known document aliases', () => {
    expect(canonicalDocumentType('Safety Data Sheets (SDS)')).toBe('sds');
    expect(canonicalDocumentType('ISO 9001 Certificate')).toBe('iso_certificate');
  });
  it('matches verified, valid, authorized supplier evidence', () => {
    const result=matchCanonicalEvidence(required,base,'supplier','supplier-1','2026-06-19');
    expect(result.coverage.hasVerifiedClaim).toBe(true); expect(result.matches[0].evidenceVersionId).toBe('version-1');
  });
  it('does not reuse evidence without supplier permission', () => {
    const result=matchCanonicalEvidence(required,{...base,grants:[]},'supplier','supplier-1','2026-06-19');
    expect(result.coverage.hasVerifiedClaim).toBe(false); expect(result.coverage.hasUnverifiedClaim).toBe(true);
  });
  it('rejects expired evidence', () => {
    const data={...base,versions:[{...base.versions[0],expiry_date:'2026-01-01'}]};
    expect(matchCanonicalEvidence(required,data,'supplier','supplier-1','2026-06-19').coverage.hasVerifiedClaim).toBe(false);
  });
  it('rejects evidence below the default 90-day validity threshold', () => {
    const data={...base,versions:[{...base.versions[0],expiry_date:'2026-07-01'}]};
    expect(matchCanonicalEvidence(required,data,'supplier','supplier-1','2026-06-19').coverage.hasVerifiedClaim).toBe(false);
  });
  it('honors a buyer document-type validity override', () => {
    const data={...base,versions:[{...base.versions[0],expiry_date:'2026-07-01'}]};
    const result=matchCanonicalEvidence(required,data,'supplier','supplier-1','2026-06-19',{documentTypeOverrides:{iso_certificate:{minimum_validity_days:7}}});
    expect(result.coverage.hasVerifiedClaim).toBe(true);
  });
  it('requires exact product scope', () => {
    const result=matchCanonicalEvidence(required,base,'product','product-1','2026-06-19');
    expect(result.coverage.hasVerifiedClaim).toBe(false);
  });
  it('matches a product only when the canonical version covers it', () => {
    const data={...base,versions:[{...base.versions[0],covered_product_ids:['product-1']}]};
    expect(matchCanonicalEvidence(required,data,'product','product-1','2026-06-19').coverage.hasVerifiedClaim).toBe(true);
  });
  it('requires every required evidence type rather than only the first', () => {
    const requirements=[...required,{type:'document' as const,document_type:'Insurance Certificate',name:'Insurance'}];
    expect(matchCanonicalEvidence(requirements,base,'supplier','supplier-1','2026-06-19').coverage.hasVerifiedClaim).toBe(false);
  });
  it('rejects standard and jurisdiction mismatches', () => {
    const scopedRequired=[{...required[0],required_standards:['ISO 9001:2015'],jurisdiction:'US'}];
    const data={...base,versions:[{...base.versions[0],standards:['ISO 14001:2015'],jurisdiction:'CA'}]};
    expect(matchCanonicalEvidence(scopedRequired,data,'supplier','supplier-1','2026-06-19').coverage.hasVerifiedClaim).toBe(false);
  });
  it('blocks evidence when its latest validation failed', () => {
    const data={...base,validations:[{evidence_version_id:'version-1',status:'failed',created_at:'2026-06-20'},...base.validations]};
    expect(matchCanonicalEvidence(required,data,'supplier','supplier-1','2026-06-19').coverage.hasVerifiedClaim).toBe(false);
  });
});
