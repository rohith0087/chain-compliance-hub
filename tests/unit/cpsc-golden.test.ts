import { describe, expect, it } from 'vitest';
import { evaluateApplicabilityRule } from '../../supabase/functions/_shared/requirements/evaluator';
import { normalizeRequirementFacts } from '../../supabase/functions/_shared/requirements/facts';

const rules = {
  cpc: { all: [
    { fact: 'destination_country', operator: 'eq', value: 'US' },
    { fact: 'consumer_product_under_cpsc', operator: 'eq', value: true },
    { fact: 'is_children_product', operator: 'eq', value: true },
    { fact: 'subject_to_cpsc_rule', operator: 'eq', value: true },
  ] },
  gcc: { all: [
    { fact: 'destination_country', operator: 'eq', value: 'US' },
    { fact: 'consumer_product_under_cpsc', operator: 'eq', value: true },
    { fact: 'is_children_product', operator: 'eq', value: false },
    { fact: 'subject_to_cpsc_rule', operator: 'eq', value: true },
  ] },
  efilingGeneral: { all: [
    { fact: 'destination_country', operator: 'eq', value: 'US' },
    { fact: 'domestic_import_status', operator: 'eq', value: 'imported' },
    { fact: 'import_entry_mode', operator: 'eq', value: 'general' },
    { fact: 'subject_to_cpsc_rule', operator: 'eq', value: true },
  ] },
  efiling2027: { all: [
    { fact: 'destination_country', operator: 'eq', value: 'US' },
    { fact: 'domestic_import_status', operator: 'eq', value: 'imported' },
    { fact: 'import_entry_mode', operator: 'in', value: ['general', 'foreign_trade_zone'] },
    { fact: 'subject_to_cpsc_rule', operator: 'eq', value: true },
  ] },
} as const;

describe('CPSC golden applicability cases', () => {
  it('classifies the age boundary deterministically', () => {
    expect(normalizeRequirementFacts({ intended_user_age_max: 12 }).is_children_product).toBe(true);
    expect(normalizeRequirementFacts({ intended_user_age_max: 13 }).is_children_product).toBe(false);
    expect(normalizeRequirementFacts({ intended_user_age_max: 8, is_children_product: false }).is_children_product).toBe(false);
  });
  it('applies CPC to a covered children product', () => {
    expect(evaluateApplicabilityRule(rules.cpc, {
      destination_country: 'US', consumer_product_under_cpsc: true,
      is_children_product: true, subject_to_cpsc_rule: true,
    }).outcome).toBe('applies');
  });

  it('applies GCC to a covered general-use product', () => {
    expect(evaluateApplicabilityRule(rules.gcc, {
      destination_country: 'US', consumer_product_under_cpsc: true,
      is_children_product: false, subject_to_cpsc_rule: true,
    }).outcome).toBe('applies');
  });

  it('does not apply certificates to a non-CPSC product', () => {
    expect(evaluateApplicabilityRule(rules.cpc, {
      destination_country: 'US', consumer_product_under_cpsc: false,
    }).outcome).toBe('does_not_apply');
  });

  it('distinguishes domestic, general imports, and 2027 FTZ imports', () => {
    const base = { destination_country: 'US', subject_to_cpsc_rule: true };
    expect(evaluateApplicabilityRule(rules.efilingGeneral, {
      ...base, domestic_import_status: 'domestic', import_entry_mode: 'general',
    }).outcome).toBe('does_not_apply');
    expect(evaluateApplicabilityRule(rules.efilingGeneral, {
      ...base, domestic_import_status: 'imported', import_entry_mode: 'general',
    }).outcome).toBe('applies');
    expect(evaluateApplicabilityRule(rules.efilingGeneral, {
      ...base, domestic_import_status: 'imported', import_entry_mode: 'foreign_trade_zone',
    }).outcome).toBe('does_not_apply');
    expect(evaluateApplicabilityRule(rules.efiling2027, {
      ...base, domestic_import_status: 'imported', import_entry_mode: 'foreign_trade_zone',
    }).outcome).toBe('applies');
  });

  it('returns indeterminate for missing authoritative facts', () => {
    expect(evaluateApplicabilityRule(rules.cpc, { destination_country: 'US' }).outcome).toBe('indeterminate');
  });
});
