import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Copy,
  ExternalLink,
  Info,
  Package,
  Target,
  Clock,
  AlertTriangle,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { SupplierItemFacilityView } from './SupplierItemFacilityView';
import SupplierInsightsModal from '@/components/supplier/SupplierInsightsModal';
import {
  STATUS_BADGE_CONFIG,
  getIndustryBadgeClass,
  reviewCardContainerClass,
  reviewMetricCardClass,
  reviewMetricIconCircleClass,
  reviewSectionHeaderClass,
} from '@/components/documents/buyerReviewDesignSystem';

interface SupplierProfileSupplier {
  id: string;
  company_name: string;
  industry?: string | null;
  company_logo_url?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
}

interface SupplierProfileRequest {
  id: string;
  status: string;
  due_date?: string | null;
  title?: string | null;
  document_type?: string | null;
  updated_at?: string | null;
  created_at: string;
}

interface SupplierProfileModalProps {
  supplier: SupplierProfileSupplier | null;
  isOpen: boolean;
  onClose: () => void;
  buyerId: string;
  allIndustries: readonly string[];
  connectionStatus?: string | null;
  connectionDate?: string | null;
}

// Reuses the same compliance-metric and risk-assessment calculation as
// SupplierInsightsModal (src/components/supplier/SupplierInsightsModal.tsx)
// so this lightweight summary and the full deep-dive modal always agree on
// the numbers for the same supplier -- duplicated rather than extracted
// into a shared hook since each copy is small and the two modals are
// otherwise independent surfaces.
function calculateRiskAssessment(complianceScore: number, overdueRate: number, rejectionRate: number, pendingRate: number) {
  const riskFactors: string[] = [];
  let riskScore = 0;

  if (complianceScore < 70) {
    riskScore += 40;
    riskFactors.push(`Low compliance rate (${complianceScore}%)`);
  } else if (complianceScore < 90) {
    riskScore += 20;
    riskFactors.push(`Moderate compliance rate (${complianceScore}%)`);
  } else {
    riskFactors.push(`High compliance rate (${complianceScore}%)`);
  }

  if (overdueRate > 20) {
    riskScore += 25;
    riskFactors.push(`High overdue rate (${overdueRate.toFixed(1)}%)`);
  } else if (overdueRate > 10) {
    riskScore += 15;
    riskFactors.push(`Moderate overdue rate (${overdueRate.toFixed(1)}%)`);
  }

  if (rejectionRate > 15) {
    riskScore += 20;
    riskFactors.push(`High rejection rate (${rejectionRate.toFixed(1)}%)`);
  } else if (rejectionRate > 5) {
    riskScore += 10;
    riskFactors.push(`Moderate rejection rate (${rejectionRate.toFixed(1)}%)`);
  }

  if (pendingRate > 30) {
    riskScore += 15;
    riskFactors.push(`Many pending requests (${pendingRate.toFixed(1)}%)`);
  }

  const level = riskScore >= 50 ? 'High' : riskScore >= 25 ? 'Medium' : 'Low';
  return { level, factors: riskFactors, score: riskScore };
}

