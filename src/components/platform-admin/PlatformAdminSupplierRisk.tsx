import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { fetchAllSuppliersRiskOverview, type SupplierRiskOverview } from '@/features/supplier-risk/scoreApi';
import { AdminPageHeader, AdminCard, AdminStatCard, AdminDataTable, AdminBadge, type AdminColumn, type AdminTone } from './ui';
import { PlatformAdminSupplierRiskDetail } from './PlatformAdminSupplierRiskDetail';

type Level = 'High' | 'Medium' | 'Low' | 'None';

function riskLevel(row: SupplierRiskOverview): Level {
  if (row.active_events > 0 && row.max_severity >= 0.8) return 'High';
  if (row.active_events > 0 && row.max_severity >= 0.5) return 'Medium';
  if (row.active_events > 0 || row.review_events > 0) return 'Low';
  return 'None';
}

const LEVEL_TONE: Record<Level, AdminTone> = { High: 'danger', Medium: 'warning', Low: 'info', None: 'neutral' };

// Platform-wide supplier-risk map — ALL suppliers, connected or not (admin only).
// Data via get_all_suppliers_risk_overview RPC (SECURITY DEFINER, admin-gated).
export function PlatformAdminSupplierRisk() {
  const [rows, setRows] = useState<SupplierRiskOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SupplierRiskOverview | null>(null);

  useEffect(() => {
    fetchAllSuppliersRiskOverview()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.max_severity - a.max_severity || b.active_events - a.active_events),
    [rows],
  );

  const stats = useMemo(() => {
    const withRisk = rows.filter((r) => r.active_events > 0 || r.review_events > 0);
    const high = rows.filter((r) => riskLevel(r) === 'High').length;
    const review = rows.reduce((n, r) => n + r.review_events, 0);
    return { total: rows.length, withRisk: withRisk.length, high, review };
  }, [rows]);

  const columns: AdminColumn<SupplierRiskOverview>[] = [
    { key: 'company_name', header: 'Supplier', render: (r) => <span className="font-medium">{r.company_name}</span> },
    { key: 'industry', header: 'Industry', render: (r) => <span style={{ color: 'hsl(var(--admin-text-muted))' }}>{r.industry ?? '—'}</span> },
    { key: 'country', header: 'Country', render: (r) => r.country ?? '—' },
    {
      key: 'risk', header: 'Risk', render: (r) => {
        const level = riskLevel(r);
        return level === 'None' ? <span style={{ color: 'hsl(var(--admin-text-muted))' }}>—</span> : <AdminBadge tone={LEVEL_TONE[level]}>{level}</AdminBadge>;
      },
    },
    { key: 'active_events', header: 'Active', align: 'right', mono: true, render: (r) => r.active_events || '—' },
    { key: 'review_events', header: 'Review', align: 'right', mono: true, render: (r) => r.review_events || '—' },
    {
      key: 'dimensions', header: 'Dimensions',
      render: (r) => <span className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>{r.dimensions.length ? r.dimensions.join(', ') : '—'}</span>,
    },
  ];

  if (selected) {
    return <PlatformAdminSupplierRiskDetail supplier={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <AdminPageHeader
        title="Supplier Risk"
        description="Platform-wide external-risk view across every supplier, regardless of buyer connection."
        icon={<ShieldAlert className="h-5 w-5" />}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdminStatCard label="Suppliers" value={stats.total} />
        <AdminStatCard label="With risk signals" value={stats.withRisk} />
        <AdminStatCard label="High risk" value={stats.high} delta={stats.high ? { value: 'attention', tone: 'danger' } : undefined} />
        <AdminStatCard label="Pending review" value={stats.review} />
      </div>

      {error ? (
        <AdminCard><p className="text-sm" style={{ color: 'hsl(var(--admin-danger))' }}>{error}</p></AdminCard>
      ) : (
        <AdminCard flush>
          <AdminDataTable
            columns={columns}
            rows={sorted}
            rowKey={(r) => r.supplier_id}
            loading={loading}
            empty="No suppliers found."
            onRowClick={(r) => setSelected(r)}
          />
        </AdminCard>
      )}
    </div>
  );
}
