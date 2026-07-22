import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Bot, Building2, Download, FileText, Loader2, Mail, Shield, ShieldCheck, Sparkles, TrendingUp,
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

// Full-page supplier profile that doubles as a live report preview — the exact
// data (real compliance + AI summary) that the downloadable PDF renders.
export default function SupplierDetailPage({ buyerId, supplierId, supplierName, onBack, onOpenCompliance }: Props) {
  const [data, setData] = useState<SupplierReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: res, error: fnError } = await supabase.functions.invoke('supplier-report-v1', {
        body: { buyer_id: buyerId, supplier_id: supplierId },
      });
      if (fnError) throw fnError;
      setData(res as SupplierReportData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load supplier report');
    } finally {
      setLoading(false);
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
  const score = data?.compliance_score ?? 0;
  const scoreTone = score >= 85 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-danger';

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto bg-muted/20 p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {onBack && (
          <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Suppliers
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
            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <ComplianceRing score={score} size={64} strokeWidth={7} />
                <div>
                  <p className={`text-2xl font-bold ${scoreTone}`}>{score}%</p>
                  <p className="text-xs text-muted-foreground">Compliance</p>
                </div>
              </div>
              {[
                { v: `${data.totals.compliant}/${data.totals.framework_requirements}`, l: 'Requirements met', icon: ShieldCheck },
                { v: String(data.totals.open_gaps), l: 'Open gaps', icon: Shield, tone: data.totals.open_gaps > 0 ? 'text-danger' : 'text-success' },
                { v: String(data.metrics.overdue), l: 'Overdue requests', icon: TrendingUp, tone: data.metrics.overdue > 0 ? 'text-danger' : undefined },
              ].map((k) => (
                <div key={k.l} className="rounded-xl border border-border bg-card p-4">
                  <k.icon className="h-4 w-4 text-muted-foreground" />
                  <p className={`mt-1 text-2xl font-bold ${k.tone ?? 'text-foreground'}`}>{k.v}</p>
                  <p className="text-xs text-muted-foreground">{k.l}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {data && !loading && (
          <>
            {/* AI executive summary */}
            {data.ai_summary && (
              <div className={`${reviewCardContainerClass} p-5`}>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Executive summary</h2>
                  <span className="text-micro text-muted-foreground">· AI-generated, grounded in this supplier’s record</span>
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
