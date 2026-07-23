import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Clock,
  FileCheck,
  FlaskConical,
  Inbox,
  Minus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ComplianceRing } from '@/components/dashboard/ComplianceRing';
import {
  dashboardCardClass,
  dashboardCardPrimaryClass,
} from '@/components/documents/buyerReviewDesignSystem';
import {
  BAR_RADIUS,
  SEMANTIC,
  SERIES,
  axisProps,
  gridProps,
  tooltipProps,
} from './chartTheme';
import {
  useBuyerDashboardData,
  type ActionItem,
  type ExpiringItem,
  type RiskHotspot,
} from './useBuyerDashboardData';
import { useBuyerAiSummary, type AiBullet } from './useBuyerAiSummary';

interface BuyerOverviewDashboardProps {
  buyerId: string | null | undefined;
  branchId: string | null;
  onTabChange: (tab: string) => void;
  onNewRequest: () => void;
  onAddSupplier: () => void;
}

/* ------------------------------------------------------------------ shells */

export const Panel = ({
  title,
  action,
  children,
  className = '',
  primary = false,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Lifts the panel a tier so the grid isn't uniformly weighted. */
  primary?: boolean;
}) => (
  <section
    className={`${primary ? dashboardCardPrimaryClass : dashboardCardClass} flex min-h-0 flex-col p-4 ${className}`}
  >
    <header className="mb-3 flex shrink-0 items-center justify-between gap-2">
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      {action}
    </header>
    {children}
  </section>
);

export const LinkOut = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-primary transition-colors hover:text-primary-hover"
  >
    {label} <ChevronRight className="h-3 w-3" />
  </button>
);

/** Shown wherever the data genuinely isn't there -- never a fabricated curve. */
export const Empty = ({ icon: Icon, children }: { icon: typeof Inbox; children: React.ReactNode }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
    <Icon className="h-6 w-6 text-muted-foreground/50" />
    <p className="max-w-[24ch] text-[12px] leading-snug text-muted-foreground">{children}</p>
  </div>
);

/** Renders AI-summary bullet text with the numbers (incl. percentages) in
 *  emphasized foreground ink, so the figures pop out of the muted copy. */
export const highlightNumbers = (text: string) =>
  text.split(/(\d+(?:\.\d+)?%?)/g).map((part, i) =>
    /^\d/.test(part) ? (
      <span key={i} className="font-semibold text-foreground">{part}</span>
    ) : (
      part
    )
  );

/** Real delta or nothing. There is no placeholder percentage here by design. */
export const Delta = ({ value, suffix = '' }: { value: number | null; suffix?: string }) => {
  if (value === null) {
    return <span className="font-mono text-[10px] text-muted-foreground">no prior month</span>;
  }
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-muted-foreground">
        <Minus className="h-3 w-3" /> no change
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-medium ${
        up ? 'text-success' : 'text-danger'
      }`}
    >
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {value}
      {suffix} vs last month
    </span>
  );
};

/* ------------------------------------------------------------------- rows */

const ActionRow = ({ item, onClick }: { item: ActionItem; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-muted"
  >
    <span
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.overdue ? 'bg-danger' : 'bg-primary'}`}
    />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-medium text-foreground">{item.title}</span>
      <span className="block truncate font-mono text-[11px] text-muted-foreground">
        {item.supplierName}
      </span>
    </span>
    {item.overdue && (
      <span className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-danger">
        overdue
      </span>
    )}
    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
  </button>
);

const ExpiringRow = ({ item, onClick }: { item: ExpiringItem; onClick: () => void }) => {
  const urgent = item.daysLeft <= 30;
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-muted"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {item.documentName}
        </span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {item.supplierName}
        </span>
      </span>
      <span
        className={`shrink-0 font-mono text-[11px] font-semibold tabular-nums ${
          urgent ? 'text-danger' : 'text-warning'
        }`}
      >
        {item.daysLeft}d
      </span>
    </button>
  );
};

const HotspotRow = ({ item, onClick }: { item: RiskHotspot; onClick: () => void }) => {
  const tone =
    item.level === 'High' ? 'text-danger' : item.level === 'Medium' ? 'text-warning' : 'text-success';
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-muted"
    >
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
        {item.supplierName}
      </span>
      {item.delta !== null && item.delta !== 0 && (
        <span
          className={`font-mono text-[10px] ${item.delta > 0 ? 'text-danger' : 'text-success'}`}
        >
          {item.delta > 0 ? '+' : ''}
          {item.delta}
        </span>
      )}
      <span className={`shrink-0 font-mono text-[12px] font-semibold tabular-nums ${tone}`}>
        {item.score}
      </span>
    </button>
  );
};

