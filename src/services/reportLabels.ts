// Presentation labels for anything that leaves the product as a client-facing
// document. Internal identifiers (snake_case enums, migration-era framework
// codes) must never reach an executive PDF -- they read as leaked database
// values and undercut the credibility of everything around them.

/** Acronyms that must stay upper-cased when title-casing an unmapped key. */
const ACRONYMS = new Set([
  'haccp', 'gfsi', 'sqf', 'iso', 'sds', 'ccp', 'gmp', 'coa', 'coi', 'npip',
  'asq', 'esg', 'gst', 'itr', 'brc', 'ifs', 'fda', 'usda', 'cfr', 'msds', 'pdf',
]);

/**
 * Explicit display names for the raw enum values still present in
 * document_requests.document_type. Anything not listed falls back to
 * humanizeKey(), so new values degrade gracefully instead of leaking.
 */
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  food_safety_certificate: 'GFSI Food Safety Certification',
  haccp_plan: 'HACCP Plan',
  allergen_management_program: 'Allergen Management Program',
  recall_program: 'Recall & Crisis Management Program',
  ccp_monitoring_records: 'CCP Monitoring Records',
  iso_9001: 'ISO 9001 Certificate',
};

/**
 * Customer-facing framework names. "TR2C-LEGACY" is an internal migration
 * identifier -- never show it to a buyer's leadership or an auditor.
 */
const FRAMEWORK_LABELS: Record<string, string> = {
  'TR2C-LEGACY': 'Corporate Supplier Standard',
  SQF: 'SQF',
};

/** snake_case / kebab-case -> Title Case, preserving known acronyms. */
export function humanizeKey(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** True when a value still looks like a raw database key rather than a label. */
const looksLikeRawKey = (v: string) => /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(v);

export function documentTypeLabel(raw: string | null | undefined): string {
  if (!raw) return '—';
  const mapped = DOCUMENT_TYPE_LABELS[raw];
  if (mapped) return mapped;
  // Most values are already properly written ("ISO 9001 Certificate") -- only
  // rewrite the ones that are still machine keys.
  return looksLikeRawKey(raw) ? humanizeKey(raw) : raw;
}

export function frameworkLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return FRAMEWORK_LABELS[code] ?? (looksLikeRawKey(code) ? humanizeKey(code) : code);
}

/** Requirement titles come from the engine and can also carry raw keys. */
export function requirementLabel(raw: string | null | undefined): string {
  if (!raw) return '—';
  return DOCUMENT_TYPE_LABELS[raw] ?? (looksLikeRawKey(raw) ? humanizeKey(raw) : raw);
}

/** Compliance outcome -> plain English that does not overstate the finding. */
export function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'compliant': return 'Met';
    case 'not_applicable': return 'Not applicable';
    case 'missing': return 'Missing evidence';
    case 'expired': return 'Expired';
    case 'noncompliant': return 'Not met';
    case 'pending':
    case 'under_review': return 'Pending verification';
    default: return humanizeKey(outcome);
  }
}

export function documentStatusLabel(status: string): string {
  switch (status) {
    case 'approved': return 'Approved';
    case 'submitted': return 'Submitted';
    case 'pending': return 'Awaiting supplier';
    case 'rejected': return 'Rejected';
    case 'expired': return 'Expired';
    default: return humanizeKey(status);
  }
}
