import { describe, expect, it } from 'vitest';
import { evaluateApplicabilityRule } from '../../supabase/functions/_shared/requirements/evaluator';
import { adaptLegacyRequirement, legacyRequirementKey } from '../../supabase/functions/_shared/requirements/legacyAdapter';

describe('requirement evaluator', () => {
  it('evaluates all, any, and not deterministically', () => {
    const rule = {
      all: [
        { fact: 'country', operator: 'eq', value: 'US' },
        { any: [
          { fact: 'age', operator: 'lte', value: 12 },
          { not: { fact: 'general_use', operator: 'eq', value: true } },
        ] },
      ],
    } as const;
    const first = evaluateApplicabilityRule(rule, { country: 'US', age: 8, general_use: false });
    const second = evaluateApplicabilityRule(rule, { country: 'US', age: 8, general_use: false });
    expect(first).toEqual(second);
    expect(first.outcome).toBe('applies');
  });

  it('returns indeterminate when an authoritative fact is missing', () => {
    const result = evaluateApplicabilityRule({
      all: [
        { fact: 'destination_country', operator: 'eq', value: 'US' },
        { fact: 'subject_to_cpsc_rule', operator: 'eq', value: true },
      ],
    }, { destination_country: 'US' });
    expect(result.outcome).toBe('indeterminate');
    expect(result.missingInputs).toEqual(['subject_to_cpsc_rule']);
  });

  it('lets a false all-condition dominate an unknown condition', () => {
    const result = evaluateApplicabilityRule({
      all: [
        { fact: 'destination_country', operator: 'eq', value: 'US' },
        { fact: 'missing', operator: 'present' },
      ],
    }, { destination_country: 'CA' });
    expect(result.outcome).toBe('does_not_apply');
  });

  it('supports membership, containment, numeric, and date comparisons', () => {
    expect(evaluateApplicabilityRule({ fact: 'mode', operator: 'in', value: ['general', 'foreign_trade_zone'] }, { mode: 'general' }).outcome).toBe('applies');
    expect(evaluateApplicabilityRule({ fact: 'rules', operator: 'contains', value: '16-CFR-1110' }, { rules: ['16-CFR-1110'] }).outcome).toBe('applies');
    expect(evaluateApplicabilityRule({ fact: 'age', operator: 'gte', value: 12 }, { age: 12 }).outcome).toBe('applies');
    expect(evaluateApplicabilityRule({ fact: 'date', operator: 'after', value: '2026-07-07' }, { date: '2026-07-08' }).outcome).toBe('applies');
  });

  it.each([
    ['eq', { fact: 'value', operator: 'eq', value: 'x' }, { value: 'x' }],
    ['present', { fact: 'value', operator: 'present' }, { value: false }],
    ['gt', { fact: 'value', operator: 'gt', value: 2 }, { value: 3 }],
    ['gte', { fact: 'value', operator: 'gte', value: 3 }, { value: 3 }],
    ['lt', { fact: 'value', operator: 'lt', value: 4 }, { value: 3 }],
    ['lte', { fact: 'value', operator: 'lte', value: 3 }, { value: 3 }],
    ['before', { fact: 'value', operator: 'before', value: '2026-07-08' }, { value: '2026-07-07' }],
  ] as const)('supports the %s operator', (_name, rule, facts) => {
    expect(evaluateApplicabilityRule(rule, facts).outcome).toBe('applies');
  });

  it('treats malformed numeric and date facts as indeterminate', () => {
    expect(evaluateApplicabilityRule(
      { fact: 'age', operator: 'lte', value: 12 },
      { age: 'twelve' },
    ).outcome).toBe('indeterminate');
    expect(evaluateApplicabilityRule(
      { fact: 'date', operator: 'after', value: '2026-07-07' },
      { date: 'not-a-date' },
    ).outcome).toBe('indeterminate');
  });

  it('uses correct three-state any semantics', () => {
    expect(evaluateApplicabilityRule({ any: [
      { fact: 'known', operator: 'eq', value: true },
      { fact: 'unknown', operator: 'present' },
    ] }, { known: false }).outcome).toBe('indeterminate');
    expect(evaluateApplicabilityRule({ any: [
      { fact: 'known', operator: 'eq', value: true },
      { fact: 'unknown', operator: 'present' },
    ] }, { known: true }).outcome).toBe('applies');
  });
});

describe('legacy requirement adapter', () => {
  it('maps buyer requirements without changing their source identity', () => {
    const result = adaptLegacyRequirement({
      id: '1',
      source_type: 'default_document_requirement',
      document_type: 'business_license',
      document_name: 'Business License',
      is_required: true,
    }, '00000000-0000-4000-8000-000000000001');
    expect(legacyRequirementKey('business_license')).toBe('LEGACY-BUSINESS-LICENSE');
    expect(result.framework_code).toBe('TR2C-LEGACY');
    expect(result.outcome).toBe('applies');
    expect(result.required_evidence[0].document_type).toBe('business_license');
  });
});
