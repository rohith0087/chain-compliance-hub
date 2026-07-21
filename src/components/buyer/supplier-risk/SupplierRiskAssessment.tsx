import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, FileDown, Share2, Flag, ChevronRight, Send, RefreshCw, Loader2 } from 'lucide-react';
import { suppliers as demoSuppliers, SupplierRiskProfile, DocumentItem } from './riskData';
import { RiskScoreHero } from './RiskScoreHero';
import { KeyDrivers } from './KeyDrivers';
import { SignalsSection } from './SignalsSection';
import { DocumentRiskSection } from './DocumentRiskSection';
import { ModelTuningPanel } from './ModelTuningPanel';
import { SupplierProfileSidebar } from './SupplierProfileSidebar';
import { RequestDetailsModal } from './RequestDetailsModal';
import { generateSupplierRiskPDF } from '@/utils/generateSupplierRiskPDF';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceProfile } from '@/hooks/useWorkspaceProfile';
import { AuditFindingsTab } from '@/components/buyer/audit/AuditFindingsTab';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierPerformance } from '@/hooks/useSupplierPerformance';
import { useSupplierRiskFeature } from '@/hooks/useSupplierRiskFeature';
import { useSupplierRisk } from '@/features/supplier-risk/useSupplierRisk';
import { SupplierRiskGraph } from '@/features/supplier-risk/SupplierRiskGraph';
import { RiskPolicyConfig } from '@/features/supplier-risk/RiskPolicyConfig';
import { buildRealProfile } from './adapters';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  /** Buyer org id. When provided and the supplier_risk flag is on, the page runs
   *  on the real risk engine; otherwise it falls back to the demo dataset. */
  buyerId?: string;
}

