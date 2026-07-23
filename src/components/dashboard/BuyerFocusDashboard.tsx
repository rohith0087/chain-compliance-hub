import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronRight,
  FileCheck,
  FileClock,
  ListTodo,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import { ComplianceRing } from '@/components/dashboard/ComplianceRing';
import {
  Delta,
  Empty,
  LinkOut,
  Panel,
  highlightNumbers,
} from '@/components/dashboard/BuyerOverviewDashboard';
import { dashboardCardClass } from '@/components/documents/buyerReviewDesignSystem';
import { Button } from '@/components/ui/button';
import {
  useBuyerDashboardData,
  type ActionItem,
  type ExpiringItem,
  type RiskHotspot,
} from './useBuyerDashboardData';
import { useBuyerAiSummary } from './useBuyerAiSummary';

interface BuyerFocusDashboardProps {
  buyerId: string | null | undefined;
  branchId: string | null;
  onTabChange: (tab: string) => void;
  onNewRequest: () => void;
  onAddSupplier: () => void;
}

/* ------------------------------------------------------------- triage row */

type TriageKind = 'overdue' | 'review' | 'expiring' | 'risk';

interface TriageItem {
  key: string;
  kind: TriageKind;
  /** true → above the urgent/up-next divider. */
  urgent: boolean;
  title: string;
  supplierName: string;
  /** Right-hand context, e.g. "overdue" or "12d". */
  meta?: string;
  actionLabel: string;
  go: () => void;
}

const KIND_ICON: Record<TriageKind, typeof FileClock> = {
  overdue: FileClock,
  review: ListTodo,
  expiring: FileCheck,
  risk: ShieldAlert,
};

const TriageRow = ({ rank, item }: { rank: number; item: TriageItem }) => {
  const Icon = KIND_ICON[item.kind];
  return (
    <div className="group flex w-full items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-muted">
      <span className="w-5 shrink-0 text-right font-mono text-micro tabular-nums text-muted-foreground/70">
        {rank}
      </span>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.urgent ? 'bg-danger' : 'bg-primary'}`}
      />
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-small font-medium text-foreground">{item.title}</span>
        <span className="block truncate font-mono text-micro text-muted-foreground">
          {item.supplierName}
        </span>
      </span>
      {item.meta && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-micro font-semibold uppercase ${
            item.kind === 'overdue'
              ? 'bg-danger/10 text-danger'
              : 'bg-muted font-medium normal-case text-muted-foreground'
          }`}
        >
          {item.meta}
        </span>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 gap-1 px-2.5 text-micro"
        onClick={item.go}
      >
        {item.actionLabel}
        <ChevronRight className="h-3 w-3" />
      </Button>
    </div>
  );
};

/* ------------------------------------------------------------------- main */

