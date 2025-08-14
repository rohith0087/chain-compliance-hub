
import { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const BuyerComplianceDashboard = () => {
  const [supplierStats, setSupplierStats] = useState<any[]>([]);
  const [documentRequests, setDocumentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [buyerData, setBuyerData] = useState<any>(null);
  const [buyerId, setBuyerId] = useState<string>('');
  const { user } = useAuth();
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

        setSupplierStats(supplierStatsArray);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const overallStats = {
    totalSuppliers: supplierStats.length,
    totalRequests: documentRequests.length,
    avgComplianceScore: supplierStats.length > 0 
      ? Math.round(supplierStats.reduce((sum, s) => sum + s.complianceScore, 0) / supplierStats.length)
      : 0,
    pendingRequests: documentRequests.filter(r => r.status === 'pending').length,
    highRiskSuppliers: supplierStats.filter(s => s.complianceScore < 70).length
  };

  const handleViewDocument = async (request: any) => {
    try {
      // Fetch document uploads for this request
      const { data: uploads } = await supabase
        .from('document_uploads')
        .select('*')
        .eq('request_id', request.id)
        .limit(1);

      const upload = uploads?.[0];
      if (!upload?.file_path) {
        toast({
          title: "Error",
          description: "No file available for viewing",
          variant: "destructive",
        });
        return;
      }

      // For images, open in new tab, for others download
      if (upload.mime_type?.startsWith('image/')) {
        const { data, error } = await supabase.storage
          .from('compliance-documents')
          .createSignedUrl(upload.file_path, 60);

        if (error) throw error;
        window.open(data.signedUrl, '_blank');
      } else {
        // Download the file
        const { data, error } = await supabase.storage
          .from('compliance-documents')
          .download(upload.file_path);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = upload.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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

  if (loading) {
    return <div className="flex items-center justify-center py-8">{t('common:messages.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('dashboard:compliance.title')}</h2>
        <Button variant="outline" onClick={loadDashboardData}>
          {t('common:buttons.refresh')}
        </Button>
      </div>

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
                {documentRequests.slice(0, 5).map((request) => (
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
              <div className="space-y-4">
                {supplierStats.map((supplier) => (
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
    </div>
  );
};

export default BuyerComplianceDashboard;
