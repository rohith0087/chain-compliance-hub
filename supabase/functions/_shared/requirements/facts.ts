export function normalizeRequirementFacts(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const facts = { ...input };
  if (facts.is_children_product === undefined && typeof facts.intended_user_age_max === 'number') {
    facts.is_children_product = facts.intended_user_age_max <= 12;
  }
  return facts;
}
