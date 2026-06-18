import { z } from 'zod';

export const EVIDENCE_EXTRACTION_MODEL_VERSION = 'evidence-extract-v1';

export const evidenceExtractionResponseSchema = z.object({
  issuer: z.string().min(1).max(300).nullable(),
  certificate_number: z.string().min(1).max(200).nullable(),
  issue_date: z.string().date().nullable(),
  expiry_date: z.string().date().nullable(),
  standards: z.array(z.string().min(1).max(100)).max(50),
  covered_products: z.array(z.string().min(1).max(300)).max(100),
  covered_facilities: z.array(z.string().min(1).max(300)).max(100),
  source_page: z.number().int().min(1).max(10_000).nullable(),
  source_text: z.string().min(1).max(2000).nullable(),
  confidence: z.number().min(0).max(1),
}).strict();
export type EvidenceExtractionResponseV1 = z.infer<typeof evidenceExtractionResponseSchema>;

export const evidenceClaimInputSchema = evidenceExtractionResponseSchema.extend({
  extraction_model_version: z.literal(EVIDENCE_EXTRACTION_MODEL_VERSION),
}).strict();
export type EvidenceClaimInputV1 = z.infer<typeof evidenceClaimInputSchema>;

export function parseEvidenceExtractionResponse(raw: string): EvidenceExtractionResponseV1 {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
  const parsed: unknown = JSON.parse(cleaned);
  return evidenceExtractionResponseSchema.parse(parsed);
}

export function toEvidenceClaimInput(response: EvidenceExtractionResponseV1): EvidenceClaimInputV1 {
  return { ...response, extraction_model_version: EVIDENCE_EXTRACTION_MODEL_VERSION };
}