export const BuyerFocusDashboard = ({
  buyerId,
  branchId,
  onTabChange,
  onNewRequest,
  onAddSupplier,
}: BuyerFocusDashboardProps) => {
  const d = useBuyerDashboardData(buyerId, branchId);
  const ai = useBuyerAiSummary(buyerId);

  /** Documents tab, pre-filtered the same way the detailed view does it. */
  const goDocs = (filter?: { status?: string; expiration?: string }) => {
    if (filter?.status) sessionStorage.setItem('buyer_docs_filter_status', filter.status);
    if (filter?.expiration) {
      sessionStorage.setItem('buyer_docs_filter_expiration', filter.expiration);
    }
    onTabChange('documents');
  };

  // ---- build the unified ranked list ----------------------------------
  // Urgent group: anything already late, then anything waiting on the buyer.
  // Up next: expiry windows (soonest first) and risk hotspots. Ranking is
  // pure ordering over the hook's real data -- nothing is invented.
  const overdueItems: TriageItem[] = d.overdue.map((i: ActionItem) => ({
    key: `overdue-${i.id}`,
    kind: 'overdue',
    urgent: true,
    title: i.title,
    supplierName: i.supplierName,
    meta: 'overdue',
    actionLabel: 'Review',
    go: () => goDocs({ status: 'pending' }),
  }));
  const reviewItems: TriageItem[] = d.awaitingReview.map((i: ActionItem) => ({
    key: `review-${i.id}`,
    kind: 'review',
    urgent: true,
    title: i.title,
    supplierName: i.supplierName,
    actionLabel: 'Open queue',
    go: () => goDocs({ status: 'submitted' }),
  }));
  const expiringItems: TriageItem[] = d.expiringItems.map((i: ExpiringItem) => ({
    key: `expiring-${i.id}`,
    kind: 'expiring',
    urgent: false,
    title: i.documentName,
    supplierName: i.supplierName,
    meta: `${i.daysLeft}d`,
    actionLabel: 'View',
    go: () => goDocs({ expiration: 'expiring_soon' }),
  }));
  const riskItems: TriageItem[] = d.riskHotspots.map((h: RiskHotspot) => ({
    key: `risk-${h.supplierId}`,
    kind: 'risk',
    urgent: false,
    title: `${h.level} risk · score ${h.score}`,
    supplierName: h.supplierName,
    actionLabel: 'Assess',
    go: () => onTabChange('supplier-risk'),
  }));

  const urgent = [...overdueItems, ...reviewItems];
  const upNext = [...expiringItems, ...riskItems];
  const triage = [...urgent, ...upNext];

  if (d.error) {
    return (
      <div className={`${dashboardCardClass} p-8 text-center`}>
        <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-danger" />
        <p className="text-small font-medium text-foreground">Couldn’t load your dashboard</p>
        <p className="mt-1 font-mono text-micro text-muted-foreground">{d.error}</p>
        <button
          onClick={d.refresh}
          className="mt-4 rounded-[10px] bg-primary px-4 py-2 text-small font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Retry
        </button>
      </div>
    );
  }

  const todayLabel = format(new Date(), 'EEEE, MMM d');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex max-w-[1600px] flex-col gap-3.5 lg:h-[calc(100vh-112px)] lg:min-h-0"
    >
      {/* Today: the ranked triage list */}
      <Panel
        title={`Today — ${todayLabel}`}
        primary
        className="min-h-0 flex-1"
        action={
          <div className="flex items-center gap-3">
            {!d.loading && urgent.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 font-mono text-micro font-semibold uppercase text-danger">
                <AlertTriangle className="h-3 w-3" />
                {urgent.length} urgent
              </span>
            )}
            <LinkOut label="All requests" onClick={() => goDocs()} />
          </div>
        }
      >
        <div className="-mx-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {d.loading ? null : triage.length === 0 ? (
            <Empty icon={FileCheck}>You’re all caught up — nothing is waiting on you.</Empty>
          ) : (
            <>
              {urgent.map((item, idx) => (
                <TriageRow key={item.key} rank={idx + 1} item={item} />
              ))}
              {urgent.length > 0 && upNext.length > 0 && (
                <div className="mx-2 flex items-center gap-2 py-1.5" aria-hidden>
                  <span className="h-px flex-1 bg-border/70" />
                  <span className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                    Up next
                  </span>
                  <span className="h-px flex-1 bg-border/70" />
                </div>
              )}
              {upNext.map((item, idx) => (
                <TriageRow key={item.key} rank={urgent.length + idx + 1} item={item} />
              ))}
            </>
          )}
        </div>
      </Panel>

      {/* Bottom strip: cleared this month | score ring | AI summary */}
      <div className="grid shrink-0 grid-cols-1 gap-3.5 sm:grid-cols-3">
        <section className={`${dashboardCardClass} p-4`}>
          <p className="text-caption font-medium text-muted-foreground">Cleared this month</p>
          <p className="mt-1 font-mono text-h1 font-medium leading-none tabular-nums text-foreground">
            {d.loading ? '—' : d.approvedThisMonth}
          </p>
          <p className="mt-1.5 text-caption text-muted-foreground">approved</p>
          {!d.loading && (
            <div className="mt-1">
              <Delta value={d.approvedDelta} />
            </div>
          )}
          <div className="mt-2 border-t border-border/60 pt-2">
            <p className="text-caption text-muted-foreground">
              <span className="font-medium text-foreground">{d.approvedTotal}</span> of{' '}
              <span className="font-medium text-foreground">{d.requestTotal}</span> requests approved
            </p>
          </div>
        </section>

        <section className={`${dashboardCardClass} flex items-center justify-between gap-3 p-4`}>
          <div className="min-w-0 space-y-1">
            <p className="text-caption font-medium text-muted-foreground">Compliance score</p>
            <p className="font-mono text-h1 font-medium leading-none tabular-nums text-foreground">
              {d.loading ? '—' : `${d.complianceScore}%`}
            </p>
            {!d.loading && <Delta value={d.scoreDelta} suffix="pt" />}
          </div>
          <ComplianceRing score={d.complianceScore} size={56} strokeWidth={6} showLabel={false} />
        </section>

        <section className="ai-card flex flex-col p-4">
          <header className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="text-small font-semibold text-foreground">AI summary</h3>
          </header>
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto text-caption leading-relaxed text-muted-foreground">
            {(ai.loading ? [] : ai.bullets.slice(0, 3)).map((b, i) => (
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
            {!ai.loading && ai.bullets.length === 0 && (
              <li className="text-caption text-muted-foreground">
                No briefing yet — it generates in the background.
              </li>
            )}
          </ul>
        </section>
      </div>

      {/* Quick actions, inline and quiet */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="h-7 text-micro" onClick={onNewRequest}>
          New compliance request
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-micro" onClick={onAddSupplier}>
          Add new supplier
        </Button>
      </div>
    </motion.div>
  );
};