export function SupplierRiskAssessment({ buyerId }: Props) {
  const { profile, user } = useAuth();
  const { t, flags } = useWorkspaceProfile();

  // ---- real-engine plumbing ----
  const { enabled, loading: flagLoading } = useSupplierRiskFeature(buyerId);
  const realMode = Boolean(buyerId) && enabled;
  const { suppliers: realSuppliers } = useSuppliers();
  const { performance } = useSupplierPerformance(buyerId);

  const [selectedId, setSelectedId] = useState(demoSuppliers[0].id);
  const [modalOpen, setModalOpen] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);

  // Default selection when real suppliers arrive.
  useEffect(() => {
    if (realMode && realSuppliers.length > 0 && !realSuppliers.some((s) => s.id === selectedId)) {
      setSelectedId(realSuppliers[0].id);
    }
  }, [realMode, realSuppliers, selectedId]);

  // `selectedId` starts as a demo id (non-UUID) and only becomes a real supplier
  // UUID after the default-selection effect runs. Never hand a demo id to the
  // engine queries — the supplier_id column is a uuid, so a value like
  // 'blueriver' triggers a PostgREST 400 ("invalid input syntax for type uuid")
  // and surfaces as a spurious "Failed to load risk" toast on first render.
  const realSelectedId = realMode
    ? (realSuppliers.some((s) => s.id === selectedId) ? selectedId : realSuppliers[0]?.id ?? null)
    : null;

  const { score, events, recomputing, recompute, reload } = useSupplierRisk(
    realMode ? buyerId ?? null : null,
    realSelectedId,
  );

  // Per-supplier extras: recent documents, connection date, facility count.
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [connectedDate, setConnectedDate] = useState<string | null>(null);
  const [facilities, setFacilities] = useState(0);
  useEffect(() => {
    if (!realMode || !buyerId || !realSelectedId) return;
    let active = true;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const today = new Date().toISOString().slice(0, 10);
      const [up, conn, fac] = await Promise.all([
        client.from('document_uploads')
          .select('status, expiration_date, created_at, document_requests!inner(title, document_type, buyer_id, supplier_id)')
          .eq('document_requests.buyer_id', buyerId).eq('document_requests.supplier_id', realSelectedId)
          .order('created_at', { ascending: false }).limit(8),
        client.from('buyer_supplier_connections')
          .select('responded_at, requested_at').eq('buyer_id', buyerId).eq('supplier_id', realSelectedId).maybeSingle(),
        client.from('company_branches')
          .select('id', { count: 'exact', head: true }).eq('company_id', realSelectedId).eq('company_type', 'supplier'),
      ]);
      if (!active) return;
      setDocs(((up.data ?? []) as Array<{ status: string; expiration_date: string | null; document_requests: { title: string | null; document_type: string | null } }>).map((d) => ({
        name: d.document_requests?.title || d.document_requests?.document_type || 'Document',
        status: d.expiration_date && d.expiration_date < today ? 'Expired' : d.status === 'approved' ? 'Approved' : 'Pending',
        expiryDate: d.expiration_date ? new Date(d.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
      })));
      const cd = conn.data?.responded_at ?? conn.data?.requested_at ?? null;
      setConnectedDate(cd ? new Date(cd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null);
      setFacilities(fac.count ?? 0);
    })();
    return () => { active = false; };
  }, [realMode, buyerId, realSelectedId]);

  // ---- profile: real adapter or demo dataset ----
  const supplier: SupplierRiskProfile = useMemo(() => {
    if (realMode) {
      const s = realSuppliers.find((x) => x.id === selectedId) ?? realSuppliers[0];
      if (s) {
        return buildRealProfile({
          supplier: s,
          score,
          events,
          performance: performance.find((p) => p.supplier_id === s.id) ?? null,
          documents: docs,
          connectedDate,
          facilities,
        });
      }
    }
    return demoSuppliers.find((x) => x.id === selectedId) ?? demoSuppliers[0];
  }, [realMode, realSuppliers, selectedId, score, events, performance, docs, connectedDate, facilities]);

  const pickerOptions = realMode
    ? realSuppliers.map((s) => ({ id: s.id, name: s.company_name }))
    : demoSuppliers.map((s) => ({ id: s.id, name: s.name }));

  // Animate score on supplier/score change.
  useEffect(() => {
    setAnimatedScore(0);
    const timer = setTimeout(() => setAnimatedScore(supplier.score), 100);
    return () => clearTimeout(timer);
  }, [supplier.score, selectedId]);

  const handleRecompute = async () => {
    await recompute();
    await reload();
  };

  const lastRefresh = realMode
    ? (score ? `Scored ${new Date(score.calculated_at).toLocaleString()}` : 'No score yet — recompute')
    : 'Last refresh: 12 min ago';

  if (buyerId && flagLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading supplier risk…
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>Compliance</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{t.supplier_risk}</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{supplier.name}</span>
        {!realMode && <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">Demo dataset</Badge>}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pickerOptions.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="gap-1 text-xs">
            <Clock className="h-3 w-3" /> {lastRefresh}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {realMode && (
            <Button size="sm" variant="outline" onClick={() => void handleRecompute()} disabled={recomputing}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recomputing ? 'animate-spin' : ''}`} /> Recompute
            </Button>
          )}
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> Request Details
          </Button>
          <Button variant="outline" size="sm" onClick={() => generateSupplierRiskPDF({
            supplier,
            userName: profile?.full_name || 'Unknown User',
            userEmail: user?.email || 'N/A',
            terms: t,
          })}><FileDown className="h-3.5 w-3.5 mr-1.5" /> Export PDF</Button>
          <Button variant="outline" size="sm"><Share2 className="h-3.5 w-3.5 mr-1.5" /> Share</Button>
          <Button variant="ghost" size="sm"><Flag className="h-3.5 w-3.5 mr-1.5" /> Report Issue</Button>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main content */}
        <div className="lg:col-span-8 space-y-4">
          <RiskScoreHero supplier={supplier} animatedScore={animatedScore} />
          <KeyDrivers drivers={supplier.drivers} />
          <SignalsSection supplier={supplier} />
          {realMode && realSelectedId && <SupplierRiskGraph supplierId={realSelectedId} />}
          <DocumentRiskSection documents={supplier.documents} subscore={supplier.documentSubscore} />
          {flags.showAuditFindings && (
            <AuditFindingsTab supplierId={supplier.id} supplierName={supplier.name} />
          )}
          {realMode
            ? <RiskPolicyConfig />
            : <ModelTuningPanel onRecalculate={() => setAnimatedScore(Math.max(0, Math.min(100, supplier.score + Math.floor(Math.random() * 7) - 3)))} />}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4">
          <SupplierProfileSidebar supplier={supplier} />
        </div>
      </div>

      {/* Modal */}
      <RequestDetailsModal open={modalOpen} onOpenChange={setModalOpen} supplier={supplier} />
    </div>
  );
}
