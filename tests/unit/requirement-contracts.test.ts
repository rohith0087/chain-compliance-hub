import { describe, expect, it } from 'vitest';
import {
  applicabilityRuleSchema,
  requirementEvaluationRequestV1Schema,
  requirementEvaluationResponseV1Schema,
  validateApplicabilityRuleV1,
} from '../../supabase/functions/_shared/requirements/contracts';

describe('requirement evaluation contract', () => {
  it('accepts a valid version-one request and normalizes the country', () => {
    const result = requirementEvaluationRequestV1Schema.parse({
      buyer_id: '00000000-0000-4000-8000-000000000001',
      subject_type: 'product',
      subject_id: '00000000-0000-4000-8000-000000000002',
      effective_at: '2026-07-08',
      facts: { destination_country: 'us', is_children_product: true },
    });
    expect(result.facts.destination_country).toBe('US');
  });

  it('rejects unknown authoritative input fields', () => {
    const result = requirementEvaluationRequestV1Schema.safeParse({
      buyer_id: '00000000-0000-4000-8000-000000000001',
      subject_type: 'product',
      subject_id: '00000000-0000-4000-8000-000000000002',
      effective_at: '2026-07-08',
      facts: { ai_assumption: true },
    });
    expect(result.success).toBe(false);
  });

  it('accepts every authoritative Phase 1 input', () => {
    expect(requirementEvaluationRequestV1Schema.parse({
      buyer_id: '00000000-0000-4000-8000-000000000001',
      subject_type: 'facility',
      subject_id: '00000000-0000-4000-8000-000000000002',
      effective_at: '2027-01-08',
      facts: {
        destination_country: 'US',
        is_children_product: false,
        intended_user_age_max: 18,
        consumer_product_under_cpsc: true,
        subject_to_cpsc_rule: true,
        applicable_rule_ids: ['16-CFR-1110'],
        domestic_import_status: 'imported',
        import_entry_mode: 'foreign_trade_zone',
      },
    }).facts.intended_user_age_max).toBe(18);
  });
});

describe('rule and response contracts', () => {
  it('reports semantically invalid operator values', () => {
    const rule = applicabilityRuleSchema.parse({ fact: 'age', operator: 'lte', value: '12' });
    expect(validateApplicabilityRuleV1(rule)).toEqual(['age: lte requires a numeric value']);
  });

  it('validates a complete evaluation response', () => {
    expect(requirementEvaluationResponseV1Schema.safeParse({
      evaluation_id: '00000000-0000-4000-8000-000000000001',
      idempotent_replay: false,
      evaluator_version: '1.0.0',
      correlation_id: 'test-correlation',
      subject_type: 'product',
      subject_id: '00000000-0000-4000-8000-000000000002',
      effective_at: '2026-07-08',
      results: [],
    }).success).toBe(true);
  });
});
