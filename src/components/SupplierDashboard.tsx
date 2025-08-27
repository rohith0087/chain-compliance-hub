
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileCheck, 
  Upload, 
  Calendar,
  Bell,
  Download,
  Plus,
  Settings,
  Users,
  Building2,
  BarChart3,
  MessageSquare,
  FileText
} from 'lucide-react';
import RoleSwitcher from '@/components/RoleSwitcher';
import { SupplierSettingsModal } from '@/components/settings/SupplierSettingsModal';
import ConnectionRequests from '@/components/supplier/ConnectionRequests';
import ConnectedBuyersTab from '@/components/supplier/ConnectedBuyersTab';
import DocumentRequestCard from '@/components/supplier/DocumentRequestCard';
import DocumentRequestsFilter from '@/components/supplier/DocumentRequestsFilter';
import SupplierComplianceDashboard from '@/components/dashboard/SupplierComplianceDashboard';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySetup } from '@/hooks/useCompanySetup';
import { supabase } from '@/integrations/supabase/client';
import SupplierDocumentsDashboard from '@/components/documents/SupplierDocumentsDashboard';
import { CompanyManagementDashboard } from '@/components/company/CompanyManagementDashboard';
import { BranchSelector } from '@/components/company/BranchSelector';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
import { SupplierDocumentLibrary } from '@/components/supplier/SupplierDocumentLibrary';

interface SupplierDashboardProps {
  user: { 
    roles: ('buyer' | 'supplier')[];
    name: string;
    currentRole: 'buyer' | 'supplier';
  };
  onLogout: () => void;
  onRoleSwitch: (role: 'buyer' | 'supplier') => void;
}

