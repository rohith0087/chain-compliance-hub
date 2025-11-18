
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';
import { 
  Shield, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Building2,
  FileCheck,
  Eye,
  Download,
  MousePointer
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
import { RefreshCcw } from 'lucide-react';
import BuyerCorporateDocuments from '../buyer/BuyerCorporateDocuments';

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
  
  // Filter states
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
      // Load buyer profile first
      const { data: buyerProfile } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

      if (buyerProfile) {
        setBuyerId(buyerProfile.id);
        setBuyerData(buyerProfile);
        
        // Load document requests with supplier info and branch filter
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

        // Apply branch filter if specific branch selected
        if (currentBranch && !allBranchesView) {
          requestsQuery = requestsQuery.eq('branch_id', currentBranch.id);
        }

        const { data: requests } = await requestsQuery.order('created_at', { ascending: false });

        setDocumentRequests(requests || []);

        // Calculate supplier compliance stats
        const supplierMap = new Map();
        requests?.forEach(request => {
          if (request.suppliers) {
            const supplierId = request.suppliers.id;
            if (!supplierMap.has(supplierId)) {
              supplierMap.set(supplierId, {
                ...request.suppliers,
                totalRequests: 0,
                approvedRequests: 0,
                pendingRequests: 0,
                rejectedRequests: 0
              });
            }
            const supplier = supplierMap.get(supplierId);
            supplier.totalRequests++;
            if (request.status === 'approved') supplier.approvedRequests++;
            if (request.status === 'pending') supplier.pendingRequests++;
            if (request.status === 'rejected') supplier.rejectedRequests++;
          }
        });

        const supplierStatsArray = Array.from(supplierMap.values()).map(supplier => ({
          ...supplier,
          complianceScore: supplier.totalRequests > 0 
            ? Math.round((supplier.approvedRequests / supplier.totalRequests) * 100)
            : 0
        }));

        // Load supplier items for category filtering
        const { data: supplierItems } = await supabase
          .from('supplier_items')
          .select('supplier_id, item_category')
          .in('supplier_id', Array.from(supplierMap.keys()));

        // Create mapping of supplier -> item categories
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

  // Apply filters whenever data or filters change
  React.useEffect(() => {
    applyFilters();
  }, [supplierStats, documentRequests, filters]);

  const applyFilters = () => {
    let filtered = [...supplierStats];

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.company_name?.toLowerCase().includes(query) ||
        s.id?.toLowerCase().includes(query) ||
        s.industry?.toLowerCase().includes(query)
      );
    }

    // Industry filter
    if (filters.industries.length > 0) {
      filtered = filtered.filter(s =>
        s.industry && filters.industries.includes(s.industry)
      );
    }

    // Item category filter
    if (filters.itemCategories.length > 0) {
      filtered = filtered.filter(s => {
        const supplierCategories = supplierItemsMap.get(s.id);
        if (!supplierCategories) return false;
        return filters.itemCategories.some(cat => supplierCategories.has(cat));
      });
    }

    // Risk level filter
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

    // Filter document requests
    let filteredReqs = [...documentRequests];

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filteredReqs = filteredReqs.filter(r =>
        r.title?.toLowerCase().includes(query) ||
        r.suppliers?.company_name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filters.statuses.length > 0) {
      filteredReqs = filteredReqs.filter(r =>
        r.status && filters.statuses.includes(r.status)
      );
    }

    // Industry filter (via supplier)
    if (filters.industries.length > 0) {
      filteredReqs = filteredReqs.filter(r =>
        r.suppliers?.industry && filters.industries.includes(r.suppliers.industry)
      );
    }

    setFilteredRequests(filteredReqs);
  };

  // Get unique industries and item categories for filters
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

  const handleViewDocument = async (request: any) => {
    console.log('Viewing document for request:', request.id);
    try {
      // Fetch latest document upload for this request
      const { data: uploads, error: uploadsError } = await supabase
        .from('document_uploads')
        .select('*')
        .eq('request_id', request.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (uploadsError) {
        console.error('Error fetching uploads:', uploadsError);
      }

      console.log('Fetched uploads:', uploads);
      const upload = uploads?.[0];
      console.log('Upload data:', upload);
      
      if (!upload?.file_path) {
        console.log('No file_path found:', upload);
        toast({
          title: "Error",
          description: "No file available for viewing",
          variant: "destructive",
        });
        return;
      }

      console.log('Attempting to access file_path:', upload.file_path);
      const isViewable = upload.mime_type?.startsWith('image/') || upload.mime_type === 'application/pdf';

      if (isViewable) {
        // Pre-open a new tab to avoid popup blockers
        const newTab = window.open('', '_blank');
        if (newTab) newTab.document.write('Loading document...');
        const { data, error } = await supabase.storage
          .from('compliance-documents')
          .createSignedUrl(upload.file_path, 60);

        if (error) {
          console.error('Signed URL error:', error);
          throw error;
        }
        console.log('Opening signed URL:', data.signedUrl);
        if (newTab) {
          newTab.location.href = data.signedUrl;
        } else {
          window.open(data.signedUrl, '_blank');
        }
      } else {
        // Prefer signed URL download
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

        // Fallback to blob download
        const { data: blob, error } = await supabase.storage
          .from('compliance-documents')
          .download(upload.file_path);

        if (error) {
          console.error('Storage download error:', error);
          throw error;
        }

        console.log('Download successful, creating blob URL');
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
      buyerId: buyerData?.buyer_id_number || buyerData?.id // Use human-readable ID
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
        // Single supplier report
        const supplierData = await ComplianceDataService.getSupplierComplianceData(
          selectedSupplierIds[0],
          buyerId,
          dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined
        );

        // Get AI insights (will fallback to static if no API key)
        const aiInsights = await AIInsightsService.generateSupplierInsights(supplierData);

        await pdfService.generateSingleSupplierReport(supplierData, aiInsights, options);
      } else {
        // Multi-supplier comparison report
        const comparisonData = await ComplianceDataService.getMultiSupplierComparisonData(
          selectedSupplierIds,
          buyerId,
          dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined
        );

        // Get AI insights for comparison
        const aiInsights = await AIInsightsService.generateComparisonInsights(comparisonData);

        await pdfService.generateComparisonReport(comparisonData, aiInsights, options);
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8">{t('common:messages.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('dashboard:compliance.title')}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadDashboardData}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            {t('common:buttons.refresh')}
          </Button>
          <SubscriptionGuard
            checkResult={canGenerateReport(subscriptionData, 'detailed')}
            featureName="Report Export"
            description="Generate detailed compliance reports and analytics for your suppliers."
          >
            <Button 
              variant="default" 
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2"
              disabled={!hasEnoughCredits(getReportCreditCost('standard'))}
            >
              <Download className="w-4 h-4" />
              Export Reports
              {subscriptionData && (
                <span className="text-xs opacity-75 ml-1">
                  ({subscriptionData.credits} credits)
                </span>
              )}
            </Button>
          </SubscriptionGuard>
        </div>
      </div>

      {/* Branch indicator */}
      {currentBranch && !allBranchesView && (
        <Alert>
          <Building2 className="h-4 w-4" />
          <AlertTitle>Branch View</AlertTitle>
          <AlertDescription>
            Showing compliance data for: <strong>{currentBranch.branch_name}</strong> ({currentBranch.location})
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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suppliers">Supplier Compliance</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="corporate">Corporate Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 animate-fade-in">
          {/* Key Metrics - Modern Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* Total Suppliers - Featured Card */}
            <Card className="group relative overflow-hidden border-0 bg-white shadow-subtle hover:shadow-elegant transition-all duration-500 hover:-translate-y-1 md:col-span-2">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/10 blur-xl group-hover:blur-2xl transition-all" />
                    <div className="relative h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-modern">
                      <Building2 className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-3 py-1.5">
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    {overallStats.totalSuppliers}
                  </p>
                  <p className="text-sm font-medium text-muted-foreground">{t('dashboard:compliance.totalSuppliers')}</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-success font-medium">Active</span>
                  <span className="text-muted-foreground">connections</span>
                </div>
              </CardContent>
            </Card>

            {/* Avg Compliance Score */}
            <Card className="group relative overflow-hidden border-0 bg-white shadow-subtle hover:shadow-modern transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-success to-success/50" />
              <CardHeader className="pb-3">
                <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-success" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-3xl font-bold">{overallStats.avgComplianceScore}%</p>
                  <p className="text-sm font-medium text-muted-foreground">{t('dashboard:compliance.overallScore')}</p>
                </div>
                <Progress value={overallStats.avgComplianceScore} className="mt-3 h-2" />
              </CardContent>
            </Card>

            {/* Pending Requests */}
            <Card className="group relative overflow-hidden border-0 bg-white shadow-subtle hover:shadow-modern transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-warning to-warning/50" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  {overallStats.pendingRequests > 5 && (
                    <Badge variant="warning" className="animate-pulse">
                      Urgent
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-3xl font-bold">{overallStats.pendingRequests}</p>
                  <p className="text-sm font-medium text-muted-foreground">{t('dashboard:compliance.pendingRequests')}</p>
                </div>
              </CardContent>
            </Card>

            {/* High Risk Suppliers */}
            <Card className="group relative overflow-hidden border-0 bg-white shadow-subtle hover:shadow-modern transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-danger to-danger/50" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-danger/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-danger" />
                  </div>
                  {overallStats.highRiskSuppliers > 0 && (
                    <Badge variant="danger">
                      High Risk
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-danger">{overallStats.highRiskSuppliers}</p>
                  <p className="text-sm font-medium text-muted-foreground">{t('dashboard:compliance.highRisk')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Total Requests */}
            <Card className="group relative overflow-hidden border-0 bg-white shadow-subtle hover:shadow-modern transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-accent/50" />
              <CardHeader className="pb-3">
                <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <FileCheck className="h-5 w-5 text-accent" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-3xl font-bold">{overallStats.totalRequests}</p>
                  <p className="text-sm font-medium text-muted-foreground">{t('dashboard:compliance.totalRequests')}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="border-0 shadow-subtle">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">
                {t('dashboard:compliance.recentActivity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredRequests.slice(0, 5).map((request) => (
                  <div key={request.id} className="group flex items-center justify-between p-4 border border-border/50 rounded-xl hover:bg-accent/5 hover:border-primary/20 transition-all">
                    <div className="flex items-center space-x-4">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        request.status === 'approved' ? 'bg-success/10' :
                        request.status === 'pending' ? 'bg-warning/10' : 'bg-danger/10'
                      }`}>
                        <FileCheck className={`w-5 h-5 ${
                          request.status === 'approved' ? 'text-success' :
                          request.status === 'pending' ? 'text-warning' : 'text-danger'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">{request.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.suppliers?.company_name} • {request.document_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge 
                        variant={
                          request.status === 'approved' ? 'approved' :
                          request.status === 'pending' ? 'pending' : 'rejected'
                        }
                      >
                        {request.status === 'approved' && <CheckCircle className="h-3 w-3 mr-1.5" />}
                        {request.status === 'pending' && <Clock className="h-3 w-3 mr-1.5" />}
                        {request.status === 'rejected' && <AlertTriangle className="h-3 w-3 mr-1.5" />}
                        {t(`common:buttons.${request.status}`)}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewDocument(request)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard:compliance.supplierCompliance')}</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredSuppliers.length > 0 ? (
                <div className="space-y-4">
                  {filteredSuppliers.map((supplier) => (
                    <div 
                      key={supplier.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleSupplierClick(supplier)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center overflow-hidden">
                          {supplier.company_logo_url ? (
                            <img 
                              src={supplier.company_logo_url} 
                              alt={`${supplier.company_name} logo`}
                              className="w-full h-full object-cover rounded-lg"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <Building2 className={`w-6 h-6 text-blue-600 ${supplier.company_logo_url ? 'hidden' : ''}`} />
                        </div>
                        <div>
                          <h3 className="font-medium flex items-center gap-2">
                            {supplier.company_name}
                            <MousePointer className="w-3 h-3 text-muted-foreground" />
                          </h3>
                          <p className="text-sm text-gray-500">{supplier.industry}</p>
                          <p className="text-xs text-gray-400">
                            {supplier.totalRequests} requests • {supplier.approvedRequests} approved
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          supplier.complianceScore >= 90 ? 'text-green-600' :
                          supplier.complianceScore >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {supplier.complianceScore}%
                        </div>
                        <Progress value={supplier.complianceScore} className="w-24 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No suppliers match your current filters</p>
                  <Button 
                    variant="outline" 
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

        <TabsContent value="corporate" className="space-y-6 animate-fade-in">
          <BuyerCorporateDocuments buyerId={buyerId} />
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
