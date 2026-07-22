import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Clock,
  FileCheck,
  Layers,
  PieChart as PieChartIcon,
  ShieldAlert,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ComplianceRing } from '@/components/dashboard/ComplianceRing';
import {
  Delta,
  Empty,
  LinkOut,
  Panel,
} from '@/components/dashboard/BuyerOverviewDashboard';
import { dashboardCardClass } from '@/components/documents/buyerReviewDesignSystem';
import { supabase } from '@/integrations/supabase/client';
import {
  BAR_RADIUS,
  SEMANTIC,
  SERIES,
  axisProps,
  gridProps,
  tooltipProps,
} from './chartTheme';
import { useBuyerDashboardData } from './useBuyerDashboardData';

interface BuyerPulseDashboardProps {
  buyerId: string | null | undefined;
  branchId: string | null;
  onTabChange: (tab: string) => void;
}

/* --------------------------------------------------- framework coverage */

interface FrameworkCoverage {
  code: string;
  /** compliant / total across all covered suppliers, 0-100. */
  pct: number;
  compliant: number;
  total: number;
}

/**
 * Same RPC the Framework Library coverage tab uses -- aggregated per
 * framework so a buyer sees which requirement families are actually covered.
 * Returns null when the org has activated nothing (panel is then omitted).
 */
function useFrameworkCoverage(buyerId: string | null | undefined): {
  rows: FrameworkCoverage[];
  loading: boolean;
} {
  const [rows, setRows] = useState<FrameworkCoverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!buyerId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // RPC isn't in generated types -- same `as any` convention as
        // useBuyerDashboardData's risk query.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = supabase as any;
        const { data, error } = await client.rpc('framework_coverage_v1', {
          p_buyer_id: buyerId,
        });
        if (cancelled) return;
        if (error) {
          setRows([]);
          return;
        }
        const coverage =
          (data as { coverage?: { framework_code: string; total: number; compliant: number }[] })
            ?.coverage ?? [];
        const byCode = new Map<string, { compliant: number; total: number }>();
        for (const r of coverage) {
          const cur = byCode.get(r.framework_code) ?? { compliant: 0, total: 0 };
          cur.compliant += r.compliant;
          cur.total += r.total;
          byCode.set(r.framework_code, cur);
        }
        const agg = Array.from(byCode.entries())
          .map(([code, v]) => ({
            code,
            compliant: v.compliant,
            total: v.total,
            pct: v.total > 0 ? Math.round((v.compliant / v.total) * 100) : 0,
          }))
          .sort((a, b) => a.pct - b.pct);
        setRows(agg);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [buyerId]);

  return { rows, loading };
}

/* ------------------------------------------------------------------ main */

