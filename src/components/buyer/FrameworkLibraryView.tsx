import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, BookOpenCheck, Building2, CheckCircle2, Globe, Landmark, ListChecks, Loader2,
  Search, Send, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  reviewCardContainerClass, reviewPageSubtitleClass, reviewPageTitleClass,
} from '@/components/documents/buyerReviewDesignSystem';

interface FrameworkLibraryViewProps {
  buyerId: string;
  onOpenSupplier?: (supplierId: string, supplierName: string) => void;
}

interface CatalogItem {
  code: string;
  name: string;
  description: string | null;
  industry: string | null;
  authority: string | null;
  region: string | null;
  sort_order: number;
  ready: boolean;
  activation_rows: number;
}

interface CoverageRow {
  framework_code: string;
  supplier_id: string;
  supplier_name: string;
  total: number;
  compliant: number;
  gaps: number;
  pending: number;
}

interface SupplierOption { id: string; company_name: string }
interface ActivationResult {
  framework_code: string;
  activations: Array<{ supplier_id: string | null }>;
  skipped: Array<{ supplier_id: string; reason: string }>;
  requests_created: number;
}

interface RequirementItem {
  stable_key: string;
  subject_types: string[];
  title: string;
  description: string;
  citation: string | null;
  source_url: string | null;
  evidence_count: number;
  required_evidence: Array<{ name?: string; document_type?: string; description?: string }>;
}
interface FrameworkDetail {
  framework_code: string;
  published: boolean;
  version?: string;
  requirements: RequirementItem[];
}

const ALL = '__all__';
const COVERAGE_PAGE_SIZE = 25;

