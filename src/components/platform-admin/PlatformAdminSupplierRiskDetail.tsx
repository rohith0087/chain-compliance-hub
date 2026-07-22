import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Sparkles, RefreshCw, Activity, ExternalLink, FileSearch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { SupplierRiskOverview } from '@/features/supplier-risk/scoreApi';
import { AdminCard, AdminStatCard, AdminBadge, AdminDataTable, type AdminColumn, type AdminTone } from './ui';

interface RiskEventRow {
  id: string;
  event_type: string;
  dimension: string;
  severity: number;
  entity_match_confidence: number;
  source_confidence: number;
  status: string;
  remediation_status: string;
  evidence_status: string;
  occurred_at: string | null;
  detected_at: string;
  source_record_id: string | null;
  source_url: string | null;
  source_type: string | null;
  connector: string | null;
  source_title: string | null;
  source_published: string | null;
  source_summary: string | null;
}

const sourceLabel = (e: { source_type: string | null; connector: string | null }): string => {
  switch (e.source_type) {
    case 'adverse_media': return 'Adverse media';
    case 'openfda_enforcement': return 'FDA enforcement';
    case 'cpsc_recall': return 'CPSC recall';
    case 'sanctions':
    case 'ofac_sanctions': return 'OFAC sanctions';
    default: return e.connector ? e.connector.replace(/^ingest-/, '').replace(/-/g, ' ') : 'Monitored feed';
  }
};

const severityTone = (s: number): AdminTone => (s >= 0.8 ? 'danger' : s >= 0.5 ? 'warning' : 'info');
const statusTone = (s: string): AdminTone =>
  s === 'open' || s === 'accepted' ? 'warning' : s === 'under_review' ? 'info' : s === 'remediated' ? 'positive' : 'neutral';

const fmtPct = (n: number) => `${Math.round((n ?? 0) * 100)}%`;
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const humanize = (s: string) => s.replace(/_/g, ' ');

interface Props {
  supplier: SupplierRiskOverview;
  onBack: () => void;
}