export const BuyerPulseDashboard = ({
  buyerId,
  branchId,
  onTabChange,
}: BuyerPulseDashboardProps) => {
  const d = useBuyerDashboardData(buyerId, branchId);
  const coverage = useFrameworkCoverage(buyerId);

  const goDocs = (filter?: { expiration?: string }) => {
    if (filter?.expiration) {
      sessionStorage.setItem('buyer_docs_filter_expiration', filter.expiration);
    }
    onTabChange('documents');
  };

  // ---- derived series, all from the hook's real month buckets ------------

  /** Approval rate per month = approved / everything that moved that month. */
  const trendWithRate = d.trend.map((m) => {
    const moved = m.approved + m.submitted + m.rejected + m.pending;
    return {
      ...m,
      total: moved,
      rate: moved > 0 ? Math.round((m.approved / moved) * 100) : null,
    };
  });

  const mix = [
    { name: 'Approved', value: d.trend.reduce((s, m) => s + m.approved, 0), color: SERIES.accent },
    { name: 'Submitted', value: d.trend.reduce((s, m) => s + m.submitted, 0), color: SERIES.accentSoft },
    { name: 'Pending', value: d.trend.reduce((s, m) => s + m.pending, 0), color: SERIES.neutral },
    { name: 'Rejected', value: d.trend.reduce((s, m) => s + m.rejected, 0), color: SEMANTIC.danger },
  ];
  const mixTotal = mix.reduce((s, x) => s + x.value, 0);

  const riskTones: Record<string, string> = {
    High: SEMANTIC.danger,
    Medium: SEMANTIC.warn,
    Low: SEMANTIC.ok,
  };
  const riskTotal = d.riskBands.reduce((s, b) => s + b.value, 0);

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
    /* Graph-heavy view, so unlike the bounded overview/focus shells this one
       scrolls inside the app chrome instead of squeezing charts shorter. */
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex max-w-[1600px] flex-col gap-3.5 pb-6 lg:h-[calc(100vh-112px)] lg:min-h-0 lg:overflow-y-auto"
    >
      {/* ---- Header strip: score ring + deltas + quick stats ---- */}
      <section className={`${dashboardCardClass} shrink-0 p-4`}>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-4">
            <ComplianceRing score={d.complianceScore} size={64} strokeWidth={6} showLabel={false} />
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Compliance pulse
              </p>
              <p className="font-mono text-[28px] font-medium leading-none tabular-nums text-foreground">
                {d.loading ? '—' : `${d.complianceScore}%`}
              </p>
              {!d.loading && <Delta value={d.scoreDelta} suffix="pt" />}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-6">
            {[
              { label: 'Approved this month', value: d.approvedThisMonth, delta: d.approvedDelta },
              { label: 'Requests (6 mo)', value: d.requestTotal, delta: null },
              { label: 'Expiring ≤ 90d', value: d.expiringItems.length, delta: null },
              { label: 'Suppliers', value: d.connectedSuppliers, delta: null },
            ].map((s) => (
              <div key={s.label} className="space-y-1">
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className="font-mono text-[20px] font-medium leading-none tabular-nums text-foreground">
                  {d.loading ? '—' : s.value}
                </p>
                {!d.loading && s.delta !== null && <Delta value={s.delta} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Row: approval-rate trend | document mix donut ---- */}
      <div className="grid shrink-0 grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Panel title="Approval rate — last 6 months" className="min-h-[240px]">
          {d.loading ? (
            <div className="h-[190px]" />
          ) : !d.hasHistory ? (
            <Empty icon={Clock}>
              Not enough history yet — this fills in once you have activity across two or more
              months.
            </Empty>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={trendWithRate} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis
                    {...axisProps}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    width={34}
                  />
                  <Tooltip {...tooltipProps} formatter={(v: number) => [`${v}%`, 'Approval rate']} />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke={SERIES.accent}
                    fill={SERIES.accentSoft}
                    fillOpacity={0.35}
                    strokeWidth={2}
                    connectNulls
                    dot={{ r: 2.5, fill: SERIES.accent, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <p className="mt-1.5 shrink-0 font-mono text-[11px] text-muted-foreground">
                approved ÷ all request activity per month
              </p>
            </>
          )}
        </Panel>

        <Panel title="Document mix — last 6 months" className="min-h-[240px]">
          {d.loading ? (
            <div className="h-[190px]" />
          ) : mixTotal === 0 ? (
            <Empty icon={PieChartIcon}>No request activity in the last 6 months.</Empty>
          ) : (
            <div className="flex flex-1 items-center gap-4">
              <ResponsiveContainer width="55%" height={190}>
                <PieChart>
                  <Tooltip {...tooltipProps} />
                  <Pie
                    data={mix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                  >
                    {mix.map((m) => (
                      <Cell key={m.name} fill={m.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-1.5">
                {mix.map((m) => (
                  <li key={m.name} className="flex items-center gap-2 text-[12px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: m.color }} />
                    <span className="flex-1 text-muted-foreground">{m.name}</span>
                    <span className="font-mono font-semibold tabular-nums text-foreground">
                      {m.value}
                    </span>
                    <span className="w-9 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                      {Math.round((m.value / mixTotal) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {/* ---- Row: monthly volume | expiry forecast ---- */}
      <div className="grid shrink-0 grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Panel title="Monthly volume — requests vs approved" className="min-h-[240px]">
          {d.loading ? (
            <div className="h-[190px]" />
          ) : !d.hasHistory ? (
            <Empty icon={Clock}>
              Not enough history yet — this fills in once you have activity across two or more
              months.
            </Empty>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: SERIES.neutral }} />
                  Requests
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: SERIES.accent }} />
                  Approved
                </span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={trendWithRate} barCategoryGap={18} barGap={3}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} width={26} />
                  <Tooltip {...tooltipProps} />
                  <Bar dataKey="total" name="Requests" fill={SERIES.neutral} radius={BAR_RADIUS} />
                  <Bar dataKey="approved" name="Approved" fill={SERIES.accent} radius={BAR_RADIUS} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </Panel>

        <Panel
          title="Expiry forecast — next 90 days"
          className="min-h-[240px]"
          action={<LinkOut label="Expiring documents" onClick={() => goDocs({ expiration: 'expiring_soon' })} />}
        >
          {d.loading ? (
            <div className="h-[190px]" />
          ) : d.expiringItems.length === 0 ? (
            <Empty icon={FileCheck}>Nothing expires in the next 90 days.</Empty>
          ) : (
            <div className="flex flex-1 flex-col justify-center gap-3">
              {d.expiring.map((b, i) => {
                const max = Math.max(1, ...d.expiring.map((x) => x.value));
                const tone = [SEMANTIC.danger, SEMANTIC.warn, SERIES.neutral][i];
                return (
                  <div key={b.bucket} className="flex items-center gap-2.5">
                    <span className="w-[64px] shrink-0 font-mono text-[11px] text-muted-foreground">
                      {b.bucket.replace(' days', 'd')}
                    </span>
                    <span className="h-[9px] flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${(b.value / max) * 100}%`, background: tone }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-foreground">
                      {b.value}
                    </span>
                  </div>
                );
              })}
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">{d.expiringItems.length}</span>{' '}
                approved documents expire within 90 days
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* ---- Row: risk distribution | framework coverage (real only) ---- */}
      <div className="grid shrink-0 grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Panel
          title="Risk distribution"
          className="min-h-[220px]"
          action={<LinkOut label="Supplier risk" onClick={() => onTabChange('supplier-risk')} />}
        >
          {d.loading ? (
            <div className="h-[170px]" />
          ) : !d.hasRiskData ? (
            <Empty icon={ShieldAlert}>
              No risk scores yet. Run an assessment to populate this.
            </Empty>
          ) : (
            <div className="flex flex-1 flex-col gap-3">
              {/* Stacked single bar: the low/med/high split at a glance. */}
              <div>
                <div className="flex h-[10px] overflow-hidden rounded-full bg-muted">
                  {d.riskBands.map((b) =>
                    b.value > 0 ? (
                      <span
                        key={b.name}
                        className="block h-full"
                        style={{
                          width: `${(b.value / riskTotal) * 100}%`,
                          background: riskTones[b.name],
                        }}
                      />
                    ) : null,
                  )}
                </div>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                  {d.riskBands.map((b) => (
                    <span key={b.name} className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: riskTones[b.name] }}
                      />
                      {b.name}{' '}
                      <span className="font-mono font-semibold tabular-nums text-foreground">
                        {b.value}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="-mx-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto border-t border-border/60 pt-1.5">
                {d.riskHotspots.map((h) => (
                  <button
                    key={h.supplierId}
                    onClick={() => onTabChange('supplier-risk')}
                    className="group flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                      {h.supplierName}
                    </span>
                    <span
                      className="shrink-0 font-mono text-[12px] font-semibold tabular-nums"
                      style={{ color: riskTones[h.level] }}
                    >
                      {h.score}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Framework coverage: only rendered when the RPC returns real rows --
            an org with no activated frameworks simply doesn't get this panel. */}
        {!coverage.loading && coverage.rows.length > 0 && (
          <Panel
            title="Framework coverage"
            className="min-h-[220px]"
            action={<LinkOut label="Frameworks" onClick={() => onTabChange('frameworks')} />}
          >
            <div className="flex flex-1 flex-col justify-center gap-2.5">
              {coverage.rows.slice(0, 6).map((f) => (
                <div key={f.code} className="flex items-center gap-2.5">
                  <span className="w-[110px] shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                    {f.code}
                  </span>
                  <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${f.pct}%`,
                        background:
                          f.pct >= 80 ? SEMANTIC.ok : f.pct >= 50 ? SERIES.accent : SEMANTIC.warn,
                      }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-foreground">
                    {f.pct}%
                  </span>
                </div>
              ))}
              <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <Layers className="h-3 w-3" />
                compliant requirements across covered suppliers
              </p>
            </div>
          </Panel>
        )}
      </div>
    </motion.div>
  );
};
