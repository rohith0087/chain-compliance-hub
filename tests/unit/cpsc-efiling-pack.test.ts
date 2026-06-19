import { describe, expect, it } from 'vitest';
import { transformToCpscEfilingV1, type CpscEfilingSourceSnapshot } from '../../supabase/functions/_shared/regulatoryPacks/cpscEfiling';

const baseSnapshot: CpscEfilingSourceSnapshot = {
  subject_type: 'product',
  subject_id: '00000000-0000-4000-8000-000000000050',
  dossier_id: '00000000-0000-4000-8000-000000000051',
  version_number: 1,
  content_hash: 'a'.repeat(64),
  subject_display_name: "Children's Plush Toy",
  certifier_contact_email: 'compliance@example.com',
  statements: [
    {
      framework_code: 'US-CPSC',
      requirement_key: 'CHILDRENS-PRODUCT-CERTIFICATE',
      title: "Children's Product Certificate",
      outcome: 'compliant',
      citation: '16 CFR 1107',
      evidence_claim_ids: ['00000000-0000-4000-8000-000000000052'],
    },
    {
      framework_code: 'TR2C-LEGACY',
      requirement_key: 'LEGACY-BUSINESS-LICENSE',
      title: 'Business License',
      outcome: 'compliant',
      citation: null,
      evidence_claim_ids: [],
    },
  ],
};

describe('CPSC eFiling pack transform', () => {
  it('produces a valid payload including only US-CPSC statements', () => {
    const result = transformToCpscEfilingV1(baseSnapshot);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    const payload = result.payload as { statements: Array<{ requirement_key: string }> };
    expect(payload.statements).toHaveLength(1);
    expect(payload.statements[0].requirement_key).toBe('CHILDRENS-PRODUCT-CERTIFICATE');
  });

  it('is invalid when there are no US-CPSC statements at all', () => {
    const result = transformToCpscEfilingV1({
      ...baseSnapshot,
      statements: [baseSnapshot.statements[1]],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('statements'))).toBe(true);
  });

  it('is invalid when the certifier contact email is missing', () => {
    const result = transformToCpscEfilingV1({ ...baseSnapshot, certifier_contact_email: null });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('certifier_contact_email'))).toBe(true);
  });
});
