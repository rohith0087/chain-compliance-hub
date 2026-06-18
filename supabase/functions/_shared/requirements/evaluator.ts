import type { ApplicabilityRuleV1, RequirementOutcome } from './contracts.ts';

export const REQUIREMENT_EVALUATOR_VERSION = '1.0.0';

export interface RuleEvaluation {
  outcome: RequirementOutcome;
  matchedFacts: Record<string, unknown>;
  missingInputs: string[];
  explanation: string;
}

interface InternalEvaluation extends RuleEvaluation {
  clauses: string[];
}

function readFact(facts: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, facts);
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function compareDates(left: unknown, right: unknown, operator: 'before' | 'after'): boolean {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return false;
  return operator === 'before' ? leftTime < rightTime : leftTime > rightTime;
}

function hasComparableTypes(
  actual: unknown,
  rule: Extract<ApplicabilityRuleV1, { fact: string }>,
): boolean {
  if (['gt', 'gte', 'lt', 'lte'].includes(rule.operator)) {
    return typeof actual === 'number' && typeof rule.value === 'number';
  }
  if (['before', 'after'].includes(rule.operator)) {
    return typeof actual === 'string'
      && typeof rule.value === 'string'
      && !Number.isNaN(Date.parse(actual))
      && !Number.isNaN(Date.parse(rule.value));
  }
  if (rule.operator === 'in') return Array.isArray(rule.value);
  if (rule.operator === 'contains') return Array.isArray(actual);
  return true;
}

function evaluatePredicate(
  rule: Extract<ApplicabilityRuleV1, { fact: string }>,
  facts: Record<string, unknown>,
): InternalEvaluation {
  const actual = readFact(facts, rule.fact);
  if (isMissing(actual)) {
    return {
      outcome: 'indeterminate',
      matchedFacts: {},
      missingInputs: [rule.fact],
      clauses: [`${rule.fact} is required`],
      explanation: `${rule.fact} is required to determine applicability.`,
    };
  }

  if (!hasComparableTypes(actual, rule)) {
    return {
      outcome: 'indeterminate',
      matchedFacts: { [rule.fact]: actual },
      missingInputs: [rule.fact],
      clauses: [`${rule.fact} has an invalid value for ${rule.operator}`],
      explanation: `${rule.fact} must be corrected before applicability can be determined.`,
    };
  }

  let matched = false;
  switch (rule.operator) {
    case 'present':
      matched = true;
      break;
    case 'eq':
      matched = actual === rule.value;
      break;
    case 'in':
      matched = Array.isArray(rule.value) && rule.value.includes(actual as never);
      break;
    case 'contains':
      matched = Array.isArray(actual) && actual.includes(rule.value);
      break;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (typeof actual === 'number' && typeof rule.value === 'number') {
        if (rule.operator === 'gt') matched = actual > rule.value;
        if (rule.operator === 'gte') matched = actual >= rule.value;
        if (rule.operator === 'lt') matched = actual < rule.value;
        if (rule.operator === 'lte') matched = actual <= rule.value;
      }
      break;
    }
    case 'before':
    case 'after':
      matched = compareDates(actual, rule.value, rule.operator);
      break;
  }

  const expected = rule.operator === 'present' ? 'present' : JSON.stringify(rule.value);
  return {
    outcome: matched ? 'applies' : 'does_not_apply',
    matchedFacts: { [rule.fact]: actual },
    missingInputs: [],
    clauses: [`${rule.fact} ${rule.operator} ${expected}: ${matched ? 'matched' : 'not matched'}`],
    explanation: `${rule.fact} ${matched ? 'matched' : 'did not match'} ${rule.operator} ${expected}.`,
  };
}

function merge(evaluations: InternalEvaluation[]): Pick<InternalEvaluation, 'matchedFacts' | 'missingInputs' | 'clauses'> {
  return {
    matchedFacts: Object.assign({}, ...evaluations.map((item) => item.matchedFacts)),
    missingInputs: [...new Set(evaluations.flatMap((item) => item.missingInputs))],
    clauses: evaluations.flatMap((item) => item.clauses),
  };
}

function evaluateInternal(rule: ApplicabilityRuleV1, facts: Record<string, unknown>): InternalEvaluation {
  if ('fact' in rule) return evaluatePredicate(rule, facts);

  if ('not' in rule) {
    const child = evaluateInternal(rule.not, facts);
    const outcome = child.outcome === 'applies'
      ? 'does_not_apply'
      : child.outcome === 'does_not_apply'
        ? 'applies'
        : 'indeterminate';
    return { ...child, outcome, explanation: `NOT (${child.explanation})` };
  }

  const children = ('all' in rule ? rule.all : rule.any).map((child) => evaluateInternal(child, facts));
  const combined = merge(children);
  const isAll = 'all' in rule;
  let outcome: RequirementOutcome;

  if (isAll) {
    outcome = children.some((item) => item.outcome === 'does_not_apply')
      ? 'does_not_apply'
      : children.some((item) => item.outcome === 'indeterminate')
        ? 'indeterminate'
        : 'applies';
  } else {
    outcome = children.some((item) => item.outcome === 'applies')
      ? 'applies'
      : children.some((item) => item.outcome === 'indeterminate')
        ? 'indeterminate'
        : 'does_not_apply';
  }

  return {
    ...combined,
    outcome,
    explanation: `${isAll ? 'All' : 'Any'} conditions: ${children.map((item) => item.explanation).join(' ')}`,
  };
}

export function evaluateApplicabilityRule(
  rule: ApplicabilityRuleV1,
  facts: Record<string, unknown>,
): RuleEvaluation {
  const result = evaluateInternal(rule, facts);
  return {
    outcome: result.outcome,
    matchedFacts: result.matchedFacts,
    missingInputs: result.missingInputs,
    explanation: result.explanation,
  };
}
