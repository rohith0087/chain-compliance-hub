import React, { useCallback, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  ClipboardList,
  Sparkles,
  Clock,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ListChecks,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import SupplierComplianceExportModal from '../exports/SupplierComplianceExportModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { ComplianceDataService } from '@/services/ComplianceDataService';
import { AdvancedPDFExportService } from '@/services/AdvancedPDFExportService';
import { AIInsightsService } from '@/services/AIInsightsService';
import { ComplianceFilters } from '../compliance/ComplianceFilters';
import { useBranchContext } from '@/contexts/BranchContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { differenceInDays } from 'date-fns';
import {
  reviewActionButtonSecondaryClass,
  reviewCardContainerClass,
  reviewPageSubtitleClass,
  reviewPageTitleClass,
  reviewSectionHeaderClass,
} from '@/components/documents/buyerReviewDesignSystem';

// Phase 3/4 tables (compliance_tasks, compliance_findings, compliance_approvals,
// compliance_current_status, evidence_* canonical tables) are intentionally not
// added to generated types until reviewed -- same convention ComplianceDecisionsView.tsx uses.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface PriorityItem {
  id: string;
  kind: 'task' | 'finding' | 'approval';
  label: string;
  meta: string;
  sortDate: string;
  severity: string | null;
}

interface CoverageGap {
  frameworkCode: string;
  total: number;
  covered: number;
  missing: number;
  percentage: number;
}

interface AiFlag {
  type: string;
  label: string;
  count: number;
}

interface DecisionSummary {
  openTasks: number;
  criticalHighFindings: number;
  pendingApprovals: number;
  complianceRate: number | null;
  totalDecisions: number;
}

interface TaskRow { id: string; title: string; task_type: string; due_date: string | null; status: string }
interface FindingRow { id: string; description: string; severity: string; status: string; raised_at: string }
interface ApprovalRow { id: string; approval_type: string; status: string; requested_at: string }
interface DecisionStatusRow { framework_code: string; requirement_key: string; outcome: string }
interface FrameworkRow { id: string; code: string; owner_buyer_id: string | null }
interface FrameworkVersionRow { id: string; framework_id: string }
interface RequirementVersionRow { id: string; framework_version_id: string }
interface ValidationResultRow { rule_code: string; message: string }

const PRIORITY_KIND_BADGE: Record<PriorityItem['kind'], string> = {
  task: 'bg-blue-50 text-blue-700 border-blue-200',
  finding: 'bg-red-50 text-red-700 border-red-200',
  approval: 'bg-amber-50 text-amber-700 border-amber-200',
};

interface BuyerComplianceDashboardProps {
  onNavigateToComplianceDecisions?: () => void;
}

