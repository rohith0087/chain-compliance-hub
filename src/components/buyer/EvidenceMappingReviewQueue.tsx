import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, FileText, Loader2, RefreshCw, ScanLine, Sparkles, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  reviewCardContainerClass,
  reviewPageSubtitleClass,
  reviewPageTitleClass,
} from '@/components/documents/buyerReviewDesignSystem';

interface EvidenceMappingReviewQueueProps {
  buyerId: string;
  supplierId?: string;   // when set, only this supplier's mappings (workspace scope)
}

interface MappingRow {
  id: string;
  supplier_id: string;
  subject_type: string;
  framework_code: string;
  framework_version: string;
  requirement_key: string;
  requirement_title: string | null;
  evidence_version_id: string;
  evidence_display_name: string | null;
  evidence_document_type: string | null;
  status: 'proposed' | 'approved' | 'rejected';
  match_score: number | null;
  match_reasons: string[];
  proposed_at: string;
  decided_at: string | null;
  decision_notes: string | null;
  ai_confidence: number | null;
  ai_verdict: 'satisfies' | 'partial' | 'insufficient' | null;
  ai_reasoning: string | null;
  ai_concerns: string[] | null;
  ai_document_read: boolean | null;
  ai_document_excerpt: string | null;
  ai_findings: Array<{ label: string; value: string; supports?: 'yes' | 'no' | 'partial' }> | null;
}

const PAGE_SIZE = 50;

