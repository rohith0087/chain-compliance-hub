import type { RequirementEvaluationResultV1 } from './contracts.ts';

export interface LegacyRequirementSource {
  id: string;
  source_type: 'default_document_requirement' | 'onboarding_document_requirement';
  document_type: string;
  document_name: string;
  description?: string | null;
  is_required: boolean;
}

export function legacyRequirementKey(documentType: string): string {
  return `LEGACY-${documentType.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;
}

export function deduplicateLegacyRequirements(
  items: LegacyRequirementSource[],
): LegacyRequirementSource[] {
  const unique = new Map<string, LegacyRequirementSource>();
  for (const item of items) {
    unique.set(legacyRequirementKey(item.document_type), item);
  }
  return [...unique.values()];
}

export function adaptLegacyRequirement(
  item: LegacyRequirementSource,
  mappingId: string,
): RequirementEvaluationResultV1 {
  const evidence = {
    type: 'document' as const,
    document_type: item.document_type,
    name: item.document_name,
    ...(item.description ? { description: item.description } : {}),
  };

  return {
    requirement_version_id: null,
    legacy_mapping_id: mappingId,
    framework_code: 'TR2C-LEGACY',
    framework_version: 'legacy-live',
    requirement_key: legacyRequirementKey(item.document_type),
    title: item.document_name,
    outcome: 'applies',
    explanation: item.is_required
      ? 'This buyer currently requires the document in the existing onboarding workflow.'
      : 'This buyer currently lists the document as optional in the existing onboarding workflow.',
    matched_facts: { legacy_source_type: item.source_type, required: item.is_required },
    missing_inputs: [],
    citation: null,
    source_url: null,
    required_evidence: [evidence],
    effective_from: null,
    effective_to: null,
  };
}
