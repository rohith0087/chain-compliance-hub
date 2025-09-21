import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
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
import { SupplierSettingsModal } from '@/components/settings/SupplierSettingsModal';
import { SupplierSidebarLayout } from '@/components/supplier/SupplierSidebarLayout';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import ConnectionRequests from '@/components/supplier/ConnectionRequests';
import ConnectedBuyersTab from '@/components/supplier/ConnectedBuyersTab';
import DocumentRequestCard from '@/components/supplier/DocumentRequestCard';
import DocumentRequestsFilter from '@/components/supplier/DocumentRequestsFilter';
import SupplierComplianceDashboard from '@/components/dashboard/SupplierComplianceDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySetup } from '@/hooks/useCompanySetup';
import { supabase } from '@/integrations/supabase/client';
import SupplierDocumentsDashboard from '@/components/documents/SupplierDocumentsDashboard';
import { CompanyManagementDashboard } from '@/components/company/CompanyManagementDashboard';
import { SupplierDocumentLibrary } from '@/components/supplier/SupplierDocumentLibrary';
import { OnboardingNotification } from '@/components/supplier/OnboardingNotification';
import { OnboardingProcess } from '@/components/supplier/OnboardingProcess';
import { useOnboardingRequests } from '@/hooks/useOnboardingRequests';
import { ConnectWithBuyerModal } from '@/components/supplier/ConnectWithBuyerModal';
import { DocumentUploadModal } from '@/components/supplier/DocumentUploadModal';

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
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [highlightedTab, setHighlightedTab] = useState<string | null>(null);
  const [onboardingRequests, setOnboardingRequests] = useState<any[]>([]);
  
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
  const { requests: allOnboardingRequests } = useOnboardingRequests();

  // Notification navigation handler
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

  // Calculate stats from real data
  const stats = {
    pendingRequests: documentRequests.filter(req => req.status === 'pending').length,
    documentsSubmitted: documentRequests.filter(req => req.status === 'submitted').length,
    approvedDocuments: documentRequests.filter(req => req.status === 'approved').length,
    expiringDocuments: 0, // This would need a separate query for expiring documents
    pendingOnboarding: onboardingRequests.filter(req => req.status === 'pending').length
  };

  const completionRate = documentRequests.length > 0 
    ? Math.round((stats.approvedDocuments / documentRequests.length) * 100) 
    : 0;

  useEffect(() => {
    if (authUser) {
      loadSupplierData();
    }
  }, [authUser]);

  // Filter onboarding requests for current supplier
  useEffect(() => {
    if (authUser && allOnboardingRequests) {
      const supplierRequests = allOnboardingRequests.filter(req => 
        req.supplier_email === authUser.email || 
        (supplierProfile && req.supplier_id === supplierProfile.id)
      );
      setOnboardingRequests(supplierRequests);
    }
  }, [authUser, allOnboardingRequests, supplierProfile]);

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

        // Load connected buyers - Include onboarding status in the query
        const { data: connections, error: connectionsError } = await supabase
          .from('buyer_supplier_connections')
          .select(`
            *,
            supplier_onboarding_requests!onboarding_request_id (
              id,
              status,
              approved_at
            )
          `)
          .eq('supplier_id', profile.id);

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
                      buyers: null,
                      unifiedStatus: 'error'
                    };
                  }
                  
                  // Determine unified status
                  let unifiedStatus = 'pending';
                  if (connection.status === 'approved') {
                    if (connection.supplier_onboarding_requests && Array.isArray(connection.supplier_onboarding_requests) && connection.supplier_onboarding_requests.length > 0) {
                      const onboardingRequest = connection.supplier_onboarding_requests[0];
                      if (onboardingRequest.status === 'approved') {
                        unifiedStatus = 'fullyConnected';
                      } else {
                        unifiedStatus = 'onboardingPending';
                      }
                    } else {
                      unifiedStatus = 'approved';
                    }
                  } else if (connection.status === 'rejected') {
                    unifiedStatus = 'rejected';
                  }
                  
                  return {
                    ...connection,
                    buyers: buyerData,
                    unifiedStatus
                  };
                });
                
                const connectionsWithBuyers = await Promise.all(buyerDetailsPromises);
                console.log('Connected buyers with unified status:', connectionsWithBuyers);
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
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

            {/* Recent Activity Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Document Requests */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {t('supplier:sections.recentRequests')}
                    <Badge variant="outline">{documentRequests.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {documentRequests.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">{t('supplier:sections.noRecentRequests')}</p>
                  ) : (
                    <div className="space-y-3">
                      {documentRequests.slice(0, 5).map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(request.status)}
                            <div>
                              <p className="font-medium">{request.title}</p>
                              <p className="text-sm text-gray-500">{request.buyers?.company_name}</p>
                            </div>
                          </div>
                          <Badge className={getStatusColor(request.status)}>
                            {request.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Connected Buyers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {t('supplier:sections.connectedBuyers')}
                    <Badge variant="outline">{connectedBuyers.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {connectedBuyers.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">{t('supplier:sections.noConnectedBuyers')}</p>
                  ) : (
                    <div className="space-y-3">
                      {connectedBuyers.slice(0, 5).map((connection) => (
                        <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium">{connection.buyers?.company_name}</p>
                              <p className="text-sm text-gray-500">{connection.buyers?.industry}</p>
                            </div>
                          </div>
                          <Badge variant="outline">
                            {t(`supplier:connectionStatus.${connection.unifiedStatus || 'pending'}`)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        );
      case 'requests':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">{t('supplier:tabs.requests')}</h2>
              <Badge variant="outline">{filteredRequests.length} requests</Badge>
            </div>
            
            <DocumentRequestsFilter
              filters={filters}
              onFiltersChange={setFilters}
              buyers={uniqueBuyers}
            />
            
            <div className="grid gap-4">
              {filteredRequests.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">{t('supplier:sections.noRecentRequests')}</p>
                  </CardContent>
                </Card>
              ) : (
                filteredRequests.map((request) => (
                  <DocumentRequestCard
                    key={request.id}
                    request={request}
                    onUploadSuccess={loadSupplierData}
                  />
                ))
              )}
            </div>
          </div>
        );
      case 'documents':
        return <SupplierDocumentsDashboard />;
      case 'library':
        return <SupplierDocumentLibrary supplierId={supplierProfile?.id} />;
      case 'buyers':
        return <ConnectedBuyersTab connectedBuyers={connectedBuyers} />;
      case 'connections':
        return <ConnectionRequests />;
      case 'compliance':
        return <SupplierComplianceDashboard />;
      case 'company':
        return (
          <CompanyManagementDashboard 
            companyId={supplierProfile?.id}
            companyType="supplier"
            companyName={supplierProfile?.company_name || 'Supplier'}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SidebarProvider>
      <SupplierSidebarLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
        onLogout={onLogout}
        onRoleSwitch={onRoleSwitch}
        onShowSettings={() => setShowSettingsModal(true)}
        supplierProfile={supplierProfile}
        onConnectWithBuyer={() => setShowConnectModal(true)}
        onUploadDocument={() => setShowUploadModal(true)}
        pendingRequests={stats.pendingRequests}
        connectedBuyers={connectedBuyers.length}
      >
        {renderTabContent()}
      </SupplierSidebarLayout>

      {/* Settings Modal */}
      <SupplierSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onProfileUpdated={handleProfileUpdated}
      />

      {/* Connect with Buyer Modal */}
      {showConnectModal && (
        <ConnectWithBuyerModal
          onConnectionRequest={() => {
            setShowConnectModal(false);
            loadSupplierData();
          }}
        />
      )}

      {/* Document Upload Modal */}
      {showUploadModal && supplierProfile && (
        <DocumentUploadModal
          supplierId={supplierProfile.id}
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={() => {
            setShowUploadModal(false);
            loadSupplierData();
          }}
        />
      )}
    </SidebarProvider>
  );
};

export default SupplierDashboard;