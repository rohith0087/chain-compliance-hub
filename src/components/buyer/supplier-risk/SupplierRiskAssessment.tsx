import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, FileDown, Share2, Flag, ChevronRight, Send } from 'lucide-react';
import { suppliers, SupplierRiskProfile } from './riskData';
import { RiskScoreHero } from './RiskScoreHero';
import { KeyDrivers } from './KeyDrivers';
import { SignalsSection } from './SignalsSection';
import { DocumentRiskSection } from './DocumentRiskSection';
import { ModelTuningPanel } from './ModelTuningPanel';
import { SupplierProfileSidebar } from './SupplierProfileSidebar';
import { RequestDetailsModal } from './RequestDetailsModal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateSupplierRiskPDF } from '@/utils/generateSupplierRiskPDF';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceProfile } from '@/hooks/useWorkspaceProfile';
import { AuditFindingsTab } from '@/components/buyer/audit/AuditFindingsTab';

export function SupplierRiskAssessment() {
  const [selectedId, setSelectedId] = useState(suppliers[0].id);
  const [modalOpen, setModalOpen] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(suppliers[0].score);
  const { profile, user } = useAuth();
  const { t, flags, isAuditor } = useWorkspaceProfile();

  const supplier = suppliers.find(s => s.id === selectedId) || suppliers[0];

  // Animate score on supplier change
  useEffect(() => {
    setAnimatedScore(0);
    const timer = setTimeout(() => setAnimatedScore(supplier.score), 100);
    return () => clearTimeout(timer);
  }, [supplier.score, selectedId]);

  const handleRecalculate = () => {
    const offset = Math.floor(Math.random() * 7) - 3;
    setAnimatedScore(Math.max(0, Math.min(100, supplier.score + offset)));
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>Compliance</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{t.supplier_risk}</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{supplier.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="gap-1 text-xs">
            <Clock className="h-3 w-3" /> Last refresh: 12 min ago
          </Badge>
        </div>
        <div className="flex items-center gap-2">
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
          <DocumentRiskSection documents={supplier.documents} subscore={supplier.documentSubscore} />
          {flags.showAuditFindings && (
            <AuditFindingsTab supplierId={supplier.id} supplierName={supplier.name} />
          )}
          <ModelTuningPanel onRecalculate={handleRecalculate} />
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