/* ------------------------------------------------------------------- main */

export const BuyerOverviewDashboard = ({
  buyerId,
  branchId,
  onTabChange,
  onNewRequest,
  onAddSupplier,
}: BuyerOverviewDashboardProps) => {
  const d = useBuyerDashboardData(buyerId, branchId);

  const ai = useBuyerAiSummary(buyerId);
  const navigate = useNavigate();

  const actionItems = [...d.overdue, ...d.awaitingReview];
  const actionTotal = actionItems.length + d.pendingConnections;
  const goDocs = () => onTabChange('documents');
  const goSuppliers = () => onTabChange('suppliers');

  /**
   * Locally-derived bullets. These were the whole card before the background job
   * existed; they stay as the fallback so a buyer whose summary hasn't generated
   * yet (or whose last run failed) still sees something true.
   */
  const fallbackBullets: AiBullet[] = [
    d.overdue.length > 0 && {
      text: `${d.overdue.length} request${d.overdue.length > 1 ? 's are' : ' is'} past due — chase these first.`,
      tone: 'danger' as const,
    },
    d.awaitingReview.length > 0 && {
      text: `${d.awaitingReview.length} submission${d.awaitingReview.length > 1 ? 's' : ''} awaiting your review.`,
      tone: 'warn' as const,
    },
    d.expiring[0]?.value > 0 && {
      text: `${d.expiring[0].value} document${d.expiring[0].value > 1 ? 's' : ''} expire within 30 days.`,
      tone: 'warn' as const,
    },
    d.scoreDelta !== null && {
      text: `Compliance score moved ${d.scoreDelta > 0 ? '+' : ''}${d.scoreDelta}pt vs last month.`,
      tone: 'neutral' as const,
    },
    d.hasRiskData && d.riskHotspots[0] && {
      text: `Highest risk supplier is ${d.riskHotspots[0].supplierName} at ${d.riskHotspots[0].score}.`,
      tone: 'warn' as const,
    },
    {
      text: `${d.connectedSuppliers} supplier${d.connectedSuppliers === 1 ? '' : 's'} connected.`,
      tone: 'neutral' as const,
    },
  ].filter(Boolean) as AiBullet[];

  const usingLive = ai.bullets.length > 0;
  const summaryBullets = (usingLive ? ai.bullets : fallbackBullets).slice(0, 7);
  const followUps = ai.followUps;

  const updatedLabel = ai.loading
    ? ''
    : usingLive && ai.generatedAt
      ? `Updated ${formatDistanceToNow(new Date(ai.generatedAt), { addSuffix: true })}`
      : 'Live view';

  /**
   * Hands the briefing plus the chosen question to the chat page and asks it to
   * send immediately, so the user arrives mid-conversation.
   */
  const askFollowUp = (question: string) => {
    const briefing = summaryBullets.map((b) => `- ${b.text}`).join('\n');
    navigate('/chat', {
      state: {
        initialPrompt: `Here is my compliance summary for today:\n${briefing}\n\n${question}`,
        autoSend: true,
      },
    });
  };

  if (d.error) {
    return (
      <div className={`${dashboardCardClass} p-8 text-center`}>
        <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-danger" />
        <p className="text-[13px] font-medium text-foreground">Couldn’t load your dashboard</p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">{d.error}</p>
        <button
          onClick={d.refresh}
          className="mt-4 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    /* One page: on lg+ the shell is bounded to the viewport minus the app chrome
       (72px header + main's py-5 = 112px) and the two rows split it, so long
       lists scroll INSIDE their panel instead of growing the page. Below lg it
       falls back to normal document flow. */
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex max-w-[1600px] flex-col gap-3.5 lg:h-[calc(100vh-112px)] lg:min-h-0"
    >
      {/* ---- Row 1: action queue (hero) | score + risk | AI summary ---- */}
      <div className="grid grid-cols-1 gap-3.5 lg:min-h-0 lg:flex-[1.05] lg:grid-cols-12">
        {/* Needs your action */}
        <Panel
          title="Needs your action"
          primary
          className="lg:col-span-5"
          action={<LinkOut label="All requests" onClick={goDocs} />}
        >
          <div className="mb-3 flex shrink-0 items-baseline gap-2">
            <span className="font-mono text-[30px] font-medium leading-none tabular-nums text-foreground">
              {d.loading ? '—' : actionTotal}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {d.overdue.length > 0 && (
                <span className="font-medium text-danger">{d.overdue.length} overdue · </span>
              )}
              {d.awaitingReview.length} awaiting review
              {d.pendingConnections > 0 && ` · ${d.pendingConnections} new connection`}
              {d.pendingConnections > 1 && 's'}
            </span>
          </div>
          <div className="-mx-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {d.loading ? null : actionItems.length === 0 ? (
              <Empty icon={FileCheck}>You’re all caught up — nothing is waiting on you.</Empty>
            ) : (
              actionItems.slice(0, 6).map((i) => <ActionRow key={i.id} item={i} onClick={goDocs} />)
            )}
          </div>
        </Panel>

        {/* Compliance score + risk hotspots */}
        <div className="flex flex-col gap-3.5 lg:col-span-4">
          <section className={`${dashboardCardClass} shrink-0 p-4`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-[12px] font-medium text-muted-foreground">
                  Overall compliance score
                </p>
                <p className="font-mono text-[30px] font-medium leading-none tabular-nums text-foreground">
                  {d.loading ? '—' : `${d.complianceScore}%`}
                </p>
                {/* The % on its own is decorative; the denominator is what makes
                    it actionable. */}
                {!d.loading && (
                  <p className="text-[12px] leading-snug text-muted-foreground">
                    <span className="font-medium text-foreground">{d.approvedTotal}</span> of{' '}
                    <span className="font-medium text-foreground">{d.requestTotal}</span> requested
                    documents approved
                  </p>
                )}
                {!d.loading && <Delta value={d.scoreDelta} suffix="pt" />}
              </div>
              <ComplianceRing score={d.complianceScore} size={56} strokeWidth={6} showLabel={false} />
            </div>
          </section>

          <Panel
            title="Risk hotspots"
            className="min-h-[168px] flex-1"
            action={<LinkOut label="Supplier risk" onClick={() => onTabChange('supplier-risk')} />}
          >
            <div className="-mx-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
              {d.loading ? null : !d.hasRiskData ? (
                <Empty icon={ShieldAlert}>
                  No risk scores yet. Run an assessment to populate this.
                </Empty>
              ) : (
                d.riskHotspots.map((h) => (
                  <HotspotRow key={h.supplierId} item={h} onClick={() => onTabChange('supplier-risk')} />
                ))
              )}
            </div>
          </Panel>
        </div>

        {/* AI Summary — kept, now on-brand and driven by real numbers */}
        <section className="ai-card flex flex-col p-4 lg:col-span-3">
          <header className="mb-3 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="text-[13px] font-semibold text-foreground">AI Summary</h3>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                Beta
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">{updatedLabel}</span>
              <button
                onClick={ai.refresh}
                disabled={ai.refreshing || !buyerId}
                aria-label="Regenerate summary"
                title="Regenerate summary"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${ai.refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </header>
          {/* justify-start, not center: centring the list was what left dead
              space above and below the bullets. */}
          <ul className="flex min-h-0 flex-1 flex-col justify-start gap-2.5 overflow-y-auto text-[12px] leading-relaxed text-muted-foreground">
            {summaryBullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span
                  className={`mt-[7px] h-1 w-1 shrink-0 rounded-full ${
                    b.tone === 'danger'
                      ? 'bg-danger'
                      : b.tone === 'warn'
                        ? 'bg-warning'
                        : 'bg-primary'
                  }`}
                />
                <span>{highlightNumbers(b.text)}</span>
              </li>
            ))}
          </ul>

          {/* Follow-ups: each hands the briefing plus the question to /chat and
              sends it, so the user lands mid-conversation rather than staring
              at an empty composer. */}
          {followUps.length > 0 && (
            <div className="mt-3 shrink-0 border-t border-primary/15 pt-2.5">
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Ask a follow-up
              </p>
              <div className="flex flex-wrap gap-1.5">
                {followUps.slice(0, 3).map((f) => (
                  <button
                    key={f.label}
                    onClick={() => askFollowUp(f.prompt)}
                    className="rounded-full border border-primary/25 bg-primary/[0.06] px-2.5 py-1 text-left text-[11px] font-medium text-foreground/85 transition-colors hover:border-primary/50 hover:bg-primary/12 hover:text-foreground"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ---- Row 2: approval trend | expiring | quick actions ---- */}
      <div className="grid grid-cols-1 gap-3.5 lg:min-h-0 lg:flex-1 lg:grid-cols-12">
        <Panel title="Approval activity — last 6 months" className="lg:col-span-5">
          {d.loading ? (
            <div className="h-[186px]" />
          ) : !d.hasHistory ? (
            <Empty icon={Clock}>
              Not enough history yet — this fills in once you have activity across two or more
              months.
            </Empty>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <Legend color={SERIES.accent} label="Approved" />
                <Legend color={SERIES.accentSoft} label="Submitted" />
                <Legend color={SERIES.neutral} label="Pending" />
                <Legend color={SEMANTIC.danger} label="Rejected" />
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={d.trend} barCategoryGap={20}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} width={26} />
                  <Tooltip {...tooltipProps} />
                  <Bar dataKey="approved" stackId="a" fill={SERIES.accent} />
                  <Bar dataKey="submitted" stackId="a" fill={SERIES.accentSoft} />
                  <Bar dataKey="pending" stackId="a" fill={SERIES.neutral} />
                  <Bar dataKey="rejected" stackId="a" fill={SEMANTIC.danger} radius={BAR_RADIUS} />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-1.5 shrink-0 font-mono text-[11px] text-muted-foreground">
                {d.approvedThisMonth} approved this month · <Delta value={d.approvedDelta} />
              </p>
            </>
          )}
        </Panel>

        <Panel
          title="Expiring soon"
          className="lg:col-span-4"
          action={<LinkOut label="All documents" onClick={goDocs} />}
        >
          {d.loading ? (
            <div className="h-[186px]" />
          ) : d.expiringItems.length === 0 ? (
            <Empty icon={FileCheck}>Nothing expires in the next 90 days.</Empty>
          ) : (
            <>
              {/* Three labelled buckets with counts on them. This replaced a
                  smooth area curve, which implied a continuous trend over what
                  are really three discrete windows -- and whose axis labels
                  collided at the right edge. */}
              <ExpiryBuckets buckets={d.expiring} total={d.expiringItems.length} />
              <div className="-mx-2 mt-2.5 min-h-0 flex-1 space-y-0.5 overflow-y-auto border-t border-border/60 pt-1.5">
                {d.expiringItems.slice(0, 4).map((i) => (
                  <ExpiringRow key={i.id} item={i} onClick={goDocs} />
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Quick actions" className="lg:col-span-3">
          <div className="flex flex-1 flex-col gap-1.5">
            {[
              { label: 'New compliance request', icon: FileCheck, onClick: onNewRequest },
              { label: 'Add new supplier', icon: UserPlus, onClick: onAddSupplier },
              { label: 'COA analysis', icon: FlaskConical, onClick: () => onTabChange('coa-analysis') },
              { label: 'Supplier risk review', icon: ShieldAlert, onClick: () => onTabChange('supplier-risk') },
            ].map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                className="group flex items-center gap-2.5 rounded-[12px] border border-border/70 px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
              >
                <a.icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                  {a.label}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
              </button>
            ))}

            {/* Fills what was dead space under four buttons with real workspace
                counts rather than padding. All three are queried, not derived. */}
            <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
              {[
                { label: 'Suppliers', value: d.connectedSuppliers, onClick: goSuppliers },
                { label: 'Onboarding', value: d.onboardingCount, onClick: () => onTabChange('onboarding') },
                { label: 'Requests', value: d.pendingConnections, onClick: goSuppliers },
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={s.onClick}
                  className="rounded-[10px] px-1 py-1.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="block font-mono text-[19px] font-medium leading-none tabular-nums text-foreground">
                    {d.loading ? '—' : s.value}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </motion.div>
  );
};

/**
 * Expiry windows as three proportional bars with the count stated on each.
 * Severity rises as the window shortens, so 0-30 reads danger and the later
 * windows step down -- the color carries meaning rather than decorating.
 */
const ExpiryBuckets = ({
  buckets,
  total,
}: {
  buckets: { bucket: string; value: number }[];
  total: number;
}) => {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const tone = [
    { bar: SEMANTIC.danger, text: 'text-danger' },
    { bar: SEMANTIC.warn, text: 'text-warning' },
    { bar: SERIES.neutral, text: 'text-muted-foreground' },
  ];
  return (
    <div className="shrink-0 space-y-2">
      <p className="font-mono text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">{total}</span> expiring in the next 90 days
      </p>
      {buckets.map((b, i) => (
        <div key={b.bucket} className="flex items-center gap-2.5">
          <span className="w-[62px] shrink-0 font-mono text-[11px] text-muted-foreground">
            {b.bucket.replace(' days', 'd')}
          </span>
          <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(b.value / max) * 100}%`, background: tone[i].bar }}
            />
          </span>
          <span
            className={`w-5 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums ${tone[i].text}`}
          >
            {b.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const Legend = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    {label}
  </span>
);
