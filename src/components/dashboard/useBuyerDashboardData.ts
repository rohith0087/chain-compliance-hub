import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { riskLevelOf, type RiskLevel } from '@/features/supplier-risk/templates';

/**
 * Real data for the buyer overview dashboard.
 *
 * The previous dashboard derived every chart from formulas over a handful of
 * counts -- `approved: base + i * 2`, a hardcoded 18/32/50 risk split, and a
 * literal "+4% vs last month". Everything here is queried. Where history is
 * genuinely absent the hook reports it (see `hasHistory`) so the UI can say so
 * instead of drawing an invented curve.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface MonthBucket {
  month: string;       // "Jul '26"
  key: string;         // "2026-07"
  approved: number;
  submitted: number;
  rejected: number;
  pending: number;
}

export interface ActionItem {
  id: string;
  title: string;
  supplierName: string;
  dueDate: string | null;
  overdue: boolean;
}

export interface ExpiringItem {
  id: string;
  documentName: string;
  supplierName: string;
  expiresOn: string;
  daysLeft: number;
}

export interface RiskHotspot {
  supplierId: string;
  supplierName: string;
  score: number;
  level: RiskLevel;
  delta: number | null;
}

export interface BuyerDashboardData {
  loading: boolean;
  error: string | null;

  connectedSuppliers: number;
  pendingConnections: number;
  onboardingCount: number;

  awaitingReview: ActionItem[];
  overdue: ActionItem[];

  expiring: { bucket: string; value: number }[];
  expiringItems: ExpiringItem[];

  trend: MonthBucket[];
  hasHistory: boolean;

  complianceScore: number;
  scoreDelta: number | null;
  /** Denominator context, so the headline % isn't a decorative number. */
  approvedTotal: number;
  requestTotal: number;
  approvedThisMonth: number;
  approvedDelta: number | null;

  riskBands: { name: RiskLevel; value: number }[];
  riskHotspots: RiskHotspot[];
  hasRiskData: boolean;
}

