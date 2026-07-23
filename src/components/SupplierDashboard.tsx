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
  BarChart3,
  MessageSquare,
  Search,
  Package,
  UserCog,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { ComplianceRing } from '@/components/dashboard/ComplianceRing';
import { cardClass, cardLiftedClass, pillClass, sectionLabelClass, hoverSurfaceClass } from '@/design/system';
import { UnifiedSettingsModal } from '@/components/settings/UnifiedSettingsModal';
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
import { useEvidenceSharingFeature } from '@/hooks/useEvidenceSharingFeature';
import EvidenceSharingView from '@/components/supplier/EvidenceSharingView';

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
  const [expiringDocuments, setExpiringDocuments] = useState<any[]>([]);
  const [renewingDocument, setRenewingDocument] = useState<any>(null);
  
  
  const { user: authUser } = useAuth();
  const { getSupplierProfile } = useCompanySetup();
  const { requests: allOnboardingRequests } = useOnboardingRequests();
  const { currentBranch, allBranchesView } = useBranchContext();
  
  // Get unread message count for sidebar badge
  const { totalUnread } = useCommunicationThreads(supplierProfile?.id || '', 'supplier');
  const { enabled: evidenceSharingEnabled, loading: evidenceSharingLoading } = useEvidenceSharingFeature(supplierProfile?.id);

  useEffect(() => {
    if (!evidenceSharingLoading && !evidenceSharingEnabled && activeTab === 'evidence-sharing') {
      setActiveTab('overview');
    }
  }, [activeTab, evidenceSharingEnabled, evidenceSharingLoading]);

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
    rejectedDocuments: documentRequests.filter(req => req.status === 'rejected').length,
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
      default: return 'bg-muted text-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-muted text-foreground';
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
          <p className="text-muted-foreground">{t('supplier:loading')}</p>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': {
        // Single-viewport bento: one row of six scannable metrics, then the
        // work surface sized by day-to-day weight — pending requests are the
        // daily driver so they get the hero panel (lifted, e3); rejections and
        // expiry/onboarding are compact stacked cards on the right. Rows keep
        // natural height and lists scroll internally, so the page never does.
        const metricTiles: Array<{
          key: string;
          label: string;
          value: number;
          icon: typeof Clock;
          tone: 'warning' | 'primary' | 'success' | 'danger';
          onClick: () => void;
        }> = [
          {
            key: 'pending', label: 'Pending', value: stats.pendingRequests, icon: Clock, tone: 'warning',
            onClick: () => { sessionStorage.setItem('supplier_docs_filter_status', 'pending'); setActiveTab('documents'); },
          },
          {
            key: 'submitted', label: 'Submitted', value: stats.documentsSubmitted, icon: FileCheck, tone: 'primary',
            onClick: () => { sessionStorage.setItem('supplier_docs_filter_status', 'submitted'); setActiveTab('documents'); },
          },
          {
            key: 'approved', label: 'Approved', value: stats.approvedDocuments, icon: CheckCircle, tone: 'success',
            onClick: () => { sessionStorage.setItem('supplier_docs_filter_status', 'approved'); setActiveTab('documents'); },
          },
          {
            key: 'rejected', label: 'Rejected', value: stats.rejectedDocuments, icon: AlertTriangle, tone: 'danger',
            onClick: () => { sessionStorage.setItem('supplier_docs_filter_status', 'rejected'); setActiveTab('documents'); },
          },
          {
            key: 'buyers', label: wsT.buyers, value: connectedBuyers.length, icon: Users, tone: 'primary',
            onClick: () => setActiveTab('connections'),
          },
        ];

        const toneClass: Record<string, string> = {
          warning: 'bg-warning/10 text-warning',
          primary: 'bg-primary/10 text-primary',
          success: 'bg-success/10 text-success',
          danger: 'bg-danger/10 text-danger',
        };

        const buyerNameById = new Map(
          connectedBuyers.map((c: any) => [c.buyer_id, c.buyers?.company_name || 'Buyer'])
        );

        const now = new Date();
        const attentionRequests = documentRequests
          .filter(req => req.status === 'pending')
          .sort((a, b) => {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          })
          .slice(0, 12);

        const rejectedList = documentRequests.filter(req => req.status === 'rejected').slice(0, 8);
        const pendingOnboardingList = onboardingRequests.filter(req => req.status === 'pending').slice(0, 8);
        const showOnboarding = pendingOnboardingList.length > 0;
        const expiringList = expiringDocuments.slice(0, 8);

        const fmtDate = (iso: string) =>
          new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        const ColumnHeader = ({ icon: Icon, iconTone, label, count }: {
          icon: typeof Clock; iconTone: string; label: string; count: number;
        }) => (
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <span className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${iconTone}`} />
              <span className={sectionLabelClass}>{label}</span>
            </span>
            <span className={pillClass}>{count}</span>
          </div>
        );

        const EmptyState = ({ label }: { label: string }) => (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle className="h-[18px] w-[18px]" />
            </span>
            <p className="text-small text-muted-foreground">{label}</p>
          </div>
        );

        return (
          <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 lg:h-[calc(100vh-72px-48px)]">

            {/* Metrics — one row of six */}
            <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {metricTiles.map(({ key, label, value, icon: Icon, tone, onClick }) => (
                <button
                  key={key}
                  onClick={onClick}
                  className={`${cardClass} group flex items-center gap-3 px-4 py-3 text-left transition-all hover:shadow-e3 hover:border-border`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${toneClass[tone]}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-h2 font-bold leading-none text-foreground">{value}</div>
                    <div className="mt-1 truncate text-caption font-medium text-muted-foreground">{label}</div>
                  </div>
                </button>
              ))}

              <div className={`${cardClass} flex items-center gap-3 px-4 py-3`}>
                <ComplianceRing score={completionRate} size={38} strokeWidth={4} showLabel={false} />
                <div className="min-w-0">
                  <div className="font-display text-h2 font-bold leading-none text-foreground">{completionRate}%</div>
                  <div className="mt-1 truncate text-caption font-medium text-muted-foreground">Completion</div>
                </div>
              </div>
            </div>

            {/* Work surface */}
            <div className="grid flex-1 grid-cols-1 gap-4 lg:min-h-0 lg:grid-cols-3">

              {/* Hero — needs attention (the one panel the user acts on daily) */}
              <div className={`${cardLiftedClass} flex min-h-0 flex-col overflow-hidden lg:col-span-2`}>
                <ColumnHeader icon={Clock} iconTone="text-warning" label="Needs attention" count={stats.pendingRequests} />
                {attentionRequests.length === 0 ? (
                  <EmptyState label="Nothing pending — you're all caught up." />
                ) : (
                  <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                    {attentionRequests.map((request: any) => {
                      const overdue = request.due_date && new Date(request.due_date) < now;
                      return (
                        <button
                          key={request.id}
                          onClick={() => handleNotificationNavigation('requests', request.id)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left ${hoverSurfaceClass}`}
                        >
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control ${overdue ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                            {overdue ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body font-medium text-foreground">{request.title}</p>
                            <p className="truncate text-caption text-muted-foreground">{request.buyers?.company_name}</p>
                          </div>
                          {overdue ? (
                            <span className="inline-flex shrink-0 items-center rounded-pill border border-danger/30 bg-danger/10 px-2.5 py-0.5 text-caption font-medium text-danger">
                              Overdue
                            </span>
                          ) : request.due_date ? (
                            <span className={`${pillClass} shrink-0`}>Due {fmtDate(request.due_date)}</span>
                          ) : (
                            <span className="shrink-0 text-caption text-muted-foreground">No due date</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {stats.pendingRequests > attentionRequests.length && (
                  <button
                    onClick={() => { sessionStorage.setItem('supplier_docs_filter_status', 'pending'); setActiveTab('documents'); }}
                    className="shrink-0 border-t border-border px-4 py-2.5 text-caption font-semibold text-primary transition-colors hover:bg-muted/40"
                  >
                    View all {stats.pendingRequests} pending
                  </button>
                )}
              </div>

              {/* Right stack — rejections + (onboarding | expiring) */}
              <div className="flex min-h-0 flex-col gap-4">

                <div className={`${cardClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
                  <ColumnHeader icon={AlertTriangle} iconTone="text-danger" label="Rejected" count={stats.rejectedDocuments} />
                  {rejectedList.length === 0 ? (
                    <EmptyState label="No rejections." />
                  ) : (
                    <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                      {rejectedList.map((request: any) => (
                        <button
                          key={request.id}
                          onClick={() => handleNotificationNavigation('requests', request.id)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left ${hoverSurfaceClass}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body font-medium text-foreground">{request.title}</p>
                            <p className="truncate text-caption text-muted-foreground">{request.buyers?.company_name}</p>
                          </div>
                          <span className="shrink-0 text-caption font-semibold text-danger">Resubmit</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {showOnboarding ? (
                  <div className={`${cardClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
                    <ColumnHeader icon={UserCog} iconTone="text-primary" label="Onboarding" count={pendingOnboardingList.length} />
                    <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                      {pendingOnboardingList.map((req: any) => (
                        <button
                          key={req.id}
                          onClick={() => setActiveTab('connections')}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left ${hoverSurfaceClass}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body font-medium text-foreground">{buyerNameById.get(req.buyer_id) || 'Buyer'}</p>
                            <p className="truncate text-caption text-muted-foreground">Onboarding in progress</p>
                          </div>
                          <span className="shrink-0 text-caption text-muted-foreground">{fmtDate(req.created_at)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={`${cardClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
                    <ColumnHeader icon={RefreshCw} iconTone="text-primary" label="Expiring soon" count={expiringDocuments.length} />
                    {expiringList.length === 0 ? (
                      <EmptyState label="All documents current." />
                    ) : (
                      <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                        {expiringList.map((doc: any) => (
                          <div key={doc.id} className={`flex items-center gap-3 px-4 py-3 ${hoverSurfaceClass}`}>
                            <button
                              onClick={() => setActiveTab('documents')}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="truncate text-body font-medium text-foreground">{doc.title}</p>
                              <p className="truncate text-caption text-muted-foreground">{doc.buyer_name}</p>
                            </button>
                            <span className={`shrink-0 inline-flex items-center rounded-pill px-2.5 py-0.5 text-caption font-medium ${doc.is_expired ? 'border border-danger/30 bg-danger/10 text-danger' : 'border border-warning/30 bg-warning/10 text-warning'}`}>
                              {doc.is_expired ? 'Expired' : `${doc.days_until_expiry}d`}
                            </span>
                            <button
                              onClick={() => setRenewingDocument(doc)}
                              className="shrink-0 text-caption font-semibold text-primary hover:underline"
                            >
                              Renew
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }
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
                    <FileCheck className="w-12 h-12 text-muted-foreground/70 mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('supplier:sections.noRecentRequests')}</p>
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
      case 'evidence-sharing':
        return supplierProfile?.id && evidenceSharingEnabled
          ? <EvidenceSharingView supplierId={supplierProfile.id} />
          : null;
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
        evidenceSharingEnabled={evidenceSharingEnabled}
      >
        {renderTabContent()}
      </SupplierSidebarLayout>

      {/* Settings Modal */}
      <UnifiedSettingsModal
        open={showSettingsModal}
        onOpenChange={(open) => {
          setShowSettingsModal(open);
          if (!open) handleProfileUpdated();
        }}
        companyId={supplierProfile?.id}
        companyType="supplier"
        companyName={supplierProfile?.company_name || 'Your Company'}
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