export default function FrameworkLibraryView({ buyerId, onOpenSupplier }: FrameworkLibraryViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'catalog' | 'coverage'>('catalog');

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [codeToId, setCodeToId] = useState<Map<string, string>>(new Map());
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [buyerIndustry, setBuyerIndustry] = useState<string | null>(null);

  const [industryFilter, setIndustryFilter] = useState<string>(ALL);
  const [search, setSearch] = useState('');

  // activation dialog
  const [activationTarget, setActivationTarget] = useState<CatalogItem | null>(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [supplierSearch, setSupplierSearch] = useState('');
  const [allSuppliers, setAllSuppliers] = useState(false);
  const [activating, setActivating] = useState(false);
  const [lastResult, setLastResult] = useState<ActivationResult | null>(null);

  // framework detail (requirements drill-down)
  const [detailTarget, setDetailTarget] = useState<CatalogItem | null>(null);
  const [detail, setDetail] = useState<FrameworkDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // coverage filters (scale to many frameworks × many suppliers)
  const [coverageSearch, setCoverageSearch] = useState('');
  const [coverageFramework, setCoverageFramework] = useState<string>(ALL);
  const [coverageStatus, setCoverageStatus] = useState<'all' | 'gaps' | 'pending' | 'compliant'>('all');
  const [coveragePage, setCoveragePage] = useState(0);

  const openDetail = useCallback(async (item: CatalogItem) => {
    setDetailTarget(item);
    setDetail(null);
    if (!item.ready) return;
    setDetailLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcError } = await (supabase as any).rpc('framework_requirements_v1', { p_framework_code: item.code });
      if (rpcError) throw rpcError;
      setDetail(data as FrameworkDetail);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load requirements');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [cov, fw, conn, buyer] = await Promise.all([
        client.rpc('framework_coverage_v1', { p_buyer_id: buyerId }),
        client.from('requirement_frameworks').select('id, code'),
        client.from('buyer_supplier_connections').select('supplier_id, suppliers(id, company_name)').eq('buyer_id', buyerId).eq('status', 'approved'),
        client.from('buyers').select('industry').eq('id', buyerId).maybeSingle(),
      ]);
      if (cov.error) throw cov.error;
      const data = cov.data as { catalog: CatalogItem[]; coverage: CoverageRow[] };
      setCatalog(data.catalog ?? []);
      setCoverage(data.coverage ?? []);
      setCodeToId(new Map(((fw.data ?? []) as Array<{ id: string; code: string }>).map((r) => [r.code, r.id])));
      setSuppliers(((conn.data ?? []) as Array<{ suppliers: SupplierOption | SupplierOption[] | null }>)
        .flatMap((row) => { const s = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers; return s ? [s] : []; }));
      const ind = (buyer.data as { industry: string | null } | null)?.industry ?? null;
      setBuyerIndustry(ind);
      // Default the industry filter to the buyer's own industry if we have frameworks for it.
      if (ind && (data.catalog ?? []).some((c) => c.industry === ind)) setIndustryFilter(ind);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load frameworks');
    } finally {
      setLoading(false);
    }
  }, [buyerId]);

  useEffect(() => { void load(); }, [load]);

  const industries = useMemo(
    () => [...new Set(catalog.map((c) => c.industry).filter((i): i is string => Boolean(i)))].sort(),
    [catalog],
  );

  const filteredCatalog = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return catalog.filter((c) =>
      (industryFilter === ALL || c.industry === industryFilter)
      && (!needle || c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle) || (c.authority ?? '').toLowerCase().includes(needle)));
  }, [catalog, industryFilter, search]);

  // Coverage matrix: suppliers (rows) × activated frameworks (cols).
  const activatedCodes = useMemo(() => [...new Set(coverage.map((r) => r.framework_code))].sort(), [coverage]);
  const coverageBySupplier = useMemo(() => {
    const bySup = new Map<string, { name: string; cells: Map<string, CoverageRow> }>();
    for (const r of coverage) {
      if (!bySup.has(r.supplier_id)) bySup.set(r.supplier_id, { name: r.supplier_name, cells: new Map() });
      bySup.get(r.supplier_id)!.cells.set(r.framework_code, r);
    }
    return bySup;
  }, [coverage]);

  // Columns to render: all activated frameworks, or just the one being filtered on.
  const visibleCodes = useMemo(
    () => (coverageFramework === ALL ? activatedCodes : activatedCodes.filter((c) => c === coverageFramework)),
    [activatedCodes, coverageFramework],
  );

  // Rows after search + status + framework filters. A row matches a status if ANY
  // visible framework cell has that status (so filtering by "gaps" keeps suppliers
  // with at least one gap in the visible columns).
  const filteredCoverage = useMemo(() => {
    const needle = coverageSearch.trim().toLowerCase();
    return [...coverageBySupplier.entries()].filter(([, row]) => {
      if (needle && !row.name.toLowerCase().includes(needle)) return false;
      const cells = visibleCodes.map((c) => row.cells.get(c)).filter(Boolean) as CoverageRow[];
      if (coverageFramework !== ALL && cells.length === 0) return false; // supplier has no data for the picked framework
      if (coverageStatus === 'all') return true;
      return cells.some((cell) => {
        const fullyCompliant = cell.gaps === 0 && cell.pending === 0 && cell.compliant === cell.total;
        if (coverageStatus === 'gaps') return cell.gaps > 0;
        if (coverageStatus === 'pending') return cell.pending > 0 && cell.gaps === 0;
        return fullyCompliant; // 'compliant'
      });
    });
  }, [coverageBySupplier, coverageSearch, coverageStatus, coverageFramework, visibleCodes]);

  const coveragePageCount = Math.max(1, Math.ceil(filteredCoverage.length / COVERAGE_PAGE_SIZE));
  const pagedCoverage = useMemo(
    () => filteredCoverage.slice(coveragePage * COVERAGE_PAGE_SIZE, coveragePage * COVERAGE_PAGE_SIZE + COVERAGE_PAGE_SIZE),
    [filteredCoverage, coveragePage],
  );
  // Keep the page in range as filters shrink the result set.
  useEffect(() => { setCoveragePage(0); }, [coverageSearch, coverageStatus, coverageFramework]);

  const openActivation = (item: CatalogItem) => {
    setActivationTarget(item);
    setSelectedSuppliers(new Set());
    setSupplierSearch('');
    setAllSuppliers(false);
    setLastResult(null);
  };

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const n = supplierSearch.toLowerCase();
    return suppliers.filter((s) => s.company_name.toLowerCase().includes(n));
  }, [suppliers, supplierSearch]);

  const runActivation = async () => {
    if (!activationTarget || (!allSuppliers && selectedSuppliers.size === 0)) return;
    const frameworkId = codeToId.get(activationTarget.code);
    if (!frameworkId) { toast.error('Framework not found'); return; }
    setActivating(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('activate-framework-v1', {
        body: {
          buyer_id: buyerId, framework_id: frameworkId,
          supplier_ids: allSuppliers ? [] : [...selectedSuppliers],
          all_suppliers: allSuppliers, generate_requests: true,
        },
      });
      if (fnError) throw fnError;
      const result = data as ActivationResult;
      setLastResult(result);
      toast.success(`${result.framework_code} activated for ${result.activations.length} supplier(s) — ${result.requests_created} request(s) sent`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Framework activation failed');
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading frameworks…
      </div>
    );
  }

  const readyCount = catalog.filter((c) => c.ready).length;
  const activeCount = catalog.filter((c) => c.activation_rows > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className={reviewPageTitleClass}>
          <BookOpenCheck className="mr-2 inline h-7 w-7 text-primary" />
          Frameworks
        </h1>
        <p className={reviewPageSubtitleClass}>
          Your single source of truth for which standards apply, to which suppliers, and who is compliant.
          {buyerIndustry && <> Defaulted to your industry — <span className="font-medium">{buyerIndustry}</span>.</>}
        </p>
      </div>

      {error && (
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${reviewCardContainerClass} p-4`}>
          <p className="text-xs uppercase text-muted-foreground">Catalog</p>
          <p className="mt-1 text-3xl font-semibold">{catalog.length}</p>
          <p className="text-xs text-muted-foreground">{readyCount} ready to deploy</p>
        </div>
        <div className={`${reviewCardContainerClass} p-4`}>
          <p className="text-xs uppercase text-muted-foreground">Active frameworks</p>
          <p className="mt-1 text-3xl font-semibold text-primary">{activeCount}</p>
          <p className="text-xs text-muted-foreground">running across your suppliers</p>
        </div>
        <div className={`${reviewCardContainerClass} p-4`}>
          <p className="text-xs uppercase text-muted-foreground">Suppliers covered</p>
          <p className="mt-1 text-3xl font-semibold">{coverageBySupplier.size}</p>
          <p className="text-xs text-muted-foreground">with at least one framework</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'catalog' | 'coverage')}>
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="coverage">Coverage — who's compliant</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'catalog' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="max-w-xs"><SelectValue placeholder="Industry" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All industries</SelectItem>
                {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search frameworks…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {filteredCatalog.map((item) => (
              <div
                key={item.code}
                className={`${reviewCardContainerClass} flex cursor-pointer flex-col p-4 transition-colors hover:border-primary/40`}
                onClick={() => void openDetail(item)}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-primary">{item.code}</span>
                      {item.ready
                        ? <Badge className="bg-success/15 text-success hover:bg-success/15 text-xs">ready</Badge>
                        : <Badge variant="outline" className="text-xs">available</Badge>}
                      {item.activation_rows > 0 && (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-xs"><CheckCircle2 className="mr-1 h-3 w-3" />active</Badge>
                      )}
                    </div>
                    <h3 className="mt-1 truncate text-body font-semibold">{item.name}</h3>
                  </div>
                </div>
                {item.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {item.industry && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{item.industry}</span>}
                  {item.authority && <span className="inline-flex items-center gap-1"><Landmark className="h-3 w-3" />{item.authority}</span>}
                  {item.region && <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{item.region}</span>}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={(e) => { e.stopPropagation(); void openDetail(item); }}>
                    <ListChecks className="mr-1 h-4 w-4" /> View requirements
                  </Button>
                  {item.ready ? (
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); openActivation(item); }}>
                      <Send className="mr-1 h-4 w-4" /> Activate
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Requirement set coming soon</Badge>
                  )}
                </div>
              </div>
            ))}
            {filteredCatalog.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                No frameworks match. Try a different industry or clear the search.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {activatedCodes.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              No frameworks are active yet. Activate one from the Catalog to see coverage here.
            </div>
          ) : (
            <>
              {/* Filter toolbar — scales the matrix to many frameworks × many suppliers */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative max-w-xs flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Search suppliers…" value={coverageSearch} onChange={(e) => setCoverageSearch(e.target.value)} />
                </div>
                <Select value={coverageFramework} onValueChange={setCoverageFramework}>
                  <SelectTrigger className="w-[190px]"><SelectValue placeholder="Framework" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All frameworks ({activatedCodes.length})</SelectItem>
                    {activatedCodes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={coverageStatus} onValueChange={(v) => setCoverageStatus(v as typeof coverageStatus)}>
                  <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="gaps">Has gaps</SelectItem>
                    <SelectItem value="pending">Evidence in progress</SelectItem>
                    <SelectItem value="compliant">Fully compliant</SelectItem>
                  </SelectContent>
                </Select>
                <span className="ml-auto text-xs text-muted-foreground">
                  {filteredCoverage.length} of {coverageBySupplier.size} suppliers
                </span>
              </div>

              <div className={`${reviewCardContainerClass} overflow-x-auto`}>
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="sticky left-0 bg-card p-3 font-medium">Supplier</th>
                      {visibleCodes.map((code) => <th key={code} className="p-3 font-medium">{code}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCoverage.map(([supplierId, row]) => (
                      <tr
                        key={supplierId}
                        className={`border-b last:border-0 ${onOpenSupplier ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                        onClick={onOpenSupplier ? () => onOpenSupplier(supplierId, row.name) : undefined}
                      >
                        <td className="sticky left-0 bg-card p-3 font-medium">
                          <span className={onOpenSupplier ? 'text-primary underline-offset-2 hover:underline' : ''}>{row.name}</span>
                        </td>
                        {visibleCodes.map((code) => {
                          const cell = row.cells.get(code);
                          if (!cell) return <td key={code} className="p-3 text-muted-foreground/40">—</td>;
                          const fullyCompliant = cell.gaps === 0 && cell.pending === 0 && cell.compliant === cell.total;
                          const tone = fullyCompliant ? 'bg-success/15 text-success'
                            : cell.gaps > 0 ? 'bg-danger/15 text-danger'
                            : 'bg-warning/15 text-warning';
                          return (
                            <td key={code} className="p-3">
                              <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${tone}`}>
                                {fullyCompliant && <ShieldCheck className="h-3 w-3" />}
                                {cell.compliant}/{cell.total}
                                {cell.gaps > 0 && <span>· {cell.gaps} gap{cell.gaps > 1 ? 's' : ''}</span>}
                                {cell.pending > 0 && cell.gaps === 0 && <span>· {cell.pending} pending</span>}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {filteredCoverage.length === 0 && (
                      <tr><td colSpan={visibleCodes.length + 1} className="p-8 text-center text-muted-foreground">No suppliers match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {coveragePageCount > 1 && (
                <div className="flex items-center justify-end gap-2">
                  <span className="text-xs text-muted-foreground">Page {coveragePage + 1} of {coveragePageCount}</span>
                  <Button variant="outline" size="sm" disabled={coveragePage === 0} onClick={() => setCoveragePage((p) => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={coveragePage >= coveragePageCount - 1} onClick={() => setCoveragePage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Green = every requirement met · amber = evidence in progress · red = open gaps. Each cell shows compliant/total requirements.
            {onOpenSupplier && ' Click a supplier to open its full compliance workspace.'}
          </p>
        </div>
      )}

      {/* Activation dialog */}
      <Dialog open={Boolean(activationTarget)} onOpenChange={(open) => { if (!open) setActivationTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Activate {activationTarget?.code}</DialogTitle>
            <DialogDescription>
              Each selected supplier immediately receives one evidence request per requirement, with reminders until it arrives.
            </DialogDescription>
          </DialogHeader>

          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-primary/40 bg-primary/5 p-3">
            <Checkbox checked={allSuppliers} onCheckedChange={(c) => setAllSuppliers(c === true)} />
            <span className="text-sm">
              <span className="font-medium">All connected suppliers</span>
              <span className="ml-1 text-muted-foreground">({suppliers.length}) — one buyer-wide activation, covers future suppliers too</span>
            </span>
          </label>

          {!allSuppliers && (
            <>
              <div className="flex items-center gap-2">
                <Input placeholder={`Search ${suppliers.length} suppliers…`} value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)} />
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setSelectedSuppliers((prev) => {
                  const next = new Set(prev);
                  const allSel = filteredSuppliers.every((s) => next.has(s.id));
                  for (const s of filteredSuppliers) { if (allSel) next.delete(s.id); else next.add(s.id); }
                  return next;
                })}>
                  {filteredSuppliers.length > 0 && filteredSuppliers.every((s) => selectedSuppliers.has(s.id)) ? 'Clear filtered' : 'Select filtered'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{selectedSuppliers.size} selected</p>
              <div className="max-h-56 space-y-2 overflow-y-auto py-1">
                {filteredSuppliers.slice(0, 100).map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-2 hover:bg-muted/50">
                    <Checkbox checked={selectedSuppliers.has(s.id)} onCheckedChange={(c) => setSelectedSuppliers((prev) => {
                      const next = new Set(prev); if (c) next.add(s.id); else next.delete(s.id); return next;
                    })} />
                    <span className="text-sm">{s.company_name}</span>
                  </label>
                ))}
                {suppliers.length === 0 && <p className="text-sm text-muted-foreground">No approved supplier connections yet.</p>}
              </div>
            </>
          )}

          {lastResult && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" /><AlertTitle>Activated</AlertTitle>
              <AlertDescription>
                {lastResult.requests_created} evidence request(s) created across {lastResult.activations.length} supplier(s).
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActivationTarget(null)}>Close</Button>
            <Button onClick={() => void runActivation()} disabled={activating || (!allSuppliers && selectedSuppliers.size === 0)}>
              {activating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {allSuppliers ? `Activate for all ${suppliers.length}` : 'Activate & send requests'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Framework detail — the requirements the system tracks for this framework */}
      <Dialog open={Boolean(detailTarget)} onOpenChange={(open) => { if (!open) { setDetailTarget(null); setDetail(null); } }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-primary">{detailTarget?.code}</span>
              <span className="font-normal text-foreground">{detailTarget?.name}</span>
              {detail?.version && <Badge variant="outline" className="text-xs">v{detail.version}</Badge>}
            </DialogTitle>
            <DialogDescription>
              {detailTarget?.authority}{detailTarget?.region ? ` · ${detailTarget.region}` : ''}
              {' — '}the requirements the platform tracks and turns into evidence requests.
            </DialogDescription>
          </DialogHeader>

          {detailTarget?.description && <p className="text-sm text-muted-foreground">{detailTarget.description}</p>}

          {detailLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading requirements…
            </div>
          ) : !detailTarget?.ready ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              This framework is in the catalog but its requirement set isn’t published yet, so it can’t be activated.
              We’re building these out — reach out if you need it prioritized.
            </div>
          ) : detail && detail.requirements.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{detail.requirements.length} requirement{detail.requirements.length > 1 ? 's' : ''} in the published version. Each becomes an evidence request when you activate.</p>
              {detail.requirements.map((req, i) => (
                <div key={req.stable_key} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-micro font-semibold text-primary">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{req.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{req.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {req.subject_types.map((s) => <Badge key={s} variant="outline" className="text-micro capitalize">{s}</Badge>)}
                        {req.citation && <span className="text-micro text-muted-foreground">{req.citation}</span>}
                      </div>
                      {req.required_evidence?.length > 0 && (
                        <div className="mt-2 rounded-md bg-muted/40 p-2">
                          <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">Evidence asked for</p>
                          <ul className="mt-1 space-y-0.5">
                            {req.required_evidence.map((ev, j) => (
                              <li key={j} className="flex items-center gap-1.5 text-xs">
                                <ListChecks className="h-3 w-3 text-primary" />
                                {ev.name ?? ev.document_type ?? 'Document'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No requirements found for the published version.
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDetailTarget(null); setDetail(null); }}>Close</Button>
            {detailTarget?.ready && (
              <Button onClick={() => { const t = detailTarget; setDetailTarget(null); setDetail(null); if (t) openActivation(t); }}>
                <Send className="mr-2 h-4 w-4" /> Activate this framework
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