export function PlatformAdminSupplierRiskDetail({ supplier, onBack }: Props) {
  const { toast } = useToast();
  const [events, setEvents] = useState<RiskEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryState, setSummaryState] = useState<'idle' | 'loading' | 'error'>('loading');
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  useEffect(() => {
    setLoading(true);
    client.rpc('get_supplier_risk_events_with_sources', { p_supplier_id: supplier.supplier_id })
      .then(({ data, error }: { data: RiskEventRow[] | null; error: { message: string } | null }) => {
        if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
        else setEvents(data ?? []);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier.supplier_id]);

  const generateSummary = useCallback(async () => {
    setSummaryState('loading');
    setSummaryError(null);
    const { data, error } = await client.functions.invoke('admin-supplier-risk-summary', {
      body: { supplier_id: supplier.supplier_id },
    });
    if (error || !data?.success) {
      setSummaryState('error');
      setSummaryError(data?.error || error?.message || 'AI summary unavailable.');
      return;
    }
    setSummary(data.summary as string);
    setSummaryState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier.supplier_id]);

  useEffect(() => { void generateSummary(); }, [generateSummary]);

  const dims = useMemo(() => {
    const map = new Map<string, { count: number; max: number }>();
    for (const e of events) {
      const cur = map.get(e.dimension) ?? { count: 0, max: 0 };
      map.set(e.dimension, { count: cur.count + 1, max: Math.max(cur.max, e.severity) });
    }
    return [...map.entries()].map(([dimension, v]) => ({ dimension, ...v })).sort((a, b) => b.max - a.max);
  }, [events]);

  const lastSignal = events[0]?.detected_at ?? null;
  const sources = useMemo(() => events.filter((e) => e.source_url), [events]);

  const columns: AdminColumn<RiskEventRow>[] = [
    { key: 'event_type', header: 'Signal', render: (e) => <span className="font-medium">{humanize(e.event_type)}</span> },
    { key: 'dimension', header: 'Dimension', render: (e) => <span style={{ color: 'hsl(var(--admin-text-muted))' }}>{humanize(e.dimension)}</span> },
    { key: 'severity', header: 'Severity', align: 'right', render: (e) => <AdminBadge tone={severityTone(e.severity)}>{fmtPct(e.severity)}</AdminBadge> },
    { key: 'entity_match_confidence', header: 'Match', align: 'right', mono: true, render: (e) => fmtPct(e.entity_match_confidence) },
    { key: 'status', header: 'Status', render: (e) => <AdminBadge tone={statusTone(e.status)}>{humanize(e.status)}</AdminBadge> },
    { key: 'evidence_status', header: 'Evidence', render: (e) => <span style={{ color: 'hsl(var(--admin-text-muted))' }}>{humanize(e.evidence_status)}</span> },
    {
      key: 'source', header: 'Source', render: (e) => e.source_url ? (
        <a href={e.source_url} target="_blank" rel="noopener noreferrer" title={e.source_title || sourceLabel(e)}
          className="inline-flex items-center gap-1 hover:underline" style={{ color: 'hsl(var(--admin-accent-blue))' }}>
          {sourceLabel(e)} <ExternalLink className="h-3 w-3" />
        </a>
      ) : <span style={{ color: 'hsl(var(--admin-text-muted))' }}>—</span>,
    },
    { key: 'detected_at', header: 'Detected', align: 'right', mono: true, render: (e) => fmtDate(e.detected_at) },
  ];

  return (
    <div>
      {/* Header with back */}
      <div className="mb-5 flex items-start gap-3">
        <button onClick={onBack} className="mt-1 rounded-md p-1.5 transition-colors hover:bg-[hsl(var(--admin-surface))]"
          style={{ border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} title="Back to all suppliers">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>{supplier.company_name}</h1>
            {supplier.max_severity >= 0.8 && supplier.active_events > 0 && <AdminBadge tone="danger">High risk</AdminBadge>}
          </div>
          <p className="mt-0.5 text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            {[supplier.industry, supplier.country].filter(Boolean).join(' · ') || 'Connected supplier'}
          </p>
        </div>
      </div>

      {/* AI summary */}
      <AdminCard className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ background: 'hsl(var(--admin-accent-weak))', color: 'hsl(var(--admin-accent-blue))' }}>
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>AI risk summary</h2>
          </div>
          <button onClick={() => void generateSummary()} disabled={summaryState === 'loading'}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50"
            style={{ border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text-muted))' }}>
            <RefreshCw className={`h-3 w-3 ${summaryState === 'loading' ? 'animate-spin' : ''}`} /> Regenerate
          </button>
        </div>
        {summaryState === 'loading' ? (
          <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Analyzing collected signals…</p>
        ) : summaryState === 'error' ? (
          <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            {summaryError} The collected data below is still complete.
          </p>
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: 'hsl(var(--admin-text))' }}>{summary}</p>
        )}
      </AdminCard>

      {/* Evidence & sources */}
      {sources.length > 0 && (
        <AdminCard flush className="mb-5">
          <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: 'hsl(var(--admin-border))' }}>
            <FileSearch className="h-4 w-4" style={{ color: 'hsl(var(--admin-accent-blue))' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>Evidence &amp; sources ({sources.length})</h2>
            <span className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>· click through to verify each record</span>
          </div>
          {sources.map((e) => (
            <div key={e.id} className="border-b px-5 py-3 last:border-b-0" style={{ borderColor: 'hsl(var(--admin-border))' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a href={e.source_url!} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-start gap-1 text-sm font-medium hover:underline" style={{ color: 'hsl(var(--admin-accent-blue))' }}>
                    <span>{e.source_title || humanize(e.event_type)}</span>
                    <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  </a>
                  {e.source_summary && (
                    <p className="mt-0.5 text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>{e.source_summary}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <AdminBadge tone="info">{sourceLabel(e)}</AdminBadge>
                  {e.source_published && (
                    <span className="admin-num text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>{e.source_published}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </AdminCard>
      )}

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdminStatCard label="Active signals" value={supplier.active_events} icon={<Activity className="h-4 w-4" />} />
        <AdminStatCard label="Under review" value={supplier.review_events} />
        <AdminStatCard label="Max severity" value={fmtPct(supplier.max_severity)} />
        <AdminStatCard label="Last signal" value={<span className="text-lg">{fmtDate(lastSignal)}</span>} />
      </div>

      {/* Dimensions + events */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        <AdminCard>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>Risk dimensions</h2>
          {dims.length === 0 ? (
            <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>No dimensions with active signals.</p>
          ) : (
            <div className="space-y-3">
              {dims.map((d) => (
                <div key={d.dimension}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span style={{ color: 'hsl(var(--admin-text))' }}>{humanize(d.dimension)}</span>
                    <span className="admin-num" style={{ color: 'hsl(var(--admin-text-muted))' }}>{d.count} · {fmtPct(d.max)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'hsl(var(--admin-surface))' }}>
                    <div className="h-full rounded-full" style={{ width: fmtPct(d.max), background: 'hsl(var(--admin-accent-blue))' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard flush className="min-w-0">
          <div className="border-b px-5 py-3" style={{ borderColor: 'hsl(var(--admin-border))' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>Collected signals ({events.length})</h2>
          </div>
          <AdminDataTable columns={columns} rows={events} rowKey={(e) => e.id} loading={loading}
            empty="No risk signals collected for this supplier yet." />
        </AdminCard>
      </div>
    </div>
  );
}