export default function EvidenceMappingReviewQueue({ buyerId, supplierId }: EvidenceMappingReviewQueueProps) {
  const [tab, setTab] = useState<'proposed' | 'decided'>('proposed');
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [supplierNames, setSupplierNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deciding, setDeciding] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState<string | null>(null);
  const [resubmitted, setResubmitted] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Phase 3 tables are not in generated types yet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      let query = client.from('requirement_evidence_mappings')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('proposed_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
      if (supplierId) query = query.eq('supplier_id', supplierId);
      query = tab === 'proposed' ? query.eq('status', 'proposed') : query.in('status', ['approved', 'rejected']);
      const { data, error: loadError } = await query;
      if (loadError) throw loadError;
      const pageRows = (data || []) as MappingRow[];
      setHasMore(pageRows.length > PAGE_SIZE);
      setRows(pageRows.slice(0, PAGE_SIZE));

      const supplierIds = [...new Set(pageRows.map((row) => row.supplier_id))];
      if (supplierIds.length) {
        const { data: suppliers } = await client.from('suppliers').select('id, company_name').in('id', supplierIds);
        setSupplierNames(new Map(((suppliers || []) as Array<{ id: string; company_name: string }>).map((s) => [s.id, s.company_name])));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }, [buyerId, tab, page, supplierId]);

  useEffect(() => { void load(); }, [load]);

  const [analyzing, setAnalyzing] = useState(false);
  const analyze = useCallback(async (mappingIds: string[]) => {
    if (!mappingIds.length) return;
    setAnalyzing(true);
    try {
      const { error: fnError } = await supabase.functions.invoke('analyze-evidence-mapping-v1', {
        body: { buyer_id: buyerId, mapping_ids: mappingIds.slice(0, 25) },
      });
      if (fnError) throw fnError;
      await load();
    } catch (analyzeError) {
      toast.error(analyzeError instanceof Error ? analyzeError.message : 'AI analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [buyerId, load]);

  // Auto-analyze proposed mappings that have no AI opinion yet, once per load.
  useEffect(() => {
    if (tab !== 'proposed' || loading || analyzing) return;
    const pending = rows.filter((row) => row.status === 'proposed' && row.ai_confidence == null)
      .map((row) => row.id);
    if (pending.length) void analyze(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tab, loading]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const needle = search.toLowerCase();
    return rows.filter((row) =>
      (row.requirement_title ?? row.requirement_key).toLowerCase().includes(needle)
      || row.framework_code.toLowerCase().includes(needle)
      || (row.evidence_display_name ?? row.evidence_document_type ?? '').toLowerCase().includes(needle)
      || (supplierNames.get(row.supplier_id) ?? '').toLowerCase().includes(needle));
  }, [rows, search, supplierNames]);

  const decide = async (mapping: MappingRow, decision: 'approved' | 'rejected') => {
    setDeciding(mapping.id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rpcError } = await (supabase as any).rpc('decide_requirement_evidence_mapping_v1', {
        p_mapping_id: mapping.id,
        p_decision: decision,
      });
      if (rpcError) throw rpcError;
      toast.success(
        decision === 'approved'
          ? 'Approved — this requirement is now marked compliant and the status recomputes automatically.'
          : 'Rejected — this evidence no longer satisfies the requirement. Ask the supplier to resubmit below.',
      );
      await load();
    } catch (decideError) {
      toast.error(decideError instanceof Error ? decideError.message : 'Decision failed');
    } finally {
      setDeciding(null);
    }
  };

  // Reject flow: ask the supplier to resubmit. Creates a fresh document request
  // for this requirement's evidence — when the new version arrives it is
  // re-proposed and re-analyzed here automatically (same pipeline).
  const requestResubmit = async (mapping: MappingRow) => {
    setResubmitting(mapping.id);
    try {
      const supplierName = supplierNames.get(mapping.supplier_id) ?? 'the supplier';
      const docType = mapping.evidence_document_type ?? mapping.requirement_key;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase as any).from('document_requests').insert({
        buyer_id: buyerId,
        supplier_id: mapping.supplier_id,
        title: `Resubmission requested: ${mapping.requirement_title ?? mapping.requirement_key}`,
        document_type: docType,
        category: mapping.framework_code,
        status: 'pending',
        description: `The previously submitted evidence did not satisfy "${mapping.requirement_title ?? mapping.requirement_key}" (${mapping.framework_code}). Please upload updated evidence.`,
      });
      if (insertError) throw insertError;
      setResubmitted((prev) => new Set(prev).add(mapping.id));
      toast.success(`Resubmission requested from ${supplierName}. The new version will be re-analyzed automatically.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the resubmission request');
    } finally {
      setResubmitting(null);
    }
  };

  const toggleExpanded = (id: string) => setExpanded((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className={reviewPageTitleClass}>
          <ClipboardCheck className="mr-2 inline h-7 w-7 text-primary" />
          Evidence Mapping Review
        </h1>
        <p className={reviewPageSubtitleClass}>
          AI reads each submitted document and judges it against the requirement — you can see exactly what it
          found and why. Your approval is what makes a requirement compliant; a rejection lets you ask the
          supplier to resubmit, and the new version is re-analyzed here automatically.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(value) => { setTab(value as 'proposed' | 'decided'); setPage(0); }}>
          <TabsList>
            <TabsTrigger value="proposed">Awaiting review</TabsTrigger>
            <TabsTrigger value="decided">Decided</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          className="max-w-xs"
          placeholder="Search requirement, framework, evidence, supplier…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <div key={row.id} className={`${reviewCardContainerClass} p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-mono">{row.framework_code} · {row.framework_version}</Badge>
                    <Badge variant="outline">{supplierNames.get(row.supplier_id) ?? row.subject_type}</Badge>
                    {row.status === 'approved' && <Badge className="bg-success/15 text-success hover:bg-success/15"><CheckCircle2 className="mr-1 h-3 w-3" />approved</Badge>}
                    {row.status === 'rejected' && <Badge className="bg-danger/15 text-danger hover:bg-danger/15"><XCircle className="mr-1 h-3 w-3" />rejected</Badge>}
                    {row.match_score !== null && (
                      <span className="text-xs text-muted-foreground">match {(Number(row.match_score) * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  <p className="mt-1 font-medium">{row.requirement_title ?? row.requirement_key}</p>
                  <p className="text-sm text-muted-foreground">
                    Evidence: {row.evidence_display_name ?? row.evidence_document_type ?? row.evidence_version_id}
                  </p>
                  {row.match_reasons?.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">Matched on: {row.match_reasons.join(', ').replaceAll('_', ' ')}</p>
                  )}
                </div>
                {row.status === 'proposed' && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" disabled={deciding === row.id} onClick={() => void decide(row, 'approved')}>
                      <ThumbsUp className="mr-1 h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" disabled={deciding === row.id} onClick={() => void decide(row, 'rejected')}>
                      <ThumbsDown className="mr-1 h-4 w-4" /> Reject
                    </Button>
                  </div>
                )}
              </div>

              {/* AI second opinion — it READS the document and judges it against
                  the requirement. Advisory only; the human decision changes status. */}
              {row.ai_confidence != null ? (
                <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">AI review</span>
                    <Badge variant="outline" className="text-xs capitalize">{row.ai_verdict ?? 'reviewed'}</Badge>
                    <span className="text-xs text-muted-foreground">confidence {(Number(row.ai_confidence) * 100).toFixed(0)}%</span>
                    {row.ai_document_read === true ? (
                      <Badge variant="outline" className="gap-1 text-micro text-success"><ScanLine className="h-3 w-3" />read the document</Badge>
                    ) : row.ai_document_read === false ? (
                      <Badge variant="outline" className="gap-1 text-micro text-warning"><FileText className="h-3 w-3" />couldn’t read file — judged on metadata</Badge>
                    ) : null}
                    <span className="text-micro text-muted-foreground">· advisory, not a decision</span>
                  </div>
                  {row.ai_reasoning && <p className="mt-1 text-sm">{row.ai_reasoning}</p>}

                  {/* What the AI found in the document */}
                  {row.ai_findings && row.ai_findings.length > 0 && (
                    <>
                      <button
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        onClick={() => toggleExpanded(row.id)}
                      >
                        {expanded.has(row.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        What the AI found ({row.ai_findings.length})
                      </button>
                      {expanded.has(row.id) && (
                        <div className="mt-2 overflow-hidden rounded-md border border-border">
                          <table className="w-full text-xs">
                            <tbody>
                              {row.ai_findings.map((f, i) => {
                                const tone = f.supports === 'yes' ? 'text-success' : f.supports === 'no' ? 'text-danger' : 'text-warning';
                                const mark = f.supports === 'yes' ? '✓' : f.supports === 'no' ? '✕' : '~';
                                return (
                                  <tr key={i} className="border-b border-border/60 last:border-0">
                                    <td className="w-40 bg-muted/40 px-2 py-1.5 font-medium text-muted-foreground">{f.label}</td>
                                    <td className="px-2 py-1.5">{f.value}</td>
                                    <td className={`w-6 px-2 py-1.5 text-center font-semibold ${tone}`}>{mark}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {row.ai_document_excerpt && (
                            <div className="border-t border-border bg-muted/20 px-2 py-1.5">
                              <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">Excerpt the AI read</p>
                              <p className="mt-0.5 line-clamp-3 text-micro italic text-muted-foreground">{row.ai_document_excerpt}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {row.ai_concerns && row.ai_concerns.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-xs text-warning">
                      {row.ai_concerns.map((concern, i) => <li key={i}>{concern}</li>)}
                    </ul>
                  )}
                </div>
              ) : analyzing ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> AI is reading the document and reviewing this mapping…
                </div>
              ) : (
                <div className="mt-3">
                  <Button size="sm" variant="ghost" onClick={() => void analyze([row.id])}>
                    <Sparkles className="mr-1 h-4 w-4" /> Analyze with AI
                  </Button>
                </div>
              )}

              {/* Reject → ask the supplier to resubmit; the new version re-enters this queue. */}
              {row.status === 'rejected' && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs">
                  <span className="text-warning">This evidence was rejected.</span>
                  {resubmitted.has(row.id) ? (
                    <span className="inline-flex items-center gap-1 font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" />Resubmission requested</span>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7" disabled={resubmitting === row.id} onClick={() => void requestResubmit(row)}>
                      {resubmitting === row.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                      Ask {supplierNames.get(row.supplier_id) ?? 'supplier'} to resubmit
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              {tab === 'proposed'
                ? 'No mappings awaiting review. Proposals appear automatically after compliance evaluations match evidence to requirements.'
                : 'No decided mappings yet.'}
            </div>
          )}
          {(page > 0 || hasMore) && (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
