import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_EXTRACTION_MODEL_VERSION,
  evidenceExtractionResponseSchema,
  parseEvidenceExtractionResponse,
  toEvidenceClaimInput,
} from '../../supabase/functions/_shared/evidence/contracts';

const validResponse = {
  issuer: 'Intertek',
  certificate_number: 'INT-2026-00451',
  issue_date: '2026-01-15',
  expiry_date: '2027-01-15',
  standards: ['ISO 9001', 'HACCP'],
  covered_products: ['Children\'s plush toy'],
  covered_facilities: ['Plant 3 - Guangzhou'],
  source_page: 2,
  source_text: 'This certifies that the above product complies with ISO 9001.',
  confidence: 0.92,
};

describe('evidence extraction contract', () => {
  it('accepts a fully populated response', () => {
    expect(evidenceExtractionResponseSchema.parse(validResponse)).toEqual(validResponse);
  });

  it('accepts nulls for unfound fields', () => {
    const result = evidenceExtractionResponseSchema.safeParse({
      ...validResponse, issuer: null, certificate_number: null, issue_date: null, expiry_date: null, source_page: null, source_text: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects confidence outside 0-1', () => {
    expect(evidenceExtractionResponseSchema.safeParse({ ...validResponse, confidence: 1.5 }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(evidenceExtractionResponseSchema.safeParse({ ...validResponse, ai_note: 'extra' }).success).toBe(false);
  });

  it('parses a model response wrapped in markdown fences', () => {
    const raw = '```json\n' + JSON.stringify(validResponse) + '\n```';
    expect(parseEvidenceExtractionResponse(raw)).toEqual(validResponse);
  });

  it('stamps the current extraction model version on the claim input', () => {
    const claim = toEvidenceClaimInput(evidenceExtractionResponseSchema.parse(validResponse));
    expect(claim.extraction_model_version).toBe(EVIDENCE_EXTRACTION_MODEL_VERSION);
    expect(claim.issuer).toBe('Intertek');
  });
});
