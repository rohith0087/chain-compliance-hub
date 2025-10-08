
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

const BuyerComplianceDashboard = () => {
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
  }, [user]);

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
        
        // Load document requests with supplier info
        const { data: requests } = await supabase
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
          .eq('buyer_id', buyerProfile.id)
          .order('created_at', { ascending: false });

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
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suppliers">Supplier Compliance</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard:compliance.totalSuppliers')}</CardTitle>
                <Building2 className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallStats.totalSuppliers}</div>
                <p className="text-xs text-muted-foreground">Connected suppliers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard:compliance.overallScore')}</CardTitle>
                <Shield className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{overallStats.avgComplianceScore}%</div>
                <Progress value={overallStats.avgComplianceScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard:compliance.pendingRequests')}</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{overallStats.pendingRequests}</div>
                <p className="text-xs text-muted-foreground">Awaiting response</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard:compliance.highRisk')}</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{overallStats.highRiskSuppliers}</div>
                <p className="text-xs text-muted-foreground">Suppliers below 70%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard:compliance.totalRequests')}</CardTitle>
                <FileCheck className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallStats.totalRequests}</div>
                <p className="text-xs text-muted-foreground">All time requests</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard:compliance.recentActivity')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredRequests.slice(0, 5).map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileCheck className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-medium">{request.title}</p>
                        <p className="text-sm text-gray-500">
                          {request.suppliers?.company_name} • {request.document_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={
                          request.status === 'approved' ? 'default' :
                          request.status === 'pending' ? 'secondary' : 'destructive'
                        }
                        className={
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'rejected' ? 'bg-red-100 text-red-800' : ''
                        }
                      >
                        {t(`common:buttons.${request.status}`)}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewDocument(request)}
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
