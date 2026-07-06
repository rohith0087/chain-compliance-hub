import { AlertTriangle, Ban, CheckCircle, Clock, FileText, type LucideIcon } from 'lucide-react';

export interface BadgeConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

// Shared visual language across Document Manager, Evidence Verification, and
// Compliance Decisions, extracted from BuyerDocumentsManager.tsx so all three
// buyer-side review screens read from one source of truth.

export const STATUS_BADGE_CONFIG: Record<string, BadgeConfig> = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' },
  submitted: { label: 'Submitted', icon: FileText, className: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30' },
  approved: { label: 'Approved', icon: CheckCircle, className: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' },
  rejected: { label: 'Declined', icon: AlertTriangle, className: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30' },
  withdrawn: { label: 'Withdrawn', icon: Ban, className: 'bg-muted text-muted-foreground border-border' },
  expired: { label: 'Expired', icon: AlertTriangle, className: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30' },
};

export const CATEGORY_BADGE_CLASS: Record<string, string> = {
  compliance: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  certification: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  insurance: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
  quality: 'bg-pink-50 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-500/30',
  safety: 'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/30',
  financial: 'bg-muted text-foreground/80 border-border',
};

// Compliance Decisions' outcome set is a superset of Document Manager's
// statuses (computed compliance outcomes, not file-submission statuses) --
// mapped onto the same semantic color families for visual consistency.
export const OUTCOME_BADGE_CONFIG: Record<string, BadgeConfig> = {
  compliant: { label: 'Compliant', icon: CheckCircle, className: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' },
  conditional: { label: 'Conditional', icon: Clock, className: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30' },
  noncompliant: { label: 'Noncompliant', icon: AlertTriangle, className: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30' },
  expired: { label: 'Expired', icon: AlertTriangle, className: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30' },
  under_review: { label: 'Under review', icon: Clock, className: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' },
  submitted: { label: 'Submitted', icon: FileText, className: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' },
  requested: { label: 'Requested', icon: Clock, className: 'bg-muted text-muted-foreground border-border' },
  missing: { label: 'Missing', icon: AlertTriangle, className: 'bg-muted text-muted-foreground border-border' },
  not_applicable: { label: 'Not applicable', icon: Ban, className: 'bg-muted text-muted-foreground border-border' },
};

// Evidence Verification's reuse-eligibility / request-link qualification set.
export const QUALIFICATION_BADGE_CONFIG: Record<string, BadgeConfig> = {
  eligible: { label: 'Eligible', icon: CheckCircle, className: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' },
  potential: { label: 'Potential', icon: Clock, className: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' },
  ineligible: { label: 'Ineligible', icon: AlertTriangle, className: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30' },
  candidate: { label: 'Candidate', icon: FileText, className: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30' },
  offered: { label: 'Offered', icon: FileText, className: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30' },
};

export const reviewSurfaceTokens = {
  textPrimary: "hsl(var(--foreground))",
  textSecondary: "hsl(var(--muted-foreground))",
  borderPrimary: "hsl(var(--border))",
  borderSubtle: "hsl(var(--border))",
  accentBlue: "hsl(var(--primary))",
  approveBg: '#10B981',
  approveBgHover: '#059669',
  declineText: "hsl(var(--danger))",
  declineBorder: '#FCA5A5',
};

export const reviewCardContainerClass =
  'rounded-[16px] border border-border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
export const reviewPageTitleClass = 'text-[26px] font-bold text-foreground leading-none';
export const reviewPageSubtitleClass = 'text-[15px] text-muted-foreground';
export const reviewSectionHeaderClass = 'text-[12px] font-bold tracking-[0.04em] uppercase text-muted-foreground';
export const reviewRowClass = 'border-b border-border hover:bg-muted/50';
export const reviewBadgePillClass =
  'text-[12px] px-2 py-0.5 rounded-full font-medium border-0 flex items-center justify-center';

export const reviewActionButtonPrimaryClass =
  'h-[36px] w-[36px] bg-[#10B981] hover:bg-[#059669] text-white rounded-[10px] shadow-sm flex-shrink-0';
export const reviewActionButtonDangerClass =
  'h-[36px] w-[36px] bg-card text-danger border-danger/40 hover:bg-danger/10 rounded-[10px] shadow-sm flex-shrink-0';
export const reviewActionButtonSecondaryClass =
  'h-[36px] px-[12px] bg-card text-foreground/80 border-border hover:bg-muted rounded-[10px] font-semibold shadow-sm';

export const reviewToolbarSelectTriggerClass =
  'h-9 rounded-[14px] border-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
export const reviewEmptyStateContainerClass =
  'text-center py-12 border border-border rounded-[16px] bg-card';
export const reviewMetricCardClass =
  'bg-card rounded-[20px] border border-border p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center gap-4';
export const reviewMetricIconCircleClass = 'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0';
export const paginationRowsPerPageOptions = [5, 10, 25, 50] as const;

// Deterministic color cycle for industry badges (Discovery, supplier cards).
// Industries aren't a fixed taxonomy with semantic colors like document
// categories -- this just gives each industry a distinct, stable color by
// its position in the provided list, so the same industry always renders
// the same color without inventing a second taxonomy to maintain.
const INDUSTRY_BADGE_COLORS = [
  'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
  'bg-pink-50 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-500/30',
  'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/30',
  'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
  'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
];

export function getIndustryBadgeClass(industry: string | null | undefined, allIndustries: readonly string[]): string {
  if (!industry) return 'bg-muted text-muted-foreground border-border';
  const index = Math.max(0, allIndustries.indexOf(industry));
  return INDUSTRY_BADGE_COLORS[index % INDUSTRY_BADGE_COLORS.length];
}
