import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Bot, Building2, Clock, Download, FileText, Inbox, Loader2, Mail, RefreshCw, ShieldCheck, Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ComplianceRing } from '@/components/dashboard/ComplianceRing';
import { reviewCardContainerClass } from '@/components/documents/buyerReviewDesignSystem';
import { renderSupplierReport, supplierReportFileName, downloadBlob, type SupplierReportData } from '@/services/SupplierReportService';

interface Props {
  buyerId: string;
  supplierId: string;
  supplierName?: string;
  onBack?: () => void;
  onOpenCompliance?: (supplierId: string, supplierName: string) => void;
}

const OUTCOME_TONE: Record<string, string> = {
  compliant: 'text-success', not_applicable: 'text-success',
  missing: 'text-danger', expired: 'text-danger', noncompliant: 'text-danger',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return String(iso); }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

// Full-page supplier profile that doubles as a live report preview — the exact
// data (real compliance + AI summary) that the downloadable PDF renders.
export default function SupplierDetailPage({ buyerId, supplierId, supplierName, onBack, onOpenCompliance }: Props) {
  const [data, setData] = useState<SupplierReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // `force` skips the server-side AI cache and regenerates the summary. The
  // default load reuses the cached summary whenever the supplier's compliance
  // snapshot is unchanged, so opening a supplier no longer costs a model call.
  const load = useCallback(async (force = false) => {
    if (force) setRegenerating(true); else setLoading(true);
    setError(null);
    try {
      const { data: res, error: fnError } = await supabase.functions.invoke('supplier-report-v1', {
        body: { buyer_id: buyerId, supplier_id: supplierId, force },
      });
      if (fnError) throw fnError;
      setData(res as SupplierReportData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load supplier report');
    } finally {
      setLoading(false); setRegenerating(false);
    }
  }, [buyerId, supplierId]);

  useEffect(() => { void load(); }, [load]);

  const generatePdf = () => {
    if (!data) return;
    setDownloading(true);
    try {
      downloadBlob(renderSupplierReport(data), supplierReportFileName(data));
      toast.success('Report downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate the PDF');
    } finally {
      setDownloading(false);
    }
  };

  const name = data?.supplier.company_name ?? supplierName ?? 'Supplier';

  // One story: the headline score IS the requirement engine's number — compliant
  // requirements ÷ total requirements — and the breakdown bar shows exactly where
  // the rest stand (in review vs open gaps), so the counts visibly sum to the total.
  const reqTotal = data?.totals.framework_requirements ?? 0;
  const reqMet = data?.totals.compliant ?? 0;
  const reqGaps = data?.totals.open_gaps ?? 0;
  const reqInReview = data ? data.framework_coverage.reduce((a, f) => a + (f.pending ?? 0), 0) : 0;
  const score = reqTotal > 0 ? Math.round((reqMet / reqTotal) * 100) : null;
  const scoreTone = score === null ? 'text-muted-foreground' : score >= 85 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-danger';
  const seg = (n: number) => (reqTotal > 0 ? (n / reqTotal) * 100 : 0);

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto bg-muted/20 p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            title="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        {/* Hero */}
        <div className={`${reviewCardContainerClass} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {data?.supplier.industry && <Badge variant="outline">{data.supplier.industry}</Badge>}
                  <Badge className="bg-success/15 text-success hover:bg-success/15">{data?.supplier.connection_status ?? 'Connected'}</Badge>
                  {data?.supplier.contact_email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{data.supplier.contact_email}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {onOpenCompliance && (
                <Button variant="outline" onClick={() => onOpenCompliance(supplierId, name)}>
                  <ShieldCheck className="mr-1 h-4 w-4" /> Compliance workspace
                </Button>
              )}
              <Button onClick={generatePdf} disabled={!data || downloading}>
                {downloading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />} Generate report
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Building report…</div>
          ) : error ? (
            <div className="p-6 text-sm text-danger">{error}</div>
          ) : data && (
            <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-stretch">
              {/* Headline score — requirement-based, so it always matches the breakdown */}
              <div className="flex items-center gap-4">
                <ComplianceRing score={score ?? 0} size={72} strokeWidth={8} />
                <div>
                  <p className={`text-3xl font-bold ${scoreTone}`}>{score === null ? '—' : `${score}%`}</p>
                  <p className="text-xs font-medium text-foreground">{score === null ? 'Not evaluated yet' : 'Requirements compliant'}</p>
                  <p className="mt-0.5 text-micro text-muted-foreground">
                    {score === null ? 'Run a compliance evaluation to score this supplier' : `${reqMet} of ${reqTotal} requirements met`}
                  </p>
                </div>
              </div>

              {/* Requirement breakdown — met + in review + gaps = total, visibly */}
              {reqTotal > 0 && (
                <div className="flex-1 rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requirement breakdown</p>
                  <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    {reqMet > 0 && <div className="h-full bg-success" style={{ width: `${seg(reqMet)}%` }} />}
                    {reqInReview > 0 && <div className="h-full bg-warning" style={{ width: `${seg(reqInReview)}%` }} />}
                    {reqGaps > 0 && <div className="h-full bg-danger" style={{ width: `${seg(reqGaps)}%` }} />}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /><strong className="text-foreground">{reqMet}</strong><span className="text-muted-foreground">met</span></span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /><strong className="text-foreground">{reqInReview}</strong><span className="text-muted-foreground">in review</span></span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger" /><strong className="text-foreground">{reqGaps}</strong><span className="text-muted-foreground">open gap{reqGaps === 1 ? '' : 's'}</span></span>
                  </div>
                </div>
              )}

              {/* Document requests — a separate signal, labeled as such */}
              <div className="rounded-xl border border-border bg-card p-4 lg:w-64">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Document requests</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className={`text-2xl font-bold ${data.metrics.overdue > 0 ? 'text-danger' : 'text-success'}`}>{data.metrics.overdue}</p>
                  <p className="text-xs text-muted-foreground">overdue</p>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><Inbox className="h-3 w-3" /> {data.metrics.pending} awaiting supplier</p>
                  <p className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {data.metrics.submitted} in your review</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {data && !loading && (
          <>
            {/* AI executive summary */}
            {data.ai_summary && (
              <div className={`${reviewCardContainerClass} p-5`}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Executive summary</h2>
                  <span className="text-micro text-muted-foreground">· AI-generated, grounded in this supplier’s record</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {data.ai_summary_meta?.generated_at && (
                      <span className="text-micro text-muted-foreground">
                        {data.ai_summary_meta.from_cache ? 'Updated' : 'Generated'} {fmtRelative(data.ai_summary_meta.generated_at)}
                      </span>
                    )}
                    <button
                      onClick={() => load(true)}
                      disabled={regenerating}
                      aria-label="Regenerate summary"
                      title="Regenerate summary"
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                <p className="font-medium text-foreground">{data.ai_summary.headline}</p>
                <p className="mt-1 text-sm text-muted-foreground">{data.ai_summary.overall_assessment}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {([['Strengths', data.ai_summary.strengths, 'text-success'], ['Risks', data.ai_summary.risks, 'text-danger'], ['Recommended actions', data.ai_summary.recommendations, 'text-primary']] as const).map(([label, items, tone]) => (
                    items.length > 0 && (
                      <div key={label}>
                        <p className={`text-xs font-semibold ${tone}`}>{label}</p>
                        <ul className="mt-1 space-y-1">
                          {items.map((it, i) => <li key={i} className="flex gap-1.5 text-xs text-muted-foreground"><span className={tone}>•</span>{it}</li>)}
                        </ul>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Framework coverage */}
            {data.framework_coverage.length > 0 && (
              <div className={`${reviewCardContainerClass} p-5`}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Framework coverage</h2>
                <div className="space-y-3">
                  {data.framework_coverage.map((f) => {
                    const pct = f.total > 0 ? (f.compliant / f.total) * 100 : 0;
                    const tone = f.gaps > 0 ? 'bg-danger' : f.compliant === f.total ? 'bg-success' : 'bg-warning';
                    return (
                      <div key={f.framework_code} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 font-mono text-sm font-semibold text-primary">{f.framework_code}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">
                          {f.compliant}/{f.total} met{f.gaps ? ` · ${f.gaps} gap${f.gaps > 1 ? 's' : ''}` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Requirement status */}
            {data.requirements.length > 0 && (
              <div className={`${reviewCardContainerClass} overflow-hidden`}>
                <h2 className="border-b border-border p-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Requirement status</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="p-3 font-medium">Framework</th><th className="p-3 font-medium">Requirement</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Valid until</th>
                    </tr></thead>
                    <tbody>
                      {data.requirements.map((r, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="p-3 font-mono text-xs text-primary">{r.framework_code}</td>
                          <td className="p-3">{r.requirement}</td>
                          <td className={`p-3 font-medium capitalize ${OUTCOME_TONE[r.outcome] ?? 'text-warning'}`}>{r.outcome.replace(/_/g, ' ')}</td>
                          <td className="p-3 text-muted-foreground">{fmtDate(r.valid_until)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent documents */}
            {data.recent_documents.length > 0 && (
              <div className={`${reviewCardContainerClass} overflow-hidden`}>
                <h2 className="border-b border-border p-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent documents</h2>
                <div className="divide-y divide-border">
                  {data.recent_documents.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm">{r.title}</span>
                      <Badge variant="outline" className="text-xs capitalize">{r.status.replace(/_/g, ' ')}</Badge>
                      <span className="w-24 text-right text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="pb-4 text-center text-xs text-muted-foreground">
              <Bot className="mr-1 inline h-3 w-3" /> This page and the PDF share the same computed data. Report generated {fmtDate(data.generated_at)}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
