import { describe, expect, it } from 'vitest';
import { parseEvidenceExtractionResponse } from '../../supabase/functions/_shared/evidence/contracts';

// Fixed mock model responses with their exact expected parsed claims, so a
// change to the extraction prompt or parsing logic that silently breaks the
// shape is caught without calling OpenAI.
describe('evidence extraction golden cases', () => {
  it('parses a children\'s product certificate response', () => {
    const raw = JSON.stringify({
      issuer: 'SGS',
      certificate_number: 'SGS-CPC-88213',
      issue_date: '2026-03-01',
      expiry_date: '2027-03-01',
      standards: ['16 CFR 1500', 'ASTM F963'],
      covered_products: ['Wooden building blocks set'],
      covered_facilities: [],
      source_page: 1,
      source_text: 'Children\'s Product Certificate issued under 16 CFR 1500',
      confidence: 0.88,
    });

    expect(parseEvidenceExtractionResponse(raw)).toEqual({
      issuer: 'SGS',
      certificate_number: 'SGS-CPC-88213',
      issue_date: '2026-03-01',
      expiry_date: '2027-03-01',
      standards: ['16 CFR 1500', 'ASTM F963'],
      covered_products: ['Wooden building blocks set'],
      covered_facilities: [],
      source_page: 1,
      source_text: 'Children\'s Product Certificate issued under 16 CFR 1500',
      confidence: 0.88,
    });
  });

  it('parses a low-confidence response with mostly missing fields', () => {
    const raw = JSON.stringify({
      issuer: null,
      certificate_number: null,
      issue_date: null,
      expiry_date: null,
      standards: [],
      covered_products: [],
      covered_facilities: [],
      source_page: null,
      source_text: null,
      confidence: 0.2,
    });

    const parsed = parseEvidenceExtractionResponse(raw);
    expect(parsed.issuer).toBeNull();
    expect(parsed.standards).toEqual([]);
    expect(parsed.confidence).toBe(0.2);
  });

  it('throws on a response missing a required key rather than silently defaulting', () => {
    const raw = JSON.stringify({ issuer: 'SGS' });
    expect(() => parseEvidenceExtractionResponse(raw)).toThrow();
  });
});