const EMPTY: BuyerDashboardData = {
  loading: true,
  error: null,
  connectedSuppliers: 0,
  pendingConnections: 0,
  onboardingCount: 0,
  awaitingReview: [],
  overdue: [],
  expiring: [],
  expiringItems: [],
  trend: [],
  hasHistory: false,
  complianceScore: 0,
  scoreDelta: null,
  approvedTotal: 0,
  requestTotal: 0,
  approvedThisMonth: 0,
  approvedDelta: null,
  riskBands: [],
  riskHotspots: [],
  hasRiskData: false,
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (d: Date) => `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;

function buildMonthSkeleton(): MonthBucket[] {
  const now = new Date();
  const out: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ month: monthLabel(d), key: monthKey(d), approved: 0, submitted: 0, rejected: 0, pending: 0 });
  }
  return out;
}

const daysBetween = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export function useBuyerDashboardData(
  buyerId: string | null | undefined,
  branchId: string | null,
): BuyerDashboardData & { refresh: () => void } {
  const [data, setData] = useState<BuyerDashboardData>(EMPTY);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!buyerId) {
      setData({ ...EMPTY, loading: false });
      return;
    }
    let cancelled = false;

    (async () => {
      setData((d) => ({ ...d, loading: true, error: null }));
      try {
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
        const today = now.toISOString().split('T')[0];
        const in90 = new Date(Date.now() + 90 * 86_400_000).toISOString().split('T')[0];

        // Requests carry supplier_id; names come from a second lookup rather
        // than an embed, since the FK alias differs across environments.
        let requestQuery = supabase
          .from('document_requests')
          .select('id, title, status, created_at, updated_at, due_date, supplier_id')
          .eq('buyer_id', buyerId)
          .gte('created_at', sixMonthsAgo);
        if (branchId) requestQuery = requestQuery.eq('branch_id', branchId);

        let uploadQuery = supabase
          .from('document_uploads')
          .select('id, document_name, file_name, expiration_date, status, request_id, document_requests!inner(buyer_id, branch_id, supplier_id)')
          .eq('document_requests.buyer_id', buyerId)
          .eq('status', 'approved')
          .not('expiration_date', 'is', null)
          .gte('expiration_date', today)
          .lte('expiration_date', in90);
        if (branchId) uploadQuery = uploadQuery.eq('document_requests.branch_id', branchId);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyClient = supabase as any;

        const [requestsRes, uploadsRes, connectionsRes, pendingConnRes, onboardingRes, riskRes] =
          await Promise.all([
            requestQuery,
            uploadQuery,
            supabase
              .from('buyer_supplier_connections')
              .select('id', { count: 'exact', head: true })
              .eq('buyer_id', buyerId)
              .eq('status', 'approved'),
            supabase
              .from('buyer_supplier_connections')
              .select('id', { count: 'exact', head: true })
              .eq('buyer_id', buyerId)
              .eq('status', 'pending'),
            supabase
              .from('supplier_onboarding_requests')
              .select('id', { count: 'exact', head: true })
              .eq('buyer_id', buyerId)
              .in('status', ['pending', 'invited', 'onboarding_initiated']),
            // Risk tables aren't in generated types yet -- same `as any`
            // convention documented in features/supplier-risk/scoreApi.ts.
            anyClient
              .from('supplier_risk_scores')
              .select('supplier_id, overall_score, previous_score, calculated_at')
              .eq('buyer_id', buyerId)
              .order('calculated_at', { ascending: false }),
          ]);

        if (cancelled) return;
        if (requestsRes.error) throw requestsRes.error;

        const requests = requestsRes.data ?? [];
        const uploads = uploadsRes.error ? [] : (uploadsRes.data ?? []);
        const riskRows = riskRes?.error ? [] : (riskRes?.data ?? []);

        // --- supplier names for everything that references a supplier_id ---
        const supplierIds = Array.from(
          new Set([
            ...requests.map((r: { supplier_id: string | null }) => r.supplier_id),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...riskRows.map((r: any) => r.supplier_id),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...uploads.map((u: any) => u.document_requests?.supplier_id),
          ].filter(Boolean) as string[]),
        );
        const nameById = new Map<string, string>();
        if (supplierIds.length) {
          const { data: sup } = await supabase
            .from('suppliers')
            .select('id, company_name')
            .in('id', supplierIds);
          for (const s of sup ?? []) nameById.set(s.id, s.company_name ?? 'Unknown supplier');
        }
        const nameOf = (id: string | null | undefined) =>
          (id && nameById.get(id)) || 'Unknown supplier';

        // --- 6-month trend, bucketed by the month the request moved ---
        const skeleton = buildMonthSkeleton();
        const byKey = new Map(skeleton.map((m) => [m.key, m]));
        for (const r of requests) {
          // Terminal states are bucketed by when they were decided; open states
          // by when they were raised.
          const isTerminal = r.status === 'approved' || r.status === 'rejected';
          const stamp = isTerminal ? (r.updated_at ?? r.created_at) : r.created_at;
          if (!stamp) continue;
          const bucket = byKey.get(monthKey(new Date(stamp)));
          if (!bucket) continue;
          if (r.status === 'approved') bucket.approved += 1;
          else if (r.status === 'rejected') bucket.rejected += 1;
          else if (r.status === 'submitted') bucket.submitted += 1;
          else if (r.status === 'pending') bucket.pending += 1;
        }
        const trend = skeleton;
        const monthsWithData = trend.filter(
          (m) => m.approved + m.submitted + m.rejected + m.pending > 0,
        ).length;

        const thisM = trend[trend.length - 1];
        const lastM = trend[trend.length - 2];
        const approvedDelta = monthsWithData >= 2 ? thisM.approved - lastM.approved : null;

        // --- compliance score, and a delta on the SAME basis ---
        // The score is cumulative (approved / all requests). An earlier version
        // compared two single-month rates against it, which mixed bases and let
        // a month with 2 requests swing the delta by tens of points. Both sides
        // are now cumulative: the portfolio today vs the portfolio as it stood
        // at the start of this month.
        // Caveat: request status is current-state, not historical, so the prior
        // figure re-uses today's statuses over the older request set. That is an
        // approximation, but a consistent one -- unlike the previous version.
        const totalApproved = requests.filter((r) => r.status === 'approved').length;
        const complianceScore = requests.length
          ? Math.round((totalApproved / requests.length) * 100)
          : 0;

        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const priorRequests = requests.filter(
          (r) => r.created_at && new Date(r.created_at) < startOfThisMonth,
        );
        // Below this many records a percentage is noise, not a trend.
        const MIN_SAMPLE = 5;
        const priorScore =
          priorRequests.length >= MIN_SAMPLE
            ? Math.round(
                (priorRequests.filter((r) => r.status === 'approved').length /
                  priorRequests.length) *
                  100,
              )
            : null;
        const scoreDelta = priorScore !== null ? complianceScore - priorScore : null;

        // --- action queue ---
        const toItem = (r: {
          id: string; title: string; due_date: string | null; supplier_id: string | null;
        }): ActionItem => ({
          id: r.id,
          title: r.title,
          supplierName: nameOf(r.supplier_id),
          dueDate: r.due_date,
          overdue: !!r.due_date && new Date(r.due_date) < now,
        });
        const awaitingReview = requests.filter((r) => r.status === 'submitted').map(toItem);
        const overdue = requests
          .filter((r) => r.status === 'pending' && r.due_date && new Date(r.due_date) < now)
          .map(toItem);

        // --- expiry buckets, real ---
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expiringItems: ExpiringItem[] = (uploads as any[])
          .map((u) => ({
            id: u.id,
            documentName: u.document_name || u.file_name || 'Document',
            supplierName: nameOf(u.document_requests?.supplier_id),
            expiresOn: u.expiration_date,
            daysLeft: daysBetween(u.expiration_date),
          }))
          .sort((a, b) => a.daysLeft - b.daysLeft);
        const inRange = (lo: number, hi: number) =>
          expiringItems.filter((e) => e.daysLeft >= lo && e.daysLeft <= hi).length;
        const expiring = [
          { bucket: '0-30 days', value: inRange(0, 30) },
          { bucket: '31-60 days', value: inRange(31, 60) },
          { bucket: '61-90 days', value: inRange(61, 90) },
        ];

        // --- risk, from the real engine: latest row per supplier ---
        const latestBySupplier = new Map<string, { overall_score: number; previous_score: number | null }>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const row of riskRows as any[]) {
          if (!latestBySupplier.has(row.supplier_id)) {
            latestBySupplier.set(row.supplier_id, {
              overall_score: row.overall_score,
              previous_score: row.previous_score,
            });
          }
        }
        const hotspots: RiskHotspot[] = Array.from(latestBySupplier.entries())
          .map(([supplierId, s]) => ({
            supplierId,
            supplierName: nameOf(supplierId),
            score: Math.round(s.overall_score),
            level: riskLevelOf(s.overall_score),
            delta: s.previous_score != null ? Math.round(s.overall_score - s.previous_score) : null,
          }))
          .sort((a, b) => b.score - a.score);

        const bandCount = (lvl: RiskLevel) => hotspots.filter((h) => h.level === lvl).length;
        const riskBands = ([['High'], ['Medium'], ['Low']] as [RiskLevel][]).map(([name]) => ({
          name,
          value: bandCount(name),
        }));

        setData({
          loading: false,
          error: null,
          connectedSuppliers: connectionsRes.count ?? 0,
          pendingConnections: pendingConnRes.count ?? 0,
          onboardingCount: onboardingRes.count ?? 0,
          awaitingReview,
          overdue,
          expiring,
          expiringItems,
          trend,
          hasHistory: monthsWithData >= 2,
          complianceScore,
          scoreDelta,
          approvedTotal: totalApproved,
          requestTotal: requests.length,
          approvedThisMonth: thisM.approved,
          approvedDelta,
          riskBands,
          riskHotspots: hotspots.slice(0, 5),
          hasRiskData: hotspots.length > 0,
        });
      } catch (e) {
        if (cancelled) return;
        setData({
          ...EMPTY,
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load dashboard',
        });
      }
    })();

    return () => { cancelled = true; };
  }, [buyerId, branchId, nonce]);

  return { ...data, refresh };
}
