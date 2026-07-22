import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Bot, ClipboardCheck, FileText, Loader2, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { reviewCardContainerClass } from '@/components/documents/buyerReviewDesignSystem';
import ComplianceDecisionsView from '@/components/buyer/ComplianceDecisionsView';
import EvidenceMappingReviewQueue from '@/components/buyer/EvidenceMappingReviewQueue';
import DossierGeneratorView from '@/components/buyer/DossierGeneratorView';
import ChatPage from '@/pages/ChatPage';

interface SupplierComplianceWorkspaceProps {
  buyerId: string;
  supplierId: string;
  supplierName?: string;
  dossiersEnabled?: boolean;
  onBack?: () => void;
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

type WorkspaceTab = 'overview' | 'decisions' | 'evidence' | 'assistant' | 'dossier';

// One page per supplier that clubs the whole compliance chain — computed status,
// evidence-mapping review, the grounded assistant, and the signed dossier — so a
// reviewer never has to jump between disconnected sub-pages to work one supplier.
export default function SupplierComplianceWorkspace({
  buyerId, supplierId, supplierName, dossiersEnabled = false, onBack,
}: SupplierComplianceWorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [resolvedName, setResolvedName] = useState<string | undefined>(supplierName);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data } = await client.rpc('framework_coverage_v1', { p_buyer_id: buyerId });
      const rows = ((data?.coverage ?? []) as CoverageRow[]).filter((r) => r.supplier_id === supplierId);
      setCoverage(rows);
      if (!resolvedName && rows.length) setResolvedName(rows[0].supplier_name);
      if (!resolvedName && !rows.length) {
        const { data: sup } = await client.from('suppliers').select('company_name').eq('id', supplierId).maybeSingle();
        if (sup?.company_name) setResolvedName(sup.company_name);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerId, supplierId]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => coverage.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      compliant: acc.compliant + r.compliant,
      gaps: acc.gaps + r.gaps,
      pending: acc.pending + r.pending,
    }),
    { total: 0, compliant: 0, gaps: 0, pending: 0 },
  ), [coverage]);

  const score = totals.total > 0 ? Math.round((totals.compliant / totals.total) * 100) : 0;

  const scoreTone = score === 100 ? 'text-success' : totals.gaps > 0 ? 'text-danger' : 'text-warning';

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto px-6 pb-6">
      <div className="mx-auto max-w-6xl">
        {/* Compact sticky header — breadcrumb + title + score + tabs on minimal rows */}
        <div className="sticky top-0 z-10 -mx-6 border-b border-border/60 bg-card/80 px-6 pb-2 pt-3 backdrop-blur">
          {onBack && (
            <button
              onClick={onBack}
              className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Frameworks &amp; coverage
              <span className="text-muted-foreground/50">/</span>
              <span className="font-medium text-foreground">{resolvedName ?? 'Supplier'}</span>
            </button>
          )}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
              <h1 className="truncate text-xl font-semibold text-foreground">{resolvedName ?? 'Supplier'}</h1>
              {totals.total > 0 && (
                <span className={`ml-1 inline-flex items-baseline gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-sm font-semibold ${scoreTone}`}>
                  {score}%
                  <span className="text-micro font-normal text-muted-foreground">{totals.compliant}/{totals.total} met</span>
                </span>
              )}
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(v as WorkspaceTab)}>
              <TabsList className="h-8">
                <TabsTrigger value="overview" className="text-xs"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Overview</TabsTrigger>
                <TabsTrigger value="decisions" className="text-xs"><ClipboardCheck className="mr-1 h-3.5 w-3.5" />Decisions</TabsTrigger>
                <TabsTrigger value="evidence" className="text-xs"><ClipboardCheck className="mr-1 h-3.5 w-3.5" />Evidence</TabsTrigger>
                <TabsTrigger value="assistant" className="text-xs"><Bot className="mr-1 h-3.5 w-3.5" />Assistant</TabsTrigger>
                {dossiersEnabled && <TabsTrigger value="dossier" className="text-xs"><FileText className="mr-1 h-3.5 w-3.5" />Dossier</TabsTrigger>}
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="pt-4">

        {tab === 'overview' && (
          loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading coverage…
            </div>
          ) : coverage.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              No frameworks are active for this supplier yet. Activate one from Frameworks to start tracking coverage,
              then use Decisions to compute status.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {coverage.map((row) => {
                const fullyCompliant = row.gaps === 0 && row.pending === 0 && row.compliant === row.total;
                return (
                  <div key={row.framework_code} className={`${reviewCardContainerClass} p-4`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-primary">{row.framework_code}</span>
                      {fullyCompliant
                        ? <Badge className="bg-success text-success hover:bg-success text-xs"><ShieldCheck className="mr-1 h-3 w-3" />compliant</Badge>
                        : row.gaps > 0
                          ? <Badge className="bg-danger text-danger hover:bg-danger text-xs">{row.gaps} gap{row.gaps > 1 ? 's' : ''}</Badge>
                          : <Badge className="bg-warning text-warning hover:bg-warning text-xs">{row.pending} in progress</Badge>}
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${fullyCompliant ? 'bg-success' : row.gaps > 0 ? 'bg-danger' : 'bg-warning'}`}
                        style={{ width: `${row.total > 0 ? (row.compliant / row.total) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {row.compliant}/{row.total} requirements met
                      {row.gaps > 0 && ` · ${row.gaps} gap${row.gaps > 1 ? 's' : ''}`}
                      {row.pending > 0 && ` · ${row.pending} pending evidence`}
                    </p>
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === 'decisions' && <ComplianceDecisionsView buyerId={buyerId} lockSupplierId={supplierId} />}
        {tab === 'evidence' && <EvidenceMappingReviewQueue buyerId={buyerId} supplierId={supplierId} />}
        {tab === 'assistant' && <ChatPage embedded lockedSupplier={{ id: supplierId, name: resolvedName ?? 'this supplier' }} />}
        {tab === 'dossier' && dossiersEnabled && <DossierGeneratorView buyerId={buyerId} lockSupplierId={supplierId} />}
        </div>
      </div>
    </div>
  );
}
