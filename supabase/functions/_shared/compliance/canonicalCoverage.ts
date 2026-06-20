import type { RequiredEvidenceDefinitionV1, SubjectType } from '../requirements/contracts.ts';
import type { CoverageState } from './outcome.ts';

export interface CanonicalRecord { id: string; canonical_document_type: string }
export interface CanonicalVersion {
  id: string; evidence_record_id: string; lifecycle_status: string; expiry_date: string | null;
  covered_product_ids: string[]; covered_facility_ids: string[]; validation_completeness: number | null;
  legacy_evidence_claim_id: string | null; jurisdiction?: string | null; standards?: string[];
}
export interface CanonicalAttestation { evidence_version_id: string; attestation_type: string; outcome: string; created_at?: string }
export interface CanonicalValidation { evidence_version_id: string; status: string; created_at?: string }
export interface CanonicalGrant { id: string; evidence_version_id: string | null; status: string; expires_at: string | null }
export interface CanonicalRequestLink { evidence_version_id: string; relation: string }
export interface CanonicalObservation { evidence_version_id: string; field_name: string }
export interface CanonicalCoverageData {
  records: CanonicalRecord[]; versions: CanonicalVersion[]; attestations: CanonicalAttestation[];
  validations: CanonicalValidation[]; grants: CanonicalGrant[]; requestLinks: CanonicalRequestLink[];
  observations: CanonicalObservation[];
}
export interface CanonicalEvidenceMatch {
  evidenceVersionId: string; legacyClaimId: string | null; grantId: string | null;
  score: number; reasons: string[]; scopeResult: Record<string, unknown>; validationResult: Record<string, unknown>;
  expiryDate: string | null;
}
export interface CanonicalMatchPolicy { defaultMinimumValidityDays?: number; documentTypeOverrides?: Record<string,{ minimum_validity_days?: number }> }

const ALIASES: Record<string, string> = {
  sds: 'sds', safetydatasheet: 'sds', safetydatasheetssds: 'sds', materialsafetydatasheet: 'sds', msds: 'sds',
  isocertificate: 'iso_certificate', iso9001certification: 'iso_certificate', iso9001certificate: 'iso_certificate',
  insurancecertificate: 'insurance_certificate', certificateofinsurance: 'insurance_certificate', coi: 'insurance_certificate',
  coa: 'coa', certificateofanalysis: 'coa', businesslicense: 'business_license', businesslicence: 'business_license',
  testreport: 'test_report', laboratorytestreport: 'test_report', labreport: 'test_report',
};

