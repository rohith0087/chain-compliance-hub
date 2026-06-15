import { useState, useEffect } from 'react';
import logger from '@/utils/logger';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  FileText,
  Search,
  Package,
  UserCog,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Play,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ComplianceRing } from '@/components/dashboard/ComplianceRing';
import { MetricChip } from '@/components/dashboard/MetricChip';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { SupplierSettingsModal } from '@/components/settings/SupplierSettingsModal';
import { SupplierSidebarLayout } from '@/components/supplier/SupplierSidebarLayout';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import DocumentRequestCard from '@/components/supplier/DocumentRequestCard';
import DocumentRequestsFilter from '@/components/supplier/DocumentRequestsFilter';
import SupplierComplianceDashboard from '@/components/dashboard/SupplierComplianceDashboard';
import UnifiedBuyerConnections from '@/components/supplier/UnifiedBuyerConnections';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySetup } from '@/hooks/useCompanySetup';
import { useWorkspaceProfile } from '@/hooks/useWorkspaceProfile';
import { supabase } from '@/integrations/supabase/client';
import SupplierDocumentsDashboard from '@/components/documents/SupplierDocumentsDashboard';
import { CompanyManagementDashboard } from '@/components/company/CompanyManagementDashboard';
import { SupplierDocumentLibrary } from '@/components/supplier/SupplierDocumentLibrary';
import { OnboardingNotification } from '@/components/supplier/OnboardingNotification';
import { OnboardingProcess } from '@/components/supplier/OnboardingProcess';
import { useOnboardingRequests } from '@/hooks/useOnboardingRequests';
import { ItemManagementDashboard } from '@/components/supplier/ItemManagementDashboard';
import { ContactRoleManager } from '@/components/supplier/ContactRoleManager';
import { ConnectWithBuyerModal } from '@/components/supplier/ConnectWithBuyerModal';
import { DocumentUploadModal } from '@/components/supplier/DocumentUploadModal';
import { MyAssignments } from '@/components/shared/MyAssignments';
import DocumentRenewalDialog from '@/components/supplier/DocumentRenewalDialog';
import { useBranchContext } from '@/contexts/BranchContext';
import { useCommunicationThreads } from '@/hooks/useCommunicationThreads';

interface SupplierDashboardProps {
  user: { 
    roles: ('buyer' | 'supplier')[];
    name: string;
    currentRole: 'buyer' | 'supplier';
  };
  onLogout: () => void;
  onRoleSwitch: (role: 'buyer' | 'supplier') => void;
  impersonatedSupplierId?: string; // Optional: when super admin is impersonating
}

