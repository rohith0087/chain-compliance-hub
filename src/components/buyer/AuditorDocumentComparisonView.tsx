import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowLeftRight, CheckCircle2, FileText, GitCompare, Loader2, ScanLine, Search, Sparkles, XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  reviewCardContainerClass, reviewPageSubtitleClass, reviewPageTitleClass,
} from '@/components/documents/buyerReviewDesignSystem';

interface Props { buyerId: string }

interface DocOption {
  id: string;
  name: string;
  document_type: string | null;
  supplier: string | null;
  status: string;
}

interface ComparisonResult {
  documents: Array<{ id: string; name: string; supplier: string | null; readable: boolean }>;
  summary: string;
  similarities: string[];
  differences: string[];
  field_comparison: Array<{ field: string; values: Array<{ doc: string; value: string }> }>;
  recommendation: string;
}

export default function AuditorDocumentComparisonView({ buyerId }: Props) {
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState('');
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('document_uploads')
        .select('id, document_name, file_name, status, document_requests!inner(document_type, buyer_id, suppliers(company_name))')
        .eq('document_requests.buyer_id', buyerId)
        .order('created_at', { ascending: false })
        .limit(300);
      setDocs(((data ?? []) as Array<Record<string, any>>).map((d) => ({
        id: d.id,
        name: d.document_name || d.file_name || d.document_requests?.document_type || 'Document',
        document_type: d.document_requests?.document_type ?? null,
        supplier: d.document_requests?.suppliers?.company_name ?? null,
        status: d.status,
      })));
    } finally {
      setLoading(false);
    }
  }, [buyerId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const n = search.trim().toLowerCase();
    if (!n) return docs;
    return docs.filter((d) => d.name.toLowerCase().includes(n) || (d.supplier ?? '').toLowerCase().includes(n) || (d.document_type ?? '').toLowerCase().includes(n));
  }, [docs, search]);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else { if (next.size >= 4) { toast.error('Compare up to 4 documents at a time.'); return prev; } next.add(id); }
    return next;
  });

  const compare = async () => {
    if (selected.size < 2) { toast.error('Select at least two documents.'); return; }
    setComparing(true); setError(null); setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('compare-documents-v1', {
        body: { buyer_id: buyerId, document_ids: [...selected], focus: focus.trim() || undefined },
      });
      if (fnError) throw fnError;
      setResult(data as ComparisonResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Comparison failed');
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <h1 className={reviewPageTitleClass}><GitCompare className="mr-2 inline h-7 w-7 text-primary" />AI Document Comparison</h1>
          <p className={reviewPageSubtitleClass}>
            Select 2–4 documents and let the auditor AI read them and produce a grounded, side-by-side comparison —
            similarities, differences, and a field-by-field breakdown. Advisory only; it cites what it read.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Picker */}
          <div className={`${reviewCardContainerClass} flex max-h-[560px] flex-col`}>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search documents, clients, types…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{selected.size}/4 selected · {filtered.length} documents</p>
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No documents match.</div>
              ) : filtered.map((d) => (
                <label key={d.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors ${selected.has(d.id) ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggle(d.id)} />
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{[d.supplier, d.document_type].filter(Boolean).join(' · ')}</p>
                  </div>
                  <Badge variant="outline" className="text-micro capitalize">{d.status.replace(/_/g, ' ')}</Badge>
                </label>
              ))}
            </div>
            <div className="border-t border-border p-3">
              <Input placeholder="Optional: what should the AI focus on? (e.g. scope, expiry, standards covered)" value={focus} onChange={(e) => setFocus(e.target.value)} />
              <Button className="mt-2 w-full" onClick={compare} disabled={comparing || selected.size < 2}>
                {comparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowLeftRight className="mr-2 h-4 w-4" />}
                Compare {selected.size >= 2 ? `${selected.size} documents` : 'documents'}
              </Button>
            </div>
          </div>

          {/* Results */}
          <div className="min-h-[400px]">
            {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Comparison unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            {comparing && (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Reading the documents and comparing…
              </div>
            )}
            {!comparing && !result && !error && (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                <GitCompare className="mb-3 h-8 w-8 text-muted-foreground/60" />
                <p className="font-medium text-foreground">Pick documents to compare</p>
                <p className="mt-1 max-w-xs text-sm">The AI reads each file and lays out how they line up — great for cross-checking certificates, specs, or revisions.</p>
              </div>
            )}
            {result && (
              <div className="space-y-4">
                <div className={`${reviewCardContainerClass} p-4`}>
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">Comparison summary</span>
                  </div>
                  <p className="text-sm">{result.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {result.documents.map((d, i) => (
                      <Badge key={d.id} variant="outline" className="gap-1 text-xs">
                        {d.readable ? <ScanLine className="h-3 w-3 text-success" /> : <XCircle className="h-3 w-3 text-warning" />}
                        Doc {i + 1}: {d.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {result.field_comparison.length > 0 && (
                  <div className={`${reviewCardContainerClass} overflow-x-auto`}>
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="p-3 font-medium">Field</th>
                        {result.documents.map((d, i) => <th key={d.id} className="p-3 font-medium">Doc {i + 1}</th>)}
                      </tr></thead>
                      <tbody>
                        {result.field_comparison.map((f, i) => (
                          <tr key={i} className="border-b last:border-0 align-top">
                            <td className="p-3 font-medium text-muted-foreground">{f.field}</td>
                            {result.documents.map((_, di) => (
                              <td key={di} className="p-3">{f.values[di]?.value ?? '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className={`${reviewCardContainerClass} p-4`}>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-success"><CheckCircle2 className="h-4 w-4" />Similarities</p>
                    {result.similarities.length ? <ul className="space-y-1.5 text-sm">{result.similarities.map((s, i) => <li key={i} className="flex gap-1.5"><span className="text-success">•</span>{s}</li>)}</ul> : <p className="text-sm text-muted-foreground">None identified.</p>}
                  </div>
                  <div className={`${reviewCardContainerClass} p-4`}>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-danger"><ArrowLeftRight className="h-4 w-4" />Differences</p>
                    {result.differences.length ? <ul className="space-y-1.5 text-sm">{result.differences.map((s, i) => <li key={i} className="flex gap-1.5"><span className="text-danger">•</span>{s}</li>)}</ul> : <p className="text-sm text-muted-foreground">None identified.</p>}
                  </div>
                </div>

                {result.recommendation && (
                  <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle>Auditor note</AlertTitle>
                    <AlertDescription>{result.recommendation}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