export function canonicalDocumentType(value: string): string {
  const compact = value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return ALIASES[compact] || value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function validAt(expiry: string | null, effectiveAt: string): boolean {
  return !expiry || expiry >= effectiveAt;
}

function hasMinimumValidity(expiry: string | null, effectiveAt: string, minimumValidityDays: number): boolean {
  if (!expiry) return true;
  const threshold = new Date(`${effectiveAt}T00:00:00.000Z`);
  threshold.setUTCDate(threshold.getUTCDate() + minimumValidityDays);
  return expiry >= threshold.toISOString().slice(0,10);
}

export function matchCanonicalEvidence(
  requiredEvidence: RequiredEvidenceDefinitionV1[], data: CanonicalCoverageData,
  subjectType: SubjectType, subjectId: string, effectiveAt: string, policy: CanonicalMatchPolicy = {},
): { coverage: CoverageState; matches: CanonicalEvidenceMatch[]; grantIds: string[] } {
  if (requiredEvidence.length === 0) return {
    coverage: { hasVerifiedClaim: false, verifiedExpiryDate: null, hasRejectedClaim: false, hasUnverifiedClaim: false, hasUpload: false, hasOpenRequest: false },
    matches: [], grantIds: [],
  };
  const matches: CanonicalEvidenceMatch[] = [];
  let hasCandidate = false;
  let hasRejected = false;
  for (const requirement of requiredEvidence) {
    const target = canonicalDocumentType(requirement.document_type);
    const minimumValidityDays = policy.documentTypeOverrides?.[target]?.minimum_validity_days ?? policy.defaultMinimumValidityDays ?? 90;
    const recordIds = new Set(data.records.filter((record) => record.canonical_document_type === target).map((record) => record.id));
    const candidates = data.versions.filter((version) => recordIds.has(version.evidence_record_id));
    hasCandidate ||= candidates.length > 0;
    hasRejected ||= candidates.some((candidate) => candidate.lifecycle_status === 'rejected');
    const eligible = candidates.flatMap((version) => {
      if (version.lifecycle_status !== 'current' || !validAt(version.expiry_date, effectiveAt) || !hasMinimumValidity(version.expiry_date,effectiveAt,minimumValidityDays)) return [];
      const latestAttestation = data.attestations.find((row) => row.evidence_version_id === version.id && ['supplier_verification','buyer_verification','rejection'].includes(row.attestation_type));
      const verified = latestAttestation?.outcome === 'accepted' && ['supplier_verification','buyer_verification'].includes(latestAttestation.attestation_type);
      const latestValidation = data.validations.find((row) => row.evidence_version_id === version.id);
      const validationPassed = latestValidation?.status === 'passed';
      const requestAccess = data.requestLinks.some((row) => row.evidence_version_id === version.id && ['submitted','accepted'].includes(row.relation));
      const grant = data.grants.find((row) => row.evidence_version_id === version.id && row.status === 'active' && (!row.expires_at || row.expires_at.slice(0,10) >= effectiveAt));
      const productMatch = subjectType !== 'product' || version.covered_product_ids.includes(subjectId);
      const facilityMatch = subjectType !== 'facility' || version.covered_facility_ids.includes(subjectId);
      const jurisdictionMatch = !requirement.jurisdiction || version.jurisdiction?.toLowerCase() === requirement.jurisdiction.toLowerCase();
      const standardsMatch = (requirement.required_standards || []).every((standard) => (version.standards || []).includes(standard));
      const fieldNames = new Set(data.observations.filter((row) => row.evidence_version_id === version.id).map((row) => row.field_name));
      const fieldsMatch = (requirement.required_fields || []).every((field) => fieldNames.has(field));
      if (!verified || !validationPassed || (!requestAccess && !grant) || !productMatch || !facilityMatch || !jurisdictionMatch || !standardsMatch || !fieldsMatch) return [];
      const score = 0.30 + (requestAccess || grant ? 0.15 : 0) + (productMatch && facilityMatch ? 0.15 : 0) + (jurisdictionMatch ? 0.1 : 0) + (standardsMatch ? 0.1 : 0) + (fieldsMatch ? 0.1 : 0) + (version.validation_completeness || 0) * 0.1;
      return [{
        evidenceVersionId: version.id, legacyClaimId: version.legacy_evidence_claim_id,
        grantId: grant?.id || null, score, reasons: ['document_type_match','verified','valid','authorized','scope_match','required_fields_present'],
        scopeResult: { subject_type: subjectType, subject_id: subjectId, product_match: productMatch, facility_match: facilityMatch, jurisdiction_match: jurisdictionMatch, standards_match: standardsMatch },
        validationResult: { passed: validationPassed, completeness: version.validation_completeness }, expiryDate: version.expiry_date,
      }];
    }).sort((a,b) => b.score-a.score || (b.expiryDate || '').localeCompare(a.expiryDate || '') || a.evidenceVersionId.localeCompare(b.evidenceVersionId));
    if (eligible[0]) matches.push(eligible[0]);
  }
  const allSatisfied = matches.length === requiredEvidence.length;
  const expiries = matches.map((match) => match.expiryDate).filter((value): value is string => Boolean(value)).sort();
  return {
    coverage: {
      hasVerifiedClaim: allSatisfied, verifiedExpiryDate: expiries[0] || null,
      hasRejectedClaim: hasRejected, hasUnverifiedClaim: hasCandidate && !allSatisfied,
      hasUpload: hasCandidate, hasOpenRequest: false,
    },
    matches,
    grantIds: matches.map((match) => match.grantId).filter((value): value is string => Boolean(value)),
  };
}