const BuyerComplianceDashboard = ({ onNavigateToComplianceDecisions }: BuyerComplianceDashboardProps) => {
  const { currentBranch, allBranchesView } = useBranchContext();
  const [supplierStats, setSupplierStats] = useState<any[]>([]);
  const [documentRequests, setDocumentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [buyerData, setBuyerData] = useState<any>(null);
  const [buyerId, setBuyerId] = useState<string>('');

  const [filters, setFilters] = useState({
    searchQuery: '',
    industries: [] as string[],
    itemCategories: [] as string[],
    statuses: [] as string[],
    riskLevels: [] as string[]
  });
  const [filteredSuppliers, setFilteredSuppliers] = useState<any[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<any[]>([]);
  const [supplierItemsMap, setSupplierItemsMap] = useState<Map<string, Set<string>>>(new Map());

  // Workbench panels -- additive, read-only queries over Phase 3 (decision
  // engine) and Phase 4 (canonical evidence) tables. None of this touches
  // loadDashboardData/applyFilters below.
  const [workbenchLoading, setWorkbenchLoading] = useState(true);
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [decisionSummary, setDecisionSummary] = useState<DecisionSummary>({
    openTasks: 0, criticalHighFindings: 0, pendingApprovals: 0, complianceRate: null, totalDecisions: 0,
  });
  const [coverageGaps, setCoverageGaps] = useState<CoverageGap[]>([]);
  // null = no canonical evidence data for this buyer's suppliers (panel hidden);
  // [] = canonical evidence exists and nothing is flagged (panel shows "all clear").
  const [aiFlags, setAiFlags] = useState<AiFlag[] | null>(null);

  const { user } = useAuth();
  const { subscriptionData } = useSubscription();
  const { t } = useTranslation(['dashboard', 'common']);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, currentBranch, allBranchesView]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', user?.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .maybeSingle();

      const buyerId = teamMember?.company_id || user?.id;

      const { data: buyerProfile, error: buyerError } = await supabase
        .from('buyers')
        .select('id')
        .eq('id', buyerId)
        .single();

      if (buyerError) {
        console.error('Error fetching buyer profile:', buyerError);
      }

      if (buyerProfile) {
        setBuyerId(buyerProfile.id);
        setBuyerData(buyerProfile);

        let connectionsQuery = supabase
          .from('buyer_supplier_connections')
          .select(`
            id,
            supplier_id,
            branch_id,
            suppliers (
              id,
              company_name,
              industry,
              company_logo_url
            )
          `)
          .eq('buyer_id', buyerProfile.id)
          .eq('status', 'approved');

        if (currentBranch && !allBranchesView) {
          connectionsQuery = connectionsQuery.or(`branch_id.eq.${currentBranch.id},branch_id.is.null`);
        }

        const { data: connections } = await connectionsQuery;

        const supplierMap = new Map();
        connections?.forEach(conn => {
          if (conn.suppliers) {
            supplierMap.set(conn.suppliers.id, {
              ...conn.suppliers,
              totalRequests: 0,
              approvedRequests: 0,
              pendingRequests: 0,
              rejectedRequests: 0,
              hasDocumentRequests: false
            });
          }
        });

        let requestsQuery = supabase
          .from('document_requests')
          .select(`
            *,
            suppliers (
              id,
              company_name,
              industry,
              company_logo_url
            )
          `)
          .eq('buyer_id', buyerProfile.id);

        if (currentBranch && !allBranchesView) {
          requestsQuery = requestsQuery.eq('branch_id', currentBranch.id);
        }

        const { data: requests } = await requestsQuery.order('created_at', { ascending: false });

        setDocumentRequests(requests || []);

        requests?.forEach(request => {
          if (request.suppliers) {
            const supplierId = request.suppliers.id;
            if (supplierMap.has(supplierId)) {
              const supplier = supplierMap.get(supplierId);
              supplier.totalRequests++;
              supplier.hasDocumentRequests = true;
              if (request.status === 'approved') supplier.approvedRequests++;
              if (request.status === 'pending') supplier.pendingRequests++;
              if (request.status === 'rejected') supplier.rejectedRequests++;
            }
          }
        });

        const supplierStatsArray = Array.from(supplierMap.values()).map(supplier => ({
          ...supplier,
          complianceScore: supplier.totalRequests > 0
            ? Math.round((supplier.approvedRequests / supplier.totalRequests) * 100)
            : 0
        }));

        const supplierIds = Array.from(supplierMap.keys());
        const { data: supplierItems } = supplierIds.length > 0
          ? await supabase
              .from('supplier_items')
              .select('supplier_id, item_category')
              .in('supplier_id', supplierIds)
          : { data: [] };

        const itemsMap = new Map<string, Set<string>>();
        supplierItems?.forEach(item => {
          if (!itemsMap.has(item.supplier_id)) {
            itemsMap.set(item.supplier_id, new Set());
          }
          if (item.item_category) {
            itemsMap.get(item.supplier_id)?.add(item.item_category);
          }
        });
        setSupplierItemsMap(itemsMap);

        setSupplierStats(supplierStatsArray);
        setFilteredSuppliers(supplierStatsArray);
        setDocumentRequests(requests || []);
        setFilteredRequests(requests || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkbenchExtras = useCallback(async (currentBuyerId: string) => {
    setWorkbenchLoading(true);
    try {
      await Promise.all([
        loadPriorityQueueAndSummary(currentBuyerId),
        loadCoverageGaps(currentBuyerId),
        loadAiFlags(currentBuyerId),
      ]);
    } catch (error) {
      console.error('Error loading workbench data:', error);
    } finally {
      setWorkbenchLoading(false);
    }
  }, []);

  // Reuses the exact same compliance_tasks/compliance_findings/compliance_approvals
  // query shape as ComplianceDecisionsView.tsx's ActionItemsPanel, plus
  // compliance_current_status for an overall requirement-compliance rate --
  // merged into one prioritized queue instead of three separate lists.
  const loadPriorityQueueAndSummary = async (currentBuyerId: string) => {
    const [{ data: taskRows }, { data: findingRows }, { data: approvalRows }, { data: statusRows }] = await Promise.all([
      db.from('compliance_tasks').select('id, title, task_type, due_date, status')
        .eq('buyer_id', currentBuyerId).in('status', ['open', 'in_progress']).order('due_date'),
      db.from('compliance_findings').select('id, description, severity, status, raised_at')
        .eq('buyer_id', currentBuyerId).in('status', ['open', 'acknowledged']).order('raised_at', { ascending: false }),
      db.from('compliance_approvals').select('id, approval_type, status, requested_at')
        .eq('buyer_id', currentBuyerId).eq('status', 'pending').order('requested_at'),
      db.from('compliance_current_status').select('outcome').eq('buyer_id', currentBuyerId),
    ]);

    const tasks: TaskRow[] = taskRows || [];
    const findings: FindingRow[] = findingRows || [];
    const approvals: ApprovalRow[] = approvalRows || [];
    const statuses: DecisionStatusRow[] = statusRows || [];

    const merged: PriorityItem[] = [
      ...tasks.map((item) => ({
        id: `task-${item.id}`, kind: 'task' as const, label: item.title,
        meta: item.due_date ? `Due ${item.due_date}` : item.task_type,
        sortDate: item.due_date || '9999-12-31', severity: null,
      })),
      ...findings.map((item) => ({
        id: `finding-${item.id}`, kind: 'finding' as const, label: item.description,
        meta: `${item.severity} severity`, sortDate: item.raised_at, severity: item.severity,
      })),
      ...approvals.map((item) => ({
        id: `approval-${item.id}`, kind: 'approval' as const, label: item.approval_type.replace(/_/g, ' '),
        meta: `requested ${new Date(item.requested_at).toLocaleDateString()}`,
        sortDate: item.requested_at, severity: null,
      })),
    ];

    const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    merged.sort((a, b) => {
      const aRank = a.severity ? severityRank[a.severity] ?? 4 : 4;
      const bRank = b.severity ? severityRank[b.severity] ?? 4 : 4;
      if (aRank !== bRank) return aRank - bRank;
      return (a.sortDate || '').localeCompare(b.sortDate || '');
    });

    setPriorityItems(merged.slice(0, 10));

    const criticalHighFindings = findings.filter((item) => item.severity === 'critical' || item.severity === 'high').length;
    const compliantCount = statuses.filter((item) => item.outcome === 'compliant').length;
    setDecisionSummary({
      openTasks: tasks.length,
      criticalHighFindings,
      pendingApprovals: approvals.length,
      complianceRate: statuses.length > 0 ? Math.round((compliantCount / statuses.length) * 100) : null,
      totalDecisions: statuses.length,
    });
  };

  // Coverage gaps: total = active published requirement_versions for
  // frameworks this buyer can see (mirrors the accessible-framework filter
  // already used in _shared/requirements/applicability.ts's loadCatalogResults);
  // covered = distinct requirement_key with a 'compliant' outcome anywhere in
  // compliance_current_status for this buyer. An approximation (compliant for
  // at least one subject, not all), but real data -- no fabricated denominator.
  const loadCoverageGaps = async (currentBuyerId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: frameworks } = await supabase.from('requirement_frameworks').select('id, code, owner_buyer_id');
    const accessible: FrameworkRow[] = (frameworks || []).filter((item) => item.owner_buyer_id === null || item.owner_buyer_id === currentBuyerId);
    if (accessible.length === 0) { setCoverageGaps([]); return; }

    const frameworkById = new Map(accessible.map((item) => [item.id, item]));
    const { data: frameworkVersions } = await supabase.from('requirement_framework_versions')
      .select('id, framework_id')
      .in('framework_id', accessible.map((item) => item.id))
      .eq('status', 'published')
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`);
    const frameworkVersionRows: FrameworkVersionRow[] = frameworkVersions || [];
    if (frameworkVersionRows.length === 0) { setCoverageGaps([]); return; }

    const versionToFrameworkCode = new Map(
      frameworkVersionRows.map((item) => [item.id, frameworkById.get(item.framework_id)?.code])
    );

    const { data: requirementVersions } = await supabase.from('requirement_versions')
      .select('id, framework_version_id')
      .in('framework_version_id', frameworkVersionRows.map((item) => item.id))
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`);

    const totalsByFramework = new Map<string, number>();
    ((requirementVersions || []) as RequirementVersionRow[]).forEach((item) => {
      const code = versionToFrameworkCode.get(item.framework_version_id);
      if (code) totalsByFramework.set(code, (totalsByFramework.get(code) || 0) + 1);
    });
    if (totalsByFramework.size === 0) { setCoverageGaps([]); return; }

    const { data: statusRows } = await db.from('compliance_current_status')
      .select('framework_code, requirement_key, outcome').eq('buyer_id', currentBuyerId);

    const compliantKeysByFramework = new Map<string, Set<string>>();
    ((statusRows || []) as DecisionStatusRow[]).forEach((row) => {
      if (row.outcome !== 'compliant') return;
      if (!compliantKeysByFramework.has(row.framework_code)) compliantKeysByFramework.set(row.framework_code, new Set());
      compliantKeysByFramework.get(row.framework_code)!.add(row.requirement_key);
    });

    const gaps: CoverageGap[] = Array.from(totalsByFramework.entries()).map(([code, total]) => {
      const covered = compliantKeysByFramework.get(code)?.size || 0;
      return { frameworkCode: code, total, covered, missing: Math.max(0, total - covered), percentage: total > 0 ? Math.round((covered / total) * 100) : 0 };
    }).sort((a, b) => a.percentage - b.percentage);

    setCoverageGaps(gaps);
  };

  // Derives real verification flags from the canonical evidence tables
  // (Phase 4) for this buyer's connected suppliers -- expired evidence,
  // low-confidence extractions, and failed/needs-review validation rules.
  // No mock data: returns null (panel hidden) if this buyer has no canonical
  // evidence at all, [] (panel shows "all clear") if evidence exists but
  // nothing is currently flagged.
  const loadAiFlags = async (currentBuyerId: string) => {
    const { data: connections } = await supabase.from('buyer_supplier_connections')
      .select('supplier_id').eq('buyer_id', currentBuyerId).eq('status', 'approved');
    const supplierIds = (connections || []).map((item) => item.supplier_id).filter(Boolean);
    if (supplierIds.length === 0) { setAiFlags(null); return; }

    const { data: records } = await db.from('evidence_records')
      .select('id').in('supplier_id', supplierIds).eq('status', 'active');
    const recordIds = ((records || []) as { id: string }[]).map((item) => item.id);
    if (recordIds.length === 0) { setAiFlags(null); return; }

    const { data: versions } = await db.from('evidence_versions')
      .select('id, expiry_date').in('evidence_record_id', recordIds).eq('lifecycle_status', 'current');
    const versionRows: { id: string; expiry_date: string | null }[] = versions || [];
    const versionIds = versionRows.map((item) => item.id);
    if (versionIds.length === 0) { setAiFlags([]); return; }

    const today = new Date().toISOString().slice(0, 10);
    const expiredCount = versionRows.filter((item) => item.expiry_date && item.expiry_date < today).length;

    const [{ data: observations }, { data: runs }] = await Promise.all([
      db.from('evidence_field_observations').select('id').in('evidence_version_id', versionIds).lt('confidence', 0.7),
      db.from('evidence_validation_runs').select('id').in('evidence_version_id', versionIds),
    ]);
    const lowConfidenceCount = (observations || []).length;

    const runIds = ((runs || []) as { id: string }[]).map((item) => item.id);
    let validationIssues: AiFlag[] = [];
    if (runIds.length > 0) {
      const { data: results } = await db.from('evidence_validation_results')
        .select('rule_code, message').in('validation_run_id', runIds).in('outcome', ['failed', 'needs_review']);
      const byRule = new Map<string, { message: string; count: number }>();
      ((results || []) as ValidationResultRow[]).forEach((item) => {
        const entry = byRule.get(item.rule_code) || { message: item.message, count: 0 };
        entry.count += 1;
        byRule.set(item.rule_code, entry);
      });
      validationIssues = Array.from(byRule.entries()).map(([ruleCode, { message, count }]) => ({
        type: ruleCode, label: message, count,
      }));
    }

    setAiFlags([
      ...(expiredCount > 0 ? [{ type: 'expired', label: 'Expired evidence detected', count: expiredCount }] : []),
      ...(lowConfidenceCount > 0 ? [{ type: 'low_confidence', label: 'Low-confidence extractions', count: lowConfidenceCount }] : []),
      ...validationIssues,
    ]);
  };

  useEffect(() => {
    if (buyerId) void loadWorkbenchExtras(buyerId);
  }, [buyerId, loadWorkbenchExtras]);

  React.useEffect(() => {
    applyFilters();
  }, [supplierStats, documentRequests, filters]);

  const applyFilters = () => {
    let filtered = [...supplierStats];

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.company_name?.toLowerCase().includes(query) ||
        s.id?.toLowerCase().includes(query) ||
        s.industry?.toLowerCase().includes(query)
      );
    }

    if (filters.industries.length > 0) {
      filtered = filtered.filter(s =>
        s.industry && filters.industries.includes(s.industry)
      );
    }

    if (filters.itemCategories.length > 0) {
      filtered = filtered.filter(s => {
        const supplierCategories = supplierItemsMap.get(s.id);
        if (!supplierCategories) return false;
        return filters.itemCategories.some(cat => supplierCategories.has(cat));
      });
    }

    if (filters.riskLevels.length > 0) {
      filtered = filtered.filter(s => {
        const score = s.complianceScore || 0;
        if (filters.riskLevels.includes('high') && score < 70) return true;
        if (filters.riskLevels.includes('medium') && score >= 70 && score < 85) return true;
        if (filters.riskLevels.includes('good') && score >= 85) return true;
        return false;
      });
    }

    setFilteredSuppliers(filtered);

    let filteredReqs = [...documentRequests];

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filteredReqs = filteredReqs.filter(r =>
        r.title?.toLowerCase().includes(query) ||
        r.suppliers?.company_name?.toLowerCase().includes(query)
      );
    }

    if (filters.statuses.length > 0) {
      filteredReqs = filteredReqs.filter(r =>
        r.status && filters.statuses.includes(r.status)
      );
    }

    if (filters.industries.length > 0) {
      filteredReqs = filteredReqs.filter(r =>
        r.suppliers?.industry && filters.industries.includes(r.suppliers.industry)
      );
    }

    setFilteredRequests(filteredReqs);
  };

  const availableIndustries = Array.from(new Set(
    supplierStats.map(s => s.industry).filter(Boolean)
  )).sort();

  const availableItemCategories = Array.from(
    new Set(
      Array.from(supplierItemsMap.values())
        .flatMap(categories => Array.from(categories))
    )
  ).sort();

  const availableStatuses = ['pending', 'submitted', 'approved', 'rejected'];

  const overallStats = {
    totalSuppliers: filteredSuppliers.length,
    totalRequests: filteredRequests.length,
    avgComplianceScore: filteredSuppliers.length > 0
      ? Math.round(filteredSuppliers.reduce((sum, s) => sum + (s.complianceScore || 0), 0) / filteredSuppliers.length)
      : 0,
    pendingRequests: filteredRequests.filter(r => r.status === 'pending').length,
    highRiskSuppliers: filteredSuppliers.filter(s => (s.complianceScore || 0) < 70).length
  };

  // Get attention required items (pending/overdue in next 7 days)
  const attentionItems = filteredRequests
    .filter(r => r.status === 'pending' && r.due_date)
    .map(r => {
      const daysUntil = differenceInDays(new Date(r.due_date), new Date());
      return { ...r, daysUntil };
    })
    .filter(r => r.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  const handleViewDocument = async (request: any) => {
    try {
      const { data: uploads, error: uploadsError } = await supabase
        .from('document_uploads')
        .select('*')
        .eq('request_id', request.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (uploadsError) {
        console.error('Error fetching uploads:', uploadsError);
      }

      const upload = uploads?.[0];

      if (!upload?.file_path) {
        toast({
          title: "Error",
          description: "No file available for viewing",
          variant: "destructive",
        });
        return;
      }

      const isViewable = upload.mime_type?.startsWith('image/') || upload.mime_type === 'application/pdf';

      if (isViewable) {
        const newTab = window.open('', '_blank', 'noopener,noreferrer');
        if (newTab) newTab.document.write('Loading document...');
        const { data, error } = await supabase.storage
          .from('compliance-documents')
          .createSignedUrl(upload.file_path, 60);

        if (error) throw error;
        if (newTab) {
          newTab.location.href = data.signedUrl;
        } else {
          window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        const { data: signed, error: signedErr } = await supabase.storage
          .from('compliance-documents')
          .createSignedUrl(upload.file_path, 60, { download: upload.file_name });

        if (!signedErr && signed?.signedUrl) {
          const a = window.document.createElement('a');
          a.href = signed.signedUrl;
          a.download = upload.file_name || 'download';
          window.document.body.appendChild(a);
          a.click();
          window.document.body.removeChild(a);
          toast({
            title: "Download Started",
            description: `Downloading ${upload.file_name}`,
          });
          return;
        }

        const { data: blob, error } = await supabase.storage
          .from('compliance-documents')
          .download(upload.file_path);

        if (error) throw error;

        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = upload.file_name || 'download';
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Download Started",
          description: `Downloading ${upload.file_name}`,
        });
      }
    } catch (error) {
      console.error('View/Download error:', error);
      toast({
        title: "Error",
        description: "Failed to access document",
        variant: "destructive",
      });
    }
  };

  const handleExportReports = async (
    selectedSupplierIds: string[],
    reportType: string,
    dateRange: { from: Date | undefined; to: Date | undefined },
    options: any
  ) => {
    try {
      const pdfService = new AdvancedPDFExportService();

      if (selectedSupplierIds.length === 1) {
        const supplierData = await ComplianceDataService.getSupplierComplianceData(
          selectedSupplierIds[0],
          buyerId,
          dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined
        );

        const aiInsights = await AIInsightsService.generateSupplierInsights(supplierData);
        await pdfService.generateSingleSupplierReport(supplierData, aiInsights, options);
      } else {
        const comparisonData = await ComplianceDataService.getMultiSupplierComparisonData(
          selectedSupplierIds,
          buyerId,
          dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined
        );

        const aiInsights = await AIInsightsService.generateComparisonInsights(comparisonData);
        await pdfService.generateComparisonReport(comparisonData, aiInsights, options);
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground">{t('common:messages.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pt-7 pb-5 flex items-center justify-between">
        <div>
          <h1 className={reviewPageTitleClass}>Compliance Workbench</h1>
          <p className={reviewPageSubtitleClass}>Review, verify, and act on supplier compliance issues</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadDashboardData} className="h-9 text-muted-foreground rounded-[10px]">
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={reviewActionButtonSecondaryClass}
            onClick={() => setShowExportModal(true)}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Branch indicator */}
      {currentBranch && !allBranchesView && (
        <Alert className="border-border bg-muted/50 rounded-[16px]">
          <Building2 className="h-4 w-4" />
          <AlertTitle className="text-sm font-medium">Branch View</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            Showing data for: <span className="font-medium text-foreground">{currentBranch.branch_name}</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <ComplianceFilters
        filters={filters}
        onFiltersChange={setFilters}
        availableIndustries={availableIndustries}
        availableItemCategories={availableItemCategories}
        availableStatuses={availableStatuses}
        supplierCount={filteredSuppliers.length}
        totalSuppliers={supplierStats.length}
      />

      {/* 2-column layout, same pattern as the Activity page: main scrollable
          queue on the left, compact sticky summary on the right -- avoids
          stacking every panel full-width one after another. */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column: the main, scrollable work queue */}
        <div className="w-full lg:w-[66%] space-y-4">
          {/* Priority Review Queue */}
          <div className={reviewCardContainerClass}>
            <div className="flex items-center justify-between px-4 pt-4 pb-1">
              <h3 className="text-[15px] font-bold text-foreground">Priority Review Queue</h3>
              {onNavigateToComplianceDecisions && (
                <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-[#1D4ED8]" onClick={onNavigateToComplianceDecisions}>
                  View all in Compliance Decisions <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
            {!workbenchLoading && priorityItems.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Nothing needs review right now.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="h-[48px] bg-card border-b border-border hover:bg-card">
                    <TableHead className={`px-3 ${reviewSectionHeaderClass}`}>Type</TableHead>
                    <TableHead className={`px-3 ${reviewSectionHeaderClass}`}>Item</TableHead>
                    <TableHead className={`px-3 ${reviewSectionHeaderClass}`}>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priorityItems.map((item) => (
                    <TableRow key={item.id} className="h-[48px] border-b border-border hover:bg-muted/50">
                      <TableCell className="px-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-medium capitalize ${PRIORITY_KIND_BADGE[item.kind]}`}>
                          {item.kind}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 text-sm text-foreground truncate max-w-md">{item.label}</TableCell>
                      <TableCell className="px-3 text-sm text-muted-foreground">{item.meta}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Attention Required Table */}
          {attentionItems.length > 0 && (
            <div className={reviewCardContainerClass}>
              <div className="flex items-center justify-between px-4 pt-4 pb-1">
                <h3 className="text-[15px] font-bold text-foreground">Attention Required (Next 7 Days)</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="h-[48px] bg-card border-b border-border hover:bg-card">
                    <TableHead className={`px-3 ${reviewSectionHeaderClass}`}>Supplier</TableHead>
                    <TableHead className={`px-3 ${reviewSectionHeaderClass}`}>Document</TableHead>
                    <TableHead className={`px-3 ${reviewSectionHeaderClass}`}>Due</TableHead>
                    <TableHead className={`px-3 text-right ${reviewSectionHeaderClass}`}>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attentionItems.map((item) => (
                    <TableRow key={item.id} className="h-[48px] border-b border-border hover:bg-muted/50">
                      <TableCell className="px-3 text-sm font-medium text-foreground">{item.suppliers?.company_name}</TableCell>
                      <TableCell className="px-3 text-sm text-foreground/80 truncate max-w-xs">{item.title}</TableCell>
                      <TableCell className="px-3 text-sm">
                        {item.daysUntil < 0 ? (
                          <span className="text-red-600">Overdue {Math.abs(item.daysUntil)}d</span>
                        ) : item.daysUntil === 0 ? (
                          <span className="text-red-600">Today</span>
                        ) : (
                          <span className={item.daysUntil <= 3 ? 'text-amber-600' : 'text-foreground/80'}>
                            {item.daysUntil}d
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-primary hover:text-[#1D4ED8]"
                          onClick={() => handleViewDocument(item)}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

        </div>

        {/* Right column: sticky compact summary -- one panel of stat rows
            instead of nine separate large metric cards. */}
        <div className="w-full lg:w-[34%]">
          <div className="sticky top-6 space-y-4">
            <div className={reviewCardContainerClass}>
              <div className="px-4 pt-4 pb-2">
                <h3 className="text-[15px] font-bold text-foreground">Overview</h3>
              </div>
              <div className="px-4 pb-4 divide-y divide-[#EEF2F7]">
                {[
                  { icon: Building2, color: 'text-primary', label: 'Suppliers', value: overallStats.totalSuppliers },
                  { icon: ClipboardList, color: 'text-purple-600', label: 'Documents', value: overallStats.totalRequests },
                  { icon: Clock, color: 'text-amber-600', label: 'Open Items', value: overallStats.pendingRequests },
                  { icon: AlertCircle, color: 'text-red-600', label: 'Risk: High', value: overallStats.highRiskSuppliers },
                  { icon: TrendingUp, color: 'text-emerald-600', label: 'Compliance Coverage', value: `${overallStats.avgComplianceScore}%` },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                    <span className="flex items-center gap-2 text-sm text-foreground/80">
                      <row.icon className={`h-3.5 w-3.5 ${row.color}`} />
                      {row.label}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{row.value}</span>
                  </div>
                ))}
                {!workbenchLoading && decisionSummary.totalDecisions > 0 && (
                  <>
                    {[
                      { icon: ListChecks, color: 'text-primary', label: 'Open Tasks', value: decisionSummary.openTasks },
                      { icon: AlertTriangle, color: 'text-red-600', label: 'Critical/High Findings', value: decisionSummary.criticalHighFindings },
                      { icon: Clock, color: 'text-amber-600', label: 'Pending Approvals', value: decisionSummary.pendingApprovals },
                      { icon: ShieldCheck, color: 'text-emerald-600', label: 'Requirement Compliance', value: decisionSummary.complianceRate !== null ? `${decisionSummary.complianceRate}%` : '—' },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                        <span className="flex items-center gap-2 text-sm text-foreground/80">
                          <row.icon className={`h-3.5 w-3.5 ${row.color}`} />
                          {row.label}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{row.value}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* AI Verification Flags */}
            {!workbenchLoading && aiFlags !== null && (
              <div className={reviewCardContainerClass}>
                <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  <h3 className="text-[15px] font-bold text-foreground">AI Verification Flags</h3>
                </div>
                <div className="px-4 pb-4">
                  {aiFlags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No flags — all evidence current and validated.</p>
                  ) : (
                    <ul className="space-y-2">
                      {aiFlags.map((flag) => (
                        <li key={flag.type} className="flex items-center justify-between text-sm gap-2">
                          <span className="flex items-center gap-2 text-foreground/80 min-w-0">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                            <span className="truncate">{flag.label}</span>
                          </span>
                          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-[12px] font-medium flex-shrink-0">{flag.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Requirement Coverage Gaps */}
            {!workbenchLoading && coverageGaps.length > 0 && (
              <div className={reviewCardContainerClass}>
                <div className="px-4 pt-4 pb-2">
                  <h3 className="text-[15px] font-bold text-foreground">Requirement Coverage Gaps</h3>
                </div>
                <div className="px-4 pb-4 space-y-3">
                  {coverageGaps.map((gap) => (
                    <div key={gap.frameworkCode} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{gap.frameworkCode}</span>
                        <span className="text-muted-foreground">{gap.percentage}%</span>
                      </div>
                      <Progress value={gap.percentage} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{gap.missing} missing</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SupplierComplianceExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        suppliers={supplierStats}
        onExport={handleExportReports}
      />
    </div>
  );
};

export default BuyerComplianceDashboard;