export function SupplierProfileModal({
  supplier,
  isOpen,
  onClose,
  buyerId,
  allIndustries,
  connectionStatus,
  connectionDate,
}: SupplierProfileModalProps) {
  const [requests, setRequests] = useState<SupplierProfileRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFullInsights, setShowFullInsights] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen || !supplier || !buyerId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('document_requests')
          .select('*')
          .eq('supplier_id', supplier.id)
          .eq('buyer_id', buyerId)
          .order('created_at', { ascending: false });
        if (active) setRequests(data || []);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [isOpen, supplier, buyerId]);

  if (!supplier) return null;

  const totalRequests = requests.length;
  const approvedRequests = requests.filter((r) => r.status === 'approved').length;
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  const rejectedRequests = requests.filter((r) => r.status === 'rejected').length;
  const overdueCount = requests.filter((r) => r.due_date && new Date(r.due_date) < new Date() && r.status === 'pending').length;
  const complianceScore = totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0;

  const overdueRate = totalRequests > 0 ? (overdueCount / totalRequests) * 100 : 0;
  const rejectionRate = totalRequests > 0 ? (rejectedRequests / totalRequests) * 100 : 0;
  const pendingRate = totalRequests > 0 ? (pendingRequests / totalRequests) * 100 : 0;
  const riskAssessment = calculateRiskAssessment(complianceScore, overdueRate, rejectionRate, pendingRate);

  const riskBadgeClass = riskAssessment.level === 'Low'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : riskAssessment.level === 'Medium'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-700 border-red-200';

  const handleContact = () => {
    if (supplier.contact_email) {
      const subject = `Regarding ${supplier.company_name} - Compliance Documentation`;
      const body = `Dear ${supplier.company_name} team,\n\nI hope this message finds you well. I wanted to reach out regarding your compliance documentation status.\n\nBest regards`;
      window.open(`mailto:${supplier.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer');
    } else {
      toast({ title: 'Contact information unavailable', description: 'No email address found for this supplier.', variant: 'destructive' });
    }
  };

  const handleCopyEmail = () => {
    if (supplier.contact_email) {
      navigator.clipboard.writeText(supplier.contact_email);
      toast({ title: 'Email copied', description: "Supplier's email address copied to clipboard." });
    }
  };

  const recentRequests = requests.slice(0, 6);

  return (
    <>
      <Dialog open={isOpen && !showFullInsights} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto gap-0 rounded-[16px] p-0 [&>button]:hidden">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] bg-white px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <CompanyLogo logoUrl={supplier.company_logo_url} companyName={supplier.company_name} size="md" />
              <div className="min-w-0">
                <p className="truncate text-[18px] font-bold text-[#111827]">{supplier.company_name}</p>
                <div className="mt-1 flex items-center gap-2">
                  {supplier.industry && (
                    <Badge variant="outline" className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${getIndustryBadgeClass(supplier.industry, allIndustries)}`}>
                      {supplier.industry}
                    </Badge>
                  )}
                  {connectionStatus && STATUS_BADGE_CONFIG[connectionStatus === 'approved' ? 'approved' : connectionStatus] && (
                    <Badge variant="outline" className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_CONFIG[connectionStatus === 'approved' ? 'approved' : connectionStatus].className}`}>
                      {connectionStatus === 'approved' ? 'Connected' : connectionStatus}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-[36px] w-[36px] rounded-[10px] text-[#6B7280] hover:bg-gray-100 flex-shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-5 p-5">
            {/* Metric row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={reviewMetricCardClass}>
                <div className={`${reviewMetricIconCircleClass} bg-[#F0FDF4]`}>
                  <Target className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[20px] font-bold text-[#111827] leading-none">{loading ? '—' : `${complianceScore}%`}</p>
                  <p className="text-[12px] text-[#6B7280]">Compliance</p>
                </div>
              </div>
              <div className={reviewMetricCardClass}>
                <div className={`${reviewMetricIconCircleClass} bg-[#EFF6FF]`}>
                  <Package className="h-5 w-5 text-[#2563EB]" />
                </div>
                <div>
                  <p className="text-[20px] font-bold text-[#111827] leading-none">{loading ? '—' : totalRequests}</p>
                  <p className="text-[12px] text-[#6B7280]">Total Requests</p>
                </div>
              </div>
              <div className={reviewMetricCardClass}>
                <div className={`${reviewMetricIconCircleClass} bg-[#FFFBEB]`}>
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-[20px] font-bold text-[#111827] leading-none">{loading ? '—' : pendingRequests}</p>
                  <p className="text-[12px] text-[#6B7280]">Pending</p>
                </div>
              </div>
              <div className={reviewMetricCardClass}>
                <div className={`${reviewMetricIconCircleClass} bg-[#FEF2F2]`}>
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-[20px] font-bold text-[#111827] leading-none">{loading ? '—' : overdueCount}</p>
                  <p className="text-[12px] text-[#6B7280]">Overdue</p>
                </div>
              </div>
            </div>

            {/* Risk badge */}
            {!loading && totalRequests > 0 && (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="flex w-fit cursor-help items-center gap-1.5">
                    <Badge variant="outline" className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${riskBadgeClass}`}>
                      {riskAssessment.level} Risk
                    </Badge>
                    <Info className="h-3.5 w-3.5 text-[#9CA3AF]" />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 rounded-[12px]">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-[#111827]">Risk assessment details</h4>
                    <p className="text-sm text-[#6B7280]">
                      Risk level: <span className="font-medium text-[#111827]">{riskAssessment.level}</span> (Score: {riskAssessment.score}/100)
                    </p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[#374151]">Contributing factors:</p>
                      {riskAssessment.factors.map((factor) => (
                        <p key={factor} className="text-xs text-[#6B7280]">• {factor}</p>
                      ))}
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            )}

            {/* Contact info */}
            <div className={reviewCardContainerClass}>
              <div className="px-4 pt-4 pb-2">
                <h3 className={reviewSectionHeaderClass}>Contact Information</h3>
              </div>
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                  <span className="text-sm text-[#374151] truncate">{supplier.contact_email || 'Not provided'}</span>
                  {supplier.contact_email && (
                    <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopyEmail} title="Copy email">
                        <Copy className="h-3.5 w-3.5 text-[#6B7280]" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleContact} title="Email supplier">
                        <ExternalLink className="h-3.5 w-3.5 text-[#6B7280]" />
                      </Button>
                    </div>
                  )}
                </div>
                {supplier.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                    <span className="text-sm text-[#374151]">{supplier.phone}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                    <span className="text-sm text-[#374151]">{supplier.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                  <span className="text-sm text-[#374151]">
                    {connectionDate && !isNaN(new Date(connectionDate).getTime())
                      ? `Connected ${format(new Date(connectionDate), 'MMM d, yyyy')}`
                      : 'Connection date unavailable'}
                  </span>
                </div>
                {supplier.description && (
                  <p className="text-sm text-[#6B7280] leading-relaxed pt-1">{supplier.description}</p>
                )}
              </div>
            </div>

            {/* Recent activity */}
            {!loading && recentRequests.length > 0 && (
              <div className={reviewCardContainerClass}>
                <div className="px-4 pt-4 pb-2">
                  <h3 className={reviewSectionHeaderClass}>Recent Activity</h3>
                </div>
                <div className="px-4 pb-4 space-y-2">
                  {recentRequests.map((request) => {
                    const statusConfig = STATUS_BADGE_CONFIG[request.status] || STATUS_BADGE_CONFIG.pending;
                    const StatusIcon = statusConfig.icon;
                    return (
                      <div key={request.id} className="flex items-center gap-3 p-3 rounded-[16px] border border-[#E5E7EB]">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-[#F9FAFB] border border-[#F3F4F6]">
                          <StatusIcon className="w-3.5 h-3.5 text-[#6B7280]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#111827] truncate">{request.title || request.document_type}</p>
                        </div>
                        <Badge variant="outline" className={`text-[12px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusConfig.className}`}>
                          {statusConfig.label}
                        </Badge>
                        <span className="text-xs text-[#6B7280] whitespace-nowrap flex-shrink-0">
                          {format(new Date(request.updated_at || request.created_at), 'MMM d')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Item-Facility Matrix */}
            <div className={reviewCardContainerClass}>
              <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#6B7280]" />
                <h3 className={reviewSectionHeaderClass}>Item-Facility Matrix</h3>
              </div>
              <div className="px-4 pb-4">
                <SupplierItemFacilityView supplierId={supplier.id} />
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full rounded-[10px] border-[#E5E7EB]"
              onClick={() => setShowFullInsights(true)}
              disabled={totalRequests === 0}
            >
              View Full Insights
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SupplierInsightsModal
        isOpen={showFullInsights}
        onClose={() => setShowFullInsights(false)}
        supplier={supplier}
        buyerId={buyerId}
      />
    </>
  );
}

export default SupplierProfileModal;
