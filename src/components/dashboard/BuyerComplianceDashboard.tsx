import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslation } from 'react-i18next';
import { 
  Building2,
  Download,
  RefreshCcw,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Clock,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import ComplianceDashboard from './ComplianceDashboard';
import SupplierInsightsModal from '../supplier/SupplierInsightsModal';
import SupplierComplianceExportModal from '../exports/SupplierComplianceExportModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { ComplianceDataService } from '@/services/ComplianceDataService';
import { AdvancedPDFExportService } from '@/services/AdvancedPDFExportService';
import { AIInsightsService } from '@/services/AIInsightsService';
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard';
import { canGenerateReport, getReportCreditCost } from '@/utils/subscriptionGuards';
import { ComplianceFilters } from '../compliance/ComplianceFilters';
import { useBranchContext } from '@/contexts/BranchContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import BuyerCorporateDocuments from '../buyer/BuyerCorporateDocuments';
import ExpiryNotificationLog from '../compliance/ExpiryNotificationLog';
import { format, differenceInDays } from 'date-fns';

// Risk level indicator component
const RiskIndicator = ({ level }: { level: 'high' | 'medium' | 'low' }) => {
  const colors = {
    high: 'bg-[hsl(0,72%,40%)]',
    medium: 'bg-[hsl(45,93%,38%)]',
    low: 'bg-[hsl(142,71%,32%)]'
  };
  const labels = {
    high: 'High',
    medium: 'Medium',
    low: 'Low'
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${colors[level]}`} />
      <span className="text-sm text-foreground">{labels[level]}</span>
    </div>
  );
};

// Status indicator for activity timeline
const ActivityIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'approved':
      return <Check className="w-3.5 h-3.5 text-[hsl(142,71%,32%)]" />;
    case 'pending':
      return <Clock className="w-3.5 h-3.5 text-[hsl(45,93%,38%)]" />;
    case 'rejected':
      return <AlertCircle className="w-3.5 h-3.5 text-[hsl(0,72%,40%)]" />;
    default:
      return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

const BuyerComplianceDashboard = () => {
  const { currentBranch, allBranchesView } = useBranchContext();
  const [supplierStats, setSupplierStats] = useState<any[]>([]);
  const [documentRequests, setDocumentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
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
  
  const { user } = useAuth();
  const { subscriptionData, hasEnoughCredits } = useSubscription();
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

  const getRiskLevel = (score: number): 'high' | 'medium' | 'low' => {
    if (score < 70) return 'high';
    if (score < 85) return 'medium';
    return 'low';
  };

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
        const newTab = window.open('', '_blank');
        if (newTab) newTab.document.write('Loading document...');
        const { data, error } = await supabase.storage
          .from('compliance-documents')
          .createSignedUrl(upload.file_path, 60);

        if (error) throw error;
        if (newTab) {
          newTab.location.href = data.signedUrl;
        } else {
          window.open(data.signedUrl, '_blank');
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

  const handleSupplierClick = (supplier: any) => {
    setSelectedSupplier({
      ...supplier,
      buyerId: buyerData?.buyer_id_number || buyerData?.id
    });
    setShowInsightsModal(true);
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
      {/* Header - Minimal, Executive-style */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Compliance Overview</h1>
          <p className="text-sm text-muted-foreground">Supplier & Document Status</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadDashboardData} className="text-muted-foreground">
            Refresh
          </Button>
          <SubscriptionGuard
            checkResult={canGenerateReport(subscriptionData, 'detailed')}
            featureName="Report Export"
            description="Generate detailed compliance reports and analytics for your suppliers."
          >
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowExportModal(true)}
              disabled={!hasEnoughCredits(getReportCreditCost('standard'))}
            >
              Export
            </Button>
          </SubscriptionGuard>
        </div>
      </div>

      {/* Branch indicator */}
      {currentBranch && !allBranchesView && (
        <Alert className="border-border bg-muted/30">
          <Building2 className="h-4 w-4" />
          <AlertTitle className="text-sm font-medium">Branch View</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            Showing data for: <span className="font-medium text-foreground">{currentBranch.branch_name}</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Risk Summary Bar - Horizontal, muted */}
      <div className="flex items-center gap-6 px-4 py-3 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Suppliers:</span>
          <span className="text-sm font-semibold text-foreground">{overallStats.totalSuppliers}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Documents:</span>
          <span className="text-sm font-semibold text-foreground">{overallStats.totalRequests}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Open Items:</span>
          <span className="text-sm font-semibold text-foreground">{overallStats.pendingRequests}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Risk: High</span>
          <span className={`text-sm font-semibold ${overallStats.highRiskSuppliers > 0 ? 'text-[hsl(0,72%,40%)]' : 'text-foreground'}`}>
            ({overallStats.highRiskSuppliers})
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Compliance Coverage:</span>
          <span className="text-sm font-semibold text-foreground">{overallStats.avgComplianceScore}%</span>
          <Progress value={overallStats.avgComplianceScore} className="w-16 h-1.5" />
        </div>
      </div>

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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
          <TabsTrigger value="suppliers" className="text-sm">Supplier Compliance</TabsTrigger>
          <TabsTrigger value="analytics" className="text-sm">Analytics</TabsTrigger>
          <TabsTrigger value="corporate" className="text-sm">Corporate Documents</TabsTrigger>
          <TabsTrigger value="communication" className="text-sm">Communication Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Attention Required Table */}
          {attentionItems.length > 0 && (
            <Card className="border-border shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">Attention Required (Next 7 Days)</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                    View All <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supplier</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Document</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attentionItems.map((item) => (
                      <TableRow key={item.id} className="border-border">
                        <TableCell className="text-sm font-medium">{item.suppliers?.company_name}</TableCell>
                        <TableCell className="text-sm">{item.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.category}</TableCell>
                        <TableCell className="text-sm">
                          {item.daysUntil < 0 ? (
                            <span className="text-[hsl(0,72%,40%)]">Overdue {Math.abs(item.daysUntil)}d</span>
                          ) : item.daysUntil === 0 ? (
                            <span className="text-[hsl(0,72%,40%)]">Today</span>
                          ) : (
                            <span className={item.daysUntil <= 3 ? 'text-[hsl(45,93%,38%)]' : 'text-foreground'}>
                              {item.daysUntil}d
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm capitalize">{item.status}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs text-primary hover:text-primary"
                            onClick={() => handleViewDocument(item)}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Supplier Compliance Table */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Supplier Compliance</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredSuppliers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supplier</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Industry</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">Docs</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">Approved</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">Open</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risk</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.map((supplier) => (
                      <TableRow 
                        key={supplier.id} 
                        className="border-border cursor-pointer hover:bg-muted/30"
                        onClick={() => handleSupplierClick(supplier)}
                      >
                        <TableCell className="text-sm font-medium">{supplier.company_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{supplier.industry || '—'}</TableCell>
                        <TableCell className="text-sm text-center">{supplier.totalRequests}</TableCell>
                        <TableCell className="text-sm text-center">{supplier.approvedRequests}</TableCell>
                        <TableCell className="text-sm text-center">{supplier.pendingRequests}</TableCell>
                        <TableCell>
                          <RiskIndicator level={getRiskLevel(supplier.complianceScore)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                            View <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-3">No suppliers match your current filters</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setFilters({
                      searchQuery: '',
                      industries: [],
                      itemCategories: [],
                      statuses: [],
                      riskLevels: []
                    })}
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Timeline */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-0">
                {filteredRequests.slice(0, 8).map((request, index) => (
                  <div 
                    key={request.id} 
                    className={`flex items-center gap-3 py-2.5 ${index !== 0 ? 'border-t border-border' : ''}`}
                  >
                    <ActivityIcon status={request.status} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">
                        <span className="font-medium">{request.title}</span>
                        <span className="text-muted-foreground"> — {request.suppliers?.company_name}</span>
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(request.updated_at || request.created_at), 'MMM d')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">All Suppliers</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredSuppliers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supplier</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Industry</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">Total Docs</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">Approved</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">Pending</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">Compliance</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risk</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.map((supplier) => (
                      <TableRow 
                        key={supplier.id} 
                        className="border-border cursor-pointer hover:bg-muted/30"
                        onClick={() => handleSupplierClick(supplier)}
                      >
                        <TableCell className="text-sm font-medium">{supplier.company_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{supplier.industry || '—'}</TableCell>
                        <TableCell className="text-sm text-center">{supplier.totalRequests}</TableCell>
                        <TableCell className="text-sm text-center">{supplier.approvedRequests}</TableCell>
                        <TableCell className="text-sm text-center">{supplier.pendingRequests}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm font-medium">{supplier.complianceScore}%</span>
                        </TableCell>
                        <TableCell>
                          <RiskIndicator level={getRiskLevel(supplier.complianceScore)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                            Details <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-3">No suppliers match your current filters</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setFilters({
                      searchQuery: '',
                      industries: [],
                      itemCategories: [],
                      statuses: [],
                      riskLevels: []
                    })}
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <ComplianceDashboard userRole="buyer" data={{ documentRequests }} />
        </TabsContent>

        <TabsContent value="corporate" className="space-y-4">
          <BuyerCorporateDocuments buyerId={buyerId} />
        </TabsContent>

        <TabsContent value="communication" className="space-y-4">
          <ExpiryNotificationLog buyerId={buyerId} />
        </TabsContent>
      </Tabs>

      <SupplierInsightsModal
        isOpen={showInsightsModal}
        onClose={() => setShowInsightsModal(false)}
        supplier={selectedSupplier}
        buyerId={buyerData?.buyer_id_number || buyerId}
      />

      <SupplierComplianceExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        suppliers={supplierStats}
        onExport={handleExportReports}
        subscriptionData={subscriptionData}
      />
    </div>
  );
};

export default BuyerComplianceDashboard;