const SupplierDashboard = ({ user, onLogout, onRoleSwitch, impersonatedSupplierId }: SupplierDashboardProps) => {
  const { t } = useTranslation(['supplier', 'common']);
  const { t: wsT } = useWorkspaceProfile();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('supplierDashboard_activeTab') || 'overview';
  });
  const [supplierProfile, setSupplierProfile] = useState<any>(null);
  const [documentRequests, setDocumentRequests] = useState<any[]>([]);
  const [connectedBuyers, setConnectedBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [highlightedTab, setHighlightedTab] = useState<string | null>(null);
  const [onboardingRequests, setOnboardingRequests] = useState<any[]>([]);
  const [showSimulationBanner, setShowSimulationBanner] = useState(() => {
    return localStorage.getItem('supplierSimulationBannerDismissed') !== 'true';
  });
  
  // Filter state for document requests
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    buyer: 'all',
    category: 'all',
    documentType: 'all'
  });
  
  // Dashboard data state
  const [activityTrend, setActivityTrend] = useState<{ day: string; requests: number; completed: number }[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [expiringDocuments, setExpiringDocuments] = useState<any[]>([]);
  const [renewingDocument, setRenewingDocument] = useState<any>(null);
  
  
  const { user: authUser } = useAuth();
  const { getSupplierProfile } = useCompanySetup();
  const { requests: allOnboardingRequests } = useOnboardingRequests();
  const { currentBranch, allBranchesView } = useBranchContext();
  
  // Get unread message count for sidebar badge
  const { totalUnread } = useCommunicationThreads(supplierProfile?.id || '', 'supplier');

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

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('supplierDashboard_activeTab', activeTab);
  }, [activeTab]);

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
    if (authUser || impersonatedSupplierId) {
      loadSupplierData();
    }
  }, [authUser, currentBranch?.id, allBranchesView, impersonatedSupplierId]);

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
      let profile: any = null;

      // If impersonating, use the impersonated supplier ID directly
      if (impersonatedSupplierId) {
        const { data: supplierData } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', impersonatedSupplierId)
          .single();
        
        profile = supplierData;
      } else {
        // Step 1: Check if user is a team member first (company ID resolution pattern)
        const { data: teamMember } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('profile_id', authUser?.id)
          .eq('company_type', 'supplier')
          .eq('status', 'active')
          .maybeSingle();

        if (teamMember) {
          // Team member - use company_id to fetch supplier profile
          const { data: supplierData } = await supabase
            .from('suppliers')
            .select('*')
            .eq('id', teamMember.company_id)
            .single();
          
          profile = supplierData;
        } else {
          // Company owner - use existing method
          profile = await getSupplierProfile();
        }
      }

      setSupplierProfile(profile);

      if (profile) {
        // Load document requests for this supplier with buyer information
        let requestsQuery = supabase
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
          .eq('supplier_id', profile.id);

        // Apply branch filter if specific branch selected (include NULL for non-branch-specific docs)
        if (!allBranchesView && currentBranch?.id) {
          requestsQuery = requestsQuery.or(`supplier_branch_id.eq.${currentBranch.id},supplier_branch_id.is.null`);
        }

        const { data: requests, error: requestsError } = await requestsQuery
          .order('created_at', { ascending: false });

        if (requestsError) {
          console.error('Error loading document requests:', requestsError);
        } else {
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
                logger.debug('Connected buyers with unified status loaded');
                setConnectedBuyers(connectionsWithBuyers);
              } else {
                setConnectedBuyers([]);
              }
        }

        // Load expiring documents - check LATEST upload per request, not all uploads
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        // Helper to get latest upload sorted by created_at descending
        const getLatestUpload = (uploads: any[]) => {
          if (!uploads?.length) return null;
          return [...uploads].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
        };
        
        // Query document_requests with all their uploads to check latest version
        let expiringQuery = supabase
          .from('document_requests')
          .select(`
            id,
            title,
            document_type,
            supplier_id,
            supplier_branch_id,
            buyer_id,
            buyers (company_name),
            document_uploads (
              id,
              file_name,
              expiration_date,
              status,
              created_at
            )
          `)
          .eq('supplier_id', profile.id)
          .eq('status', 'approved');

        const { data: allRequests, error: expiringError } = await expiringQuery;

        if (!expiringError && allRequests) {
          // Apply branch filter first
          let filteredRequests = allRequests;
          if (!allBranchesView && currentBranch?.id) {
            filteredRequests = allRequests.filter((req: any) => 
              req.supplier_branch_id === currentBranch.id || 
              req.supplier_branch_id === null
            );
          }

          // Filter to requests where LATEST APPROVED upload is expiring within 30 days
          const processedDocs = filteredRequests
            .map((request: any) => {
              const latestUpload = getLatestUpload(request.document_uploads);
              
              // Skip if no uploads, or latest isn't approved, or no expiration date
              if (!latestUpload || latestUpload.status !== 'approved' || !latestUpload.expiration_date) {
                return null;
              }
              
              const expDate = new Date(latestUpload.expiration_date);
              const today = new Date();
              
              // Skip if latest upload isn't expiring within 30 days
              if (expDate > thirtyDaysFromNow) {
                return null;
              }
              
              const daysUntilExpiry = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              
              return {
                id: latestUpload.id,
                request_id: request.id,
                title: request.title || latestUpload.file_name,
                buyer_name: request.buyers?.company_name || 'Unknown Buyer',
                expiration_date: latestUpload.expiration_date,
                days_until_expiry: daysUntilExpiry,
                is_expired: daysUntilExpiry < 0,
                document_uploads: request.document_uploads // For DocumentRenewalDialog
              };
            })
            .filter(Boolean) // Remove nulls
            .sort((a: any, b: any) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());
          
          setExpiringDocuments(processedDocs);
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

  // Calculate dashboard data from loaded requests
  useEffect(() => {
    if (documentRequests.length > 0) {
      // Generate activity trend for last 7 days
      const trend = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayRequests = documentRequests.filter(req => {
          const reqDate = new Date(req.created_at);
          return reqDate.toDateString() === date.toDateString();
        });
        trend.push({
          day: days[date.getDay()],
          requests: dayRequests.length,
          completed: dayRequests.filter(r => r.status === 'approved' || r.status === 'submitted').length
        });
      }
      setActivityTrend(trend);

      // Calculate upcoming deadlines
      const deadlines = documentRequests
        .filter(req => req.due_date && req.status === 'pending')
        .map(req => {
          const dueDate = new Date(req.due_date);
          const today = new Date();
          const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: req.id,
            title: req.title,
            buyer: req.buyers?.company_name || 'Unknown',
            daysLeft,
            priority: req.priority || 'medium',
            dueDate: req.due_date
          };
        })
        .filter(d => d.daysLeft >= 0 && d.daysLeft <= 30)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 5);
      setUpcomingDeadlines(deadlines);

      // Calculate action items
      const actions = [];
      const overdueRequests = documentRequests.filter(req => {
        if (req.status !== 'pending' || !req.due_date) return false;
        return new Date(req.due_date) < new Date();
      });
      if (overdueRequests.length > 0) {
        actions.push({
          id: 'overdue',
          type: 'urgent',
          title: `${overdueRequests.length} overdue document${overdueRequests.length > 1 ? 's' : ''} require attention`,
          action: () => handleNotificationNavigation('requests', undefined)
        });
      }
      const pendingRequests = documentRequests.filter(req => req.status === 'pending');
      if (pendingRequests.length > 0) {
        actions.push({
          id: 'pending',
          type: 'warning',
          title: `${pendingRequests.length} pending request${pendingRequests.length > 1 ? 's' : ''} awaiting submission`,
          action: () => handleNotificationNavigation('requests', undefined)
        });
      }
      const rejectedRequests = documentRequests.filter(req => req.status === 'rejected');
      if (rejectedRequests.length > 0) {
        actions.push({
          id: 'rejected',
          type: 'error',
          title: `${rejectedRequests.length} rejected document${rejectedRequests.length > 1 ? 's' : ''} need resubmission`,
          action: () => handleNotificationNavigation('requests', undefined)
        });
      }
      setActionItems(actions);
    }
  }, [documentRequests]);

  // Filter document requests based on current filters
  const filteredRequests = documentRequests.filter(request => {
    const searchLower = filters.search.toLowerCase();
    const matchesSearch = !filters.search || 
      request.title.toLowerCase().includes(searchLower) ||
      request.document_type.toLowerCase().includes(searchLower) ||
      request.buyers?.company_name?.toLowerCase().includes(searchLower);
    
    const matchesStatus = !filters.status || filters.status === 'all' || request.status === filters.status;
    const matchesPriority = !filters.priority || filters.priority === 'all' || request.priority === filters.priority;
    const matchesBuyer = !filters.buyer || filters.buyer === 'all' || request.buyer_id === filters.buyer;
    const matchesCategory = !filters.category || filters.category === 'all' || request.category === filters.category;
    const matchesDocumentType = !filters.documentType || filters.documentType === 'all' || request.document_type === filters.documentType;

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
        // Prepare chart data
        const documentStatusData = [
          { name: 'Approved', value: stats.approvedDocuments, color: 'hsl(var(--green-accent))' },
          { name: 'Pending', value: stats.pendingRequests, color: 'hsl(var(--amber-accent))' },
          { name: 'Submitted', value: stats.documentsSubmitted, color: 'hsl(var(--blue-accent))' },
        ].filter(d => d.value > 0);

        const COLORS = ['hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(221, 83%, 53%)'];

        // Check if supplier is new (no connections and no document requests)
        const isNewSupplier = connectedBuyers.length === 0 && documentRequests.length === 0;

        return (
          <div className="space-y-6">
            {/* Simulation Banner for New Suppliers */}
            {showSimulationBanner && isNewSupplier && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <Play className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-amber-900">New here? Try our Interactive Simulation</h3>
                          <p className="text-sm text-amber-700">Learn how to connect with buyers, complete onboarding, and submit documents - all with practice data.</p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            localStorage.setItem('supplierSimulationBannerDismissed', 'true');
                            setShowSimulationBanner(false);
                          }}
                          className="border-amber-300 text-amber-700 hover:bg-amber-100"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Maybe Later
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => navigate('/supplier-simulation')}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Start Simulation
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Hero Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Welcome Card */}
              <div className="lg:col-span-2">
                <Card className="h-full bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-teal-500/10 border-green-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-4">
                        <div>
                          <h1 className="text-2xl font-bold text-foreground">
                            Welcome back, {supplierProfile?.company_name || user.name}
                          </h1>
                          <p className="text-muted-foreground mt-1">
                            Here's your compliance overview for today
                          </p>
                        </div>
                        
                        {/* Metric Chips */}
                        <div className="flex flex-wrap gap-3 mt-6">
                          <MetricChip 
                            label="Pending" 
                            value={stats.pendingRequests} 
                            color="amber"
                            pulse={stats.pendingRequests > 0}
                            onClick={() => {
                              sessionStorage.setItem('supplier_docs_filter_status', 'pending');
                              setActiveTab('documents');
                            }}
                          />
                          <MetricChip 
                            label="Submitted" 
                            value={stats.documentsSubmitted} 
                            color="blue"
                            onClick={() => {
                              sessionStorage.setItem('supplier_docs_filter_status', 'submitted');
                              setActiveTab('documents');
                            }}
                          />
                          <MetricChip 
                            label="Approved" 
                            value={stats.approvedDocuments} 
                            color="green"
                            onClick={() => {
                              sessionStorage.setItem('supplier_docs_filter_status', 'approved');
                              setActiveTab('documents');
                            }}
                          />
                          <MetricChip 
                            label={wsT.buyers} 
                            value={connectedBuyers.length} 
                            color="purple"
                            onClick={() => setActiveTab('buyers')}
                          />
                        </div>
                      </div>
                      
                      {/* Company Logo */}
                      {supplierProfile?.company_logo_url ? (
                        <img
                          src={supplierProfile.company_logo_url}
                          alt={`${supplierProfile.company_name} logo`}
                          className="w-16 h-16 object-contain rounded-lg border border-border/50"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-green-500/10 rounded-lg flex items-center justify-center">
                          <Building2 className="w-8 h-8 text-green-500" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Compliance Ring */}
              <Card className="flex items-center justify-center">
                <CardContent className="p-6 text-center">
                  <ComplianceRing score={completionRate} size={140} />
                  <p className="text-sm text-muted-foreground mt-2">Completion Rate</p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Document Status Pie Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      Document Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {documentStatusData.length > 0 ? (
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={documentStatusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {documentStatusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-4 mt-2">
                          {documentStatusData.map((item, index) => (
                            <div key={item.name} className="flex items-center gap-1.5 text-xs">
                              <div 
                                className="w-2.5 h-2.5 rounded-full" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-muted-foreground">{item.name}: {item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        No documents yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Activity Trend */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2"
              >
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      7-Day Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={activityTrend}>
                          <defs>
                            <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="day" 
                            tick={{ fontSize: 12 }} 
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }} 
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="requests" 
                            stroke="hsl(142, 76%, 36%)" 
                            fillOpacity={1} 
                            fill="url(#colorRequests)" 
                            name="Requests"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Expiring Documents */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Expiring Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {expiringDocuments.length > 0 ? (
                    <ScrollArea className="h-[280px] pr-4">
                      <div className="space-y-3">
                        {expiringDocuments.map((doc) => (
                          <div 
                            key={doc.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors border"
                            onClick={() => {
                              setActiveTab('documents');
                              const url = new URL(window.location.href);
                              url.searchParams.set('tab', 'documents');
                              url.searchParams.set('subtab', 'expiring');
                              url.searchParams.set('highlightDoc', doc.request_id);
                              window.history.pushState({}, '', url.toString());
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{doc.title}</p>
                              <p className="text-xs text-muted-foreground">{doc.buyer_name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={doc.is_expired ? 'destructive' : 'warning'}
                                className="shrink-0"
                              >
                                {doc.is_expired 
                                  ? 'Expired' 
                                  : doc.days_until_expiry === 0 
                                    ? 'Today' 
                                    : `${doc.days_until_expiry}d left`
                                }
                              </Badge>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenewingDocument(doc);
                                }}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Renew
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">All documents are up to date!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Document Requests */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-muted-foreground" />
                      Recent Requests
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {documentRequests.length} total
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {documentRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('supplier:sections.noRecentRequests')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {documentRequests.slice(0, 5).map((request) => (
                        <div 
                          key={request.id} 
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleNotificationNavigation('requests', request.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {getStatusIcon(request.status)}
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{request.title}</p>
                              <p className="text-xs text-muted-foreground">{request.buyers?.company_name}</p>
                            </div>
                          </div>
                          <Badge className={`${getStatusColor(request.status)} shrink-0`}>
                            {request.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
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
      case 'items':
        return <ItemManagementDashboard supplierId={supplierProfile?.id!} />;
      case 'contacts':
        return <ContactRoleManager supplierId={supplierProfile?.id!} />;
      case 'connections':
        return <UnifiedBuyerConnections onConnectionRequest={loadSupplierData} />;
      case 'compliance':
        return <SupplierComplianceDashboard />;
      case 'company':
        return (
          <CompanyManagementDashboard 
            companyId={supplierProfile?.id}
            companyType="supplier"
            companyName={supplierProfile?.company_name || wsT.supplier_profile}
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
        unreadMessages={totalUnread}
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

      {/* Document Renewal Dialog */}
      {renewingDocument && (
        <DocumentRenewalDialog
          isOpen={!!renewingDocument}
          onClose={() => setRenewingDocument(null)}
          request={renewingDocument}
          expiryStatus={{
            status: renewingDocument.is_expired ? 'expired' : 'expiring_soon',
            days: Math.abs(renewingDocument.days_until_expiry)
          }}
          onRenewalSuccess={() => {
            setRenewingDocument(null);
            loadSupplierData();
          }}
        />
      )}
    </SidebarProvider>
  );
};

export default SupplierDashboard;