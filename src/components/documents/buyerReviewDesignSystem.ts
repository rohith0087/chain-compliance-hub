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
  pending: { label: 'Pending', icon: Clock, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  submitted: { label: 'Submitted', icon: FileText, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  approved: { label: 'Approved', icon: CheckCircle, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Declined', icon: AlertTriangle, className: 'bg-red-50 text-red-700 border-red-200' },
  withdrawn: { label: 'Withdrawn', icon: Ban, className: 'bg-slate-50 text-slate-600 border-slate-200' },
  expired: { label: 'Expired', icon: AlertTriangle, className: 'bg-red-50 text-red-700 border-red-200' },
};

export const CATEGORY_BADGE_CLASS: Record<string, string> = {
  compliance: 'bg-blue-50 text-blue-700 border-blue-200',
  certification: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  insurance: 'bg-orange-50 text-orange-700 border-orange-200',
  quality: 'bg-pink-50 text-pink-700 border-pink-200',
  safety: 'bg-teal-50 text-teal-700 border-teal-200',
  financial: 'bg-slate-50 text-slate-700 border-slate-200',
};

// Compliance Decisions' outcome set is a superset of Document Manager's
// statuses (computed compliance outcomes, not file-submission statuses) --
// mapped onto the same semantic color families for visual consistency.
export const OUTCOME_BADGE_CONFIG: Record<string, BadgeConfig> = {
  compliant: { label: 'Compliant', icon: CheckCircle, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  conditional: { label: 'Conditional', icon: Clock, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  noncompliant: { label: 'Noncompliant', icon: AlertTriangle, className: 'bg-red-50 text-red-700 border-red-200' },
  expired: { label: 'Expired', icon: AlertTriangle, className: 'bg-red-50 text-red-700 border-red-200' },
  under_review: { label: 'Under review', icon: Clock, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  submitted: { label: 'Submitted', icon: FileText, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  requested: { label: 'Requested', icon: Clock, className: 'bg-slate-50 text-slate-600 border-slate-200' },
  missing: { label: 'Missing', icon: AlertTriangle, className: 'bg-slate-50 text-slate-600 border-slate-200' },
  not_applicable: { label: 'Not applicable', icon: Ban, className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

// Evidence Verification's reuse-eligibility / request-link qualification set.
export const QUALIFICATION_BADGE_CONFIG: Record<string, BadgeConfig> = {
  eligible: { label: 'Eligible', icon: CheckCircle, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  potential: { label: 'Potential', icon: Clock, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ineligible: { label: 'Ineligible', icon: AlertTriangle, className: 'bg-red-50 text-red-700 border-red-200' },
  candidate: { label: 'Candidate', icon: FileText, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  offered: { label: 'Offered', icon: FileText, className: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export const reviewSurfaceTokens = {
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  borderPrimary: '#E5E7EB',
  borderSubtle: '#EEF2F7',
  accentBlue: '#2563EB',
  approveBg: '#10B981',
  approveBgHover: '#059669',
  declineText: '#DC2626',
  declineBorder: '#FCA5A5',
};

export const reviewCardContainerClass =
  'rounded-[16px] border border-[#E5E7EB] bg-white overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
export const reviewPageTitleClass = 'text-[26px] font-bold text-[#111827] leading-none';
export const reviewPageSubtitleClass = 'text-[15px] text-[#6B7280]';
export const reviewSectionHeaderClass = 'text-[12px] font-bold tracking-[0.04em] uppercase text-[#6B7280]';
export const reviewRowClass = 'border-b border-[#EEF2F7] hover:bg-gray-50/50';
export const reviewBadgePillClass =
  'text-[12px] px-2 py-0.5 rounded-full font-medium border-0 flex items-center justify-center';

export const reviewActionButtonPrimaryClass =
  'h-[36px] w-[36px] bg-[#10B981] hover:bg-[#059669] text-white rounded-[10px] shadow-sm flex-shrink-0';
export const reviewActionButtonDangerClass =
  'h-[36px] w-[36px] bg-white text-[#DC2626] border-[#FCA5A5] hover:bg-[#FEF2F2] rounded-[10px] shadow-sm flex-shrink-0';
export const reviewActionButtonSecondaryClass =
  'h-[36px] px-[12px] bg-white text-[#374151] border-[#E5E7EB] hover:bg-gray-50 rounded-[10px] font-semibold shadow-sm';

export const reviewToolbarSelectTriggerClass =
  'h-9 rounded-[14px] border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
export const reviewEmptyStateContainerClass =
  'text-center py-12 border border-[#E5E7EB] rounded-[16px] bg-white';
export const reviewMetricCardClass =
  'bg-white rounded-[20px] border border-[#E5E7EB] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center gap-4';
export const reviewMetricIconCircleClass = 'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0';
export const paginationRowsPerPageOptions = [5, 10, 25, 50] as const;

// Deterministic color cycle for industry badges (Discovery, supplier cards).
// Industries aren't a fixed taxonomy with semantic colors like document
// categories -- this just gives each industry a distinct, stable color by
// its position in the provided list, so the same industry always renders
// the same color without inventing a second taxonomy to maintain.
const INDUSTRY_BADGE_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-pink-50 text-pink-700 border-pink-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
];

export function getIndustryBadgeClass(industry: string | null | undefined, allIndustries: readonly string[]): string {
  if (!industry) return 'bg-slate-50 text-slate-600 border-slate-200';
  const index = Math.max(0, allIndustries.indexOf(industry));
  return INDUSTRY_BADGE_COLORS[index % INDUSTRY_BADGE_COLORS.length];
}