const SupplierDashboard = ({ user, onLogout, onRoleSwitch }: SupplierDashboardProps) => {
  const { t } = useTranslation(['supplier', 'common']);
  const [activeTab, setActiveTab] = useState('overview');
  const [supplierProfile, setSupplierProfile] = useState<any>(null);
  const [documentRequests, setDocumentRequests] = useState<any[]>([]);
  const [connectedBuyers, setConnectedBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [highlightedTab, setHighlightedTab] = useState<string | null>(null);
  
  // Filter state for document requests
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    buyer: '',
    category: '',
    documentType: ''
  });
  
  const { user: authUser } = useAuth();
  const { getSupplierProfile } = useCompanySetup();

  // Company branches management
  const {
    branches,
    currentBranch,
    switchBranch,
    loading: branchesLoading
  } = useCompanyBranches(supplierProfile?.id, 'supplier');

  // Calculate stats from real data
  const stats = {
    pendingRequests: documentRequests.filter(req => req.status === 'pending').length,
    documentsSubmitted: documentRequests.filter(req => req.status === 'submitted').length,
    approvedDocuments: documentRequests.filter(req => req.status === 'approved').length,
    expiringDocuments: 0 // This would need a separate query for expiring documents
  };

  const completionRate = documentRequests.length > 0 
    ? Math.round((stats.approvedDocuments / documentRequests.length) * 100) 
    : 0;

  useEffect(() => {
    if (authUser) {
      loadSupplierData();
    }
  }, [authUser]);

  // Handle URL params for tab navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const highlight = urlParams.get('highlight');
    
    if (tab) {
      setActiveTab(tab);
      if (highlight === 'true') {
        setHighlightedTab(tab);
        // Clear highlight after 3 seconds
        setTimeout(() => setHighlightedTab(null), 3000);
      }
    }
  }, []);

  const handleNotificationNavigation = (tab: string, notificationId?: string) => {
    setActiveTab(tab);
    setHighlightedTab(tab);
    
    // Update URL with tab parameter
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    url.searchParams.set('highlight', 'true');
    if (notificationId) {
      url.searchParams.set('notificationId', notificationId);
    }
    window.history.pushState({}, '', url.toString());
    
    // Clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedTab(null);
      // Clean up URL params
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('highlight');
      cleanUrl.searchParams.delete('notificationId');
      window.history.replaceState({}, '', cleanUrl.toString());
    }, 3000);
  };

  const loadSupplierData = async () => {
    setLoading(true);
    try {
      console.log('Loading supplier data for user:', authUser?.id);
      
      // Load supplier profile
      const profile = await getSupplierProfile();
      console.log('Loaded supplier profile:', profile);
      setSupplierProfile(profile);

      if (profile) {
        // Load document requests for this supplier with buyer information
        const { data: requests, error: requestsError } = await supabase
          .from('document_requests')
          .select(`
            *,
            buyers (
              id,
              company_name,
              industry,
              contact_email,
              profile_id
            )
          `)
          .eq('supplier_id', profile.id)
          .order('created_at', { ascending: false });

        if (requestsError) {
          console.error('Error loading document requests:', requestsError);
        } else {
          console.log('Loaded document requests:', requests);
          setDocumentRequests(requests || []);
        }

        // Load connected buyers - First get connections, then fetch buyer details separately
        const { data: connections, error: connectionsError } = await supabase
          .from('buyer_supplier_connections')
          .select('*')
          .eq('supplier_id', profile.id)
          .eq('status', 'approved');

        if (connectionsError) {
          console.error('Error loading buyer connections:', connectionsError);
          setConnectedBuyers([]);
        } else {
          console.log('Loaded connections:', connections);
          
          // Fetch buyer details separately for each connection
          if (connections && connections.length > 0) {
            const buyerDetailsPromises = connections.map(async (connection) => {
              const { data: buyerData, error: buyerError } = await supabase
                .from('buyers')
                .select('*')
                .eq('id', connection.buyer_id)
                .single();
              
              if (buyerError) {
                console.error('Error fetching buyer details for connection:', connection.id, buyerError);
                return {
                  ...connection,
                  buyers: null
                };
              }
              
              return {
                ...connection,
                buyers: buyerData
              };
            });
            
            const connectionsWithBuyers = await Promise.all(buyerDetailsPromises);
            console.log('Connected buyers with details:', connectionsWithBuyers);
            setConnectedBuyers(connectionsWithBuyers);
          } else {
            setConnectedBuyers([]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading supplier data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdated = () => {
    loadSupplierData();
  };

  // Filter document requests based on current filters
  const filteredRequests = documentRequests.filter(request => {
    const searchLower = filters.search.toLowerCase();
    const matchesSearch = !filters.search || 
      request.title.toLowerCase().includes(searchLower) ||
      request.document_type.toLowerCase().includes(searchLower) ||
      request.buyers?.company_name?.toLowerCase().includes(searchLower);
    
    const matchesStatus = !filters.status || request.status === filters.status;
    const matchesPriority = !filters.priority || request.priority === filters.priority;
    const matchesBuyer = !filters.buyer || request.buyer_id === filters.buyer;
    const matchesCategory = !filters.category || request.category === filters.category;
    const matchesDocumentType = !filters.documentType || request.document_type === filters.documentType;

    return matchesSearch && matchesStatus && matchesPriority && matchesBuyer && matchesCategory && matchesDocumentType;
  });

  // Get unique buyers for filter dropdown
  const uniqueBuyers = documentRequests
    .filter(req => req.buyers)
    .map(req => req.buyers)
    .filter((buyer, index, self) => 
      index === self.findIndex(b => b.id === buyer.id)
    );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'submitted': return <FileCheck className="w-4 h-4" />;
      case 'rejected': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('supplier:loading')}</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">ComplianceFlow</h1>
              <Badge variant="secondary" className="bg-green-100 text-green-800">{t('supplier:title')}</Badge>
            </div>
            <div className="flex items-center space-x-4">
              {user.roles.length > 1 && (
                <RoleSwitcher 
                  currentRole={user.currentRole}
                  onRoleChange={onRoleSwitch}
                />
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowSettingsModal(true)}>
                <Settings className="w-4 h-4 mr-2" />
                {t('supplier:settings')}
              </Button>
              <NotificationCenter onNavigate={handleNotificationNavigation} />
              <span className="text-sm text-gray-600">{t('supplier:welcome', { name: user.name })}</span>
              <Button variant="outline" size="sm" onClick={onLogout}>
                {t('supplier:logout')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Company Info Banner */}
        {supplierProfile && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h2 className="text-2xl font-bold text-gray-900">{supplierProfile.company_name}</h2>
                    {branches.length > 1 && (
                      <BranchSelector
                        branches={branches}
                        currentBranch={currentBranch}
                        onBranchChange={switchBranch}
                        loading={branchesLoading}
                      />
                    )}
                  </div>
                  <p className="text-gray-600">{supplierProfile.industry}</p>
                  <p className="text-sm text-gray-500">{supplierProfile.contact_email}</p>
                </div>
              </div>
                <Button variant="outline" onClick={() => setShowSettingsModal(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  {t('supplier:settings')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('supplier:stats.pendingRequests')}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingRequests}</div>
              <p className="text-xs text-muted-foreground">{t('supplier:stats.awaitingSubmission')}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('supplier:stats.completionRate')}</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completionRate}%</div>
              <Progress value={completionRate} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('supplier:stats.documentsSubmitted')}</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.documentsSubmitted}</div>
              <p className="text-xs text-muted-foreground">{t('supplier:stats.totalSubmitted')}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('supplier:stats.connectedBuyers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{connectedBuyers.length}</div>
              <p className="text-xs text-muted-foreground">{t('supplier:stats.activeConnections')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">{t('supplier:tabs.overview')}</TabsTrigger>
            <TabsTrigger 
              value="compliance"
              className={highlightedTab === 'compliance' ? 'ring-2 ring-primary ring-offset-2 animate-pulse' : ''}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              {t('supplier:tabs.compliance')}
            </TabsTrigger>
            <TabsTrigger 
              value="documents"
              className={highlightedTab === 'documents' ? 'ring-2 ring-primary ring-offset-2 animate-pulse' : ''}
            >
              <FileCheck className="w-4 h-4 mr-2" />
              {t('supplier:tabs.documents')}
            </TabsTrigger>
            <TabsTrigger value="library">
              <FileText className="w-4 h-4 mr-2" />
              Document Library
            </TabsTrigger>
            <TabsTrigger 
              value="connections"
              className={highlightedTab === 'connections' ? 'ring-2 ring-primary ring-offset-2 animate-pulse' : ''}
            >
              {t('supplier:tabs.connections')}
            </TabsTrigger>
            <TabsTrigger 
              value="requests"
              className={highlightedTab === 'requests' ? 'ring-2 ring-primary ring-offset-2 animate-pulse' : ''}
            >
              {t('supplier:tabs.requests')}
            </TabsTrigger>
            <TabsTrigger 
              value="buyers"
              className={highlightedTab === 'buyers' ? 'ring-2 ring-primary ring-offset-2 animate-pulse' : ''}
            >
              {t('supplier:tabs.buyers')}
            </TabsTrigger>
            <TabsTrigger 
              value="company"
              className={highlightedTab === 'company' ? 'ring-2 ring-primary ring-offset-2 animate-pulse' : ''}
            >
              <Building2 className="w-4 h-4 mr-2" />
              {t('supplier:tabs.company')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Requests */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Document Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  {documentRequests.length > 0 ? (
                    <div className="space-y-4">
                      {documentRequests.slice(0, 3).map(request => {
                        const buyerName = request.buyers?.company_name || 'Unknown Buyer';
                        return (
                          <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <div>
                                <p className="font-medium">{request.title}</p>
                                <p className="text-sm text-gray-500">{request.document_type}</p>
                                <p className="text-xs text-gray-400">From: {buyerName}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getPriorityColor(request.priority || 'medium')} variant="secondary">
                                {request.priority || 'medium'}
                              </Badge>
                              <Badge className={getStatusColor(request.status)} variant="secondary">
                                {getStatusIcon(request.status)}
                                <span className="ml-1 capitalize">{request.status}</span>
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No document requests yet</p>
                    </div>
                  )}
                  <Button variant="outline" className="w-full mt-4" onClick={() => setActiveTab('requests')}>
                    View All Requests
                  </Button>
                </CardContent>
              </Card>

              {/* Connected Buyers */}
              <Card>
                <CardHeader>
                  <CardTitle>Connected Buyers</CardTitle>
                </CardHeader>
                <CardContent>
                  {connectedBuyers.length > 0 ? (
                    <div className="space-y-4">
                      {connectedBuyers.slice(0, 3).map((connection) => {
                        const buyerInfo = connection.buyers;
                        const companyName = buyerInfo?.company_name || 'Unknown Company';
                        const industry = buyerInfo?.industry || 'Industry not specified';
                        const contactEmail = buyerInfo?.contact_email || 'Email not provided';
                        
                        return (
                          <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Building2 className="w-5 h-5 text-blue-500" />
                              <div>
                                <p className="font-medium">{companyName}</p>
                                <p className="text-sm text-gray-500">{industry}</p>
                                <p className="text-xs text-gray-400">{contactEmail}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                              Connected
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No connected buyers yet</p>
                    </div>
                  )}
                  <Button variant="outline" className="w-full mt-4" onClick={() => setActiveTab('buyers')}>
                    View All Buyers
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <SupplierComplianceDashboard />
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <SupplierDocumentsDashboard />
          </TabsContent>

          <TabsContent value="library" className="space-y-6">
            {supplierProfile && (
              <SupplierDocumentLibrary supplierId={supplierProfile.id} />
            )}
          </TabsContent>

          <TabsContent value="connections" className="space-y-6">
            <ConnectionRequests />
          </TabsContent>

          <TabsContent value="requests" className="space-y-6">
            {/* Filter Component */}
            <DocumentRequestsFilter 
              filters={filters}
              onFiltersChange={setFilters}
              buyers={uniqueBuyers}
            />

            {/* Document Requests List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Document Requests ({filteredRequests.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredRequests.length > 0 ? (
                  <div className="space-y-4">
                    {filteredRequests.map(request => (
                      <DocumentRequestCard
                        key={request.id}
                        request={request}
                        onUploadSuccess={loadSupplierData}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Document Requests Found</h3>
                    <p className="text-gray-500">
                      {documentRequests.length === 0 
                        ? "You don't have any document requests yet." 
                        : "No requests match your current filters."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buyers">
            <ConnectedBuyersTab 
              connectedBuyers={connectedBuyers} 
              onConnectionRequest={loadSupplierData}
            />
          </TabsContent>

          <TabsContent value="company" className="space-y-2">
            {supplierProfile && (
              <CompanyManagementDashboard
                companyId={supplierProfile.id}
                companyType="supplier"
                companyName={supplierProfile.company_name}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      <SupplierSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onProfileUpdated={loadSupplierData}
      />
    </div>
  );
};

export default SupplierDashboard;
