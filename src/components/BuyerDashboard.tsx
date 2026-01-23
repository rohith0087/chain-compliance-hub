import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyPermissions } from '@/hooks/useCompanyPermissions';
import { useTranslation } from 'react-i18next';
import RequestsList from '@/components/requests/RequestsList';
import SupplierDiscovery from '@/components/buyer/SupplierDiscovery';
import NewRequestModal from '@/components/NewRequestModal';
import BuyerComplianceDashboard from '@/components/dashboard/BuyerComplianceDashboard';
import AgentManagementDashboard from '@/components/agents/AgentManagementDashboard';
import BuyerDocumentsDashboard from '@/components/documents/BuyerDocumentsDashboard';
import BuyerConnectionRequests from '@/components/buyer/BuyerConnectionRequests';
import { BuyerSettingsModal } from '@/components/settings/BuyerSettingsModal';
import { CompanyManagementDashboard } from '@/components/company/CompanyManagementDashboard';
import CustomTemplateManager from '@/components/buyer/CustomTemplateManager';
import { BulkInviteModal } from '@/components/buyer/BulkInviteModal';
import BuyerSidebarLayout from '@/components/buyer/BuyerSidebarLayout';
import { BuyerDocumentPrePopulator } from '@/components/buyer/BuyerDocumentPrePopulator';
import { SidebarProvider } from '@/components/ui/sidebar';
import SubscriptionPage from '@/pages/SubscriptionPage';
import { useBranchContext } from '@/contexts/BranchContext';
import ItemComplianceView from '@/components/buyer/ItemComplianceView';
import { AllSuppliersPerformanceDashboard } from '@/components/buyer/AllSuppliersPerformanceDashboard';
import { SupplierRiskManagement } from '@/components/buyer/SupplierRiskManagement';
import { DocumentAssignmentManager } from '@/components/buyer/DocumentAssignmentManager';
import { OnboardingPipelineView } from '@/components/buyer/OnboardingPipelineView';
import { DocumentSetManager } from '@/components/buyer/DocumentSetManager';
import { BuyerSupplierFacilityMatrix } from '@/components/buyer/BuyerSupplierFacilityMatrix';
import SampleTemplateManager from '@/components/buyer/SampleTemplateManager';
import { SupplierMap } from '@/components/buyer/SupplierMap';
import { ComplianceRing } from '@/components/dashboard/ComplianceRing';
import { MetricChip } from '@/components/dashboard/MetricChip';
import { AttentionPanel } from '@/components/dashboard/AttentionPanel';
import { ExpiryPanel } from '@/components/dashboard/ExpiryPanel';
import { ActivityQuickActionsPanel } from '@/components/dashboard/ActivityQuickActionsPanel';
import { motion } from 'framer-motion';
import { useCommunicationThreads } from '@/hooks/useCommunicationThreads';

import { supabase } from '@/integrations/supabase/client';

interface BuyerDashboardProps {
  user: {
    roles: ('buyer' | 'supplier')[];
    name: string;
    currentRole: 'buyer' | 'supplier';
  };
  onLogout: () => void;
  onRoleSwitch: (role: 'buyer' | 'supplier') => void;
}

const BuyerDashboard = ({ user, onLogout, onRoleSwitch }: BuyerDashboardProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('buyerDashboard_activeTab') || 'dashboard';
  });
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [documentsKey, setDocumentsKey] = useState(0); // Force remount when navigating from dashboard
  const [dashboardStats, setDashboardStats] = useState({
    connectedSuppliers: 0,
    activeRequests: 0,
    pendingReview: 0,
    approvedDocs: 0,
    expiringSoon: 0,
    onboardingCount: 0,
    rejectedDocs: 0,
    totalDocs: 0,
  });
  const { user: authUser, profile } = useAuth();
  const { t } = useTranslation(['dashboard', 'common']);
  const { currentBranch, allBranchesView } = useBranchContext();
  
  // Get permissions to check if user is company owner
  const { isOwner, loading: permissionsLoading } = useCompanyPermissions(companyId, 'buyer');
  
  // Get unread message count for sidebar badge
  const { totalUnread } = useCommunicationThreads(companyId || '', 'buyer');
  
  // Reset activeTab if non-owner tries to access owner-only tabs
  useEffect(() => {
    const ownerOnlyTabs = ['company', 'subscription'];
    if (!permissionsLoading && ownerOnlyTabs.includes(activeTab) && !isOwner) {
      setActiveTab('dashboard');
    }
  }, [activeTab, permissionsLoading, isOwner]);

  // Refresh buyer profile function  
  const refreshBuyerProfile = async () => {
    if (!authUser) return;
    
    try {
      // Check if user is a team member first
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id, company_type')
        .eq('profile_id', authUser.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .single();

      if (teamMember) {
        // Team member - fetch company data using company_id
        console.log('Refreshing profile for team member, company_id:', teamMember.company_id);
        const { data: buyer, error: buyerError } = await supabase
          .from('buyers')
          .select('*')
          .eq('id', teamMember.company_id)
          .single();

        if (buyerError && buyerError.code !== 'PGRST116') {
          console.error('Error fetching buyer profile:', buyerError);
          return;
        }

        setBuyerProfile(buyer);
        setCompanyId(teamMember.company_id);
      } else {
        // Company owner - fetch using profile_id
        console.log('Refreshing profile for company owner');
        const { data: buyer, error: buyerError } = await supabase
          .from('buyers')
          .select('*')
          .eq('profile_id', authUser.id)
          .single();

        if (buyerError && buyerError.code !== 'PGRST116') {
          console.error('Error fetching buyer profile:', buyerError);
          return;
        }

        setBuyerProfile(buyer);
        setCompanyId(buyer?.id);
      }
    } catch (error) {
      console.error('Error refreshing buyer profile:', error);
    }
  };

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('buyerDashboard_activeTab', activeTab);
  }, [activeTab]);

  // Fetch buyer profile data and dashboard stats (top-level metrics only)
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!authUser) return;

      try {
        // Check if user is a team member first
        const { data: teamMember, error: teamError } = await supabase
          .from('company_users')
          .select('company_id, company_type, role, status')
          .eq('profile_id', authUser.id)
          .eq('company_type', 'buyer')
          .in('status', ['active', 'pending'])
          .single();

        if (teamError && teamError.code !== 'PGRST116') {
          console.error('Error checking team membership:', teamError);
        }

        if (teamMember) {
          // User is a team member - fetch company data using company_id
          setCompanyId(teamMember.company_id);
          
          const { data: buyer, error: buyerError } = await supabase
            .from('buyers')
            .select('*')
            .eq('id', teamMember.company_id)
            .single();

          if (buyerError && buyerError.code !== 'PGRST116') {
            console.error('Error fetching buyer profile for team member:', buyerError);
          }
          
          setBuyerProfile(buyer);
        } else {
          // User is a company owner - fetch buyer profile
          const { data: buyer, error: buyerError } = await supabase
            .from('buyers')
            .select('*')
            .eq('profile_id', authUser.id)
            .single();

          if (buyerError && buyerError.code !== 'PGRST116') {
            console.error('Error fetching buyer profile:', buyerError);
            return;
          }

          setCompanyId(buyer?.id);
          setBuyerProfile(buyer);
        }

        const effectiveBuyerId = teamMember?.company_id || buyerProfile?.id;

        if (effectiveBuyerId) {
          const branchFilter = !allBranchesView && currentBranch?.id ? currentBranch.id : null;

          // Fetch only top-level metrics for the metric chips
          const [
            suppliersResult,
            activeResult,
            pendingResult,
            approvedResult,
            expiringResult,
            onboardingResult
          ] = await Promise.all([
            branchFilter 
              ? supabase.from('branch_supplier_connections').select('id', { count: 'exact', head: true }).eq('branch_id', branchFilter).eq('status', 'active')
              : supabase.from('buyer_supplier_connections').select('id', { count: 'exact', head: true }).eq('buyer_id', effectiveBuyerId).eq('status', 'approved'),
            supabase.from('document_requests').select('id', { count: 'exact', head: true }).eq('buyer_id', effectiveBuyerId).eq('status', 'pending').then(q => branchFilter ? supabase.from('document_requests').select('id', { count: 'exact', head: true }).eq('buyer_id', effectiveBuyerId).eq('status', 'pending').eq('branch_id', branchFilter) : q),
            supabase.from('document_requests').select('id', { count: 'exact', head: true }).eq('buyer_id', effectiveBuyerId).eq('status', 'submitted').then(q => branchFilter ? supabase.from('document_requests').select('id', { count: 'exact', head: true }).eq('buyer_id', effectiveBuyerId).eq('status', 'submitted').eq('branch_id', branchFilter) : q),
            supabase.from('document_requests').select('id', { count: 'exact', head: true }).eq('buyer_id', effectiveBuyerId).eq('status', 'approved').then(q => branchFilter ? supabase.from('document_requests').select('id', { count: 'exact', head: true }).eq('buyer_id', effectiveBuyerId).eq('status', 'approved').eq('branch_id', branchFilter) : q),
            supabase.from('document_uploads').select('id, document_requests!inner(buyer_id, branch_id)', { count: 'exact', head: true })
              .eq('document_requests.buyer_id', effectiveBuyerId)
              .eq('status', 'approved')
              .not('expiration_date', 'is', null)
              .gte('expiration_date', new Date().toISOString().split('T')[0])
              .lte('expiration_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
            supabase.from('supplier_onboarding_requests').select('id', { count: 'exact', head: true }).eq('buyer_id', effectiveBuyerId).in('status', ['pending', 'invited', 'onboarding_initiated'])
          ]);

          const totalDocs = (approvedResult.count || 0) + (pendingResult.count || 0) + (activeResult.count || 0);
          setDashboardStats({
            connectedSuppliers: suppliersResult.count || 0,
            activeRequests: activeResult.count || 0,
            pendingReview: pendingResult.count || 0,
            approvedDocs: approvedResult.count || 0,
            expiringSoon: expiringResult.count || 0,
            onboardingCount: onboardingResult.count || 0,
            rejectedDocs: 0,
            totalDocs: totalDocs,
          });
        }
      } catch (error) {
        console.error('Error in fetchDashboardData:', error);
      }
    };

    fetchDashboardData();
  }, [authUser, currentBranch?.id, allBranchesView]);

  const handleFindSuppliersClick = () => {
    console.log('Find Suppliers button clicked, switching to suppliers tab');
    setActiveTab('suppliers');
  };

  const handleLogoutClick = async () => {
    try {
      console.log('Buyer dashboard logout clicked');
      await onLogout();
    } catch (error) {
      console.error('Error in buyer dashboard logout:', error);
    }
  };

  const handleCreateRequest = (request: any) => {
    console.log('Request created:', request);
    // Handle the created request - could add to local state, refresh data, etc.
  };

  return (
    <SidebarProvider>
      <BuyerSidebarLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
        onLogout={handleLogoutClick}
        onRoleSwitch={onRoleSwitch}
        onShowRequestForm={() => setShowRequestForm(true)}
        onShowSettings={() => setShowSettings(true)}
        onShowQuickOnboarding={() => setActiveTab('onboarding')}
        onShowBulkInvite={() => setShowBulkInvite(true)}
        buyerProfile={buyerProfile}
        companyId={companyId}
        unreadMessages={totalUnread}
      >
        {/* Dashboard Content - Single Page No Scroll */}
        {activeTab === 'dashboard' && companyId && (
          <div className="h-[calc(100vh-80px)] overflow-hidden flex flex-col animate-fade-in">
            {/* Top Metrics Bar - Fixed Height */}
            <motion.div 
              className="flex-shrink-0 mb-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-card via-card to-muted/20 border border-border/40 shadow-sm">
                <MetricChip 
                  label="Suppliers" 
                  value={dashboardStats.connectedSuppliers} 
                  color="blue" 
                  onClick={() => setActiveTab('suppliers')}
                />
                <div className="w-px h-12 bg-border/30 hidden sm:block" />
                <MetricChip 
                  label="Active" 
                  value={dashboardStats.activeRequests} 
                  color="amber" 
                  onClick={() => {
                    sessionStorage.setItem('buyer_docs_filter_status', 'pending');
                    setDocumentsKey(prev => prev + 1);
                    setActiveTab('documents');
                  }}
                />
                <div className="w-px h-12 bg-border/30 hidden sm:block" />
                <MetricChip 
                  label="Pending Review" 
                  value={dashboardStats.pendingReview} 
                  color="teal" 
                  pulse={dashboardStats.pendingReview > 0}
                  onClick={() => {
                    sessionStorage.setItem('buyer_docs_filter_status', 'submitted');
                    setDocumentsKey(prev => prev + 1);
                    setActiveTab('documents');
                  }}
                />
                <div className="w-px h-12 bg-border/30 hidden sm:block" />
                <MetricChip 
                  label="Expiring" 
                  value={dashboardStats.expiringSoon} 
                  color="red" 
                  pulse={dashboardStats.expiringSoon > 0}
                  onClick={() => {
                    sessionStorage.setItem('buyer_docs_filter_expiration', 'expiring_soon');
                    setDocumentsKey(prev => prev + 1);
                    setActiveTab('documents');
                  }}
                />
                <div className="w-px h-12 bg-border/30 hidden sm:block" />
                <div className="ml-auto">
                  <ComplianceRing 
                    score={dashboardStats.totalDocs > 0 
                      ? Math.round((dashboardStats.approvedDocs / dashboardStats.totalDocs) * 100) 
                      : 0
                    }
                    size={80}
                    strokeWidth={6}
                  />
                </div>
              </div>
            </motion.div>

            {/* Three Column Grid - Fills Remaining Height */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Needs Your Attention */}
              <motion.div 
                className="lg:col-span-3 overflow-hidden"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <AttentionPanel 
                  buyerId={companyId}
                  onNavigateToDocuments={(filter) => {
                    if (filter) sessionStorage.setItem('buyer_docs_filter_status', filter);
                    setDocumentsKey(prev => prev + 1);
                    setActiveTab('documents');
                  }}
                />
              </motion.div>

              {/* Center Column: Expiring Documents */}
              <motion.div 
                className="lg:col-span-6 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <ExpiryPanel 
                  buyerId={companyId}
                  onNavigateToDocuments={(filter) => {
                    if (filter) sessionStorage.setItem('buyer_docs_filter_expiration', filter);
                    setDocumentsKey(prev => prev + 1);
                    setActiveTab('documents');
                  }}
                />
              </motion.div>

              {/* Right Column: Activity + Quick Actions */}
              <motion.div 
                className="lg:col-span-3 overflow-hidden"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <ActivityQuickActionsPanel 
                  buyerId={companyId}
                  onNewRequest={() => setShowRequestForm(true)}
                  onInviteSupplier={() => setShowBulkInvite(true)}
                  onNavigateToDocuments={(filter) => {
                    if (filter) sessionStorage.setItem('buyer_docs_filter_status', filter);
                    setDocumentsKey(prev => prev + 1);
                    setActiveTab('documents');
                  }}
                  onNavigateToTab={setActiveTab}
                />
              </motion.div>
            </div>
          </div>
        )}

        {/* Compliance Content */}
        {activeTab === 'compliance' && (
          <BuyerComplianceDashboard />
        )}

        {/* Agents Content */}
        {activeTab === 'agents' && (
          <AgentManagementDashboard />
        )}

        {/* Requests Content */}
        {activeTab === 'requests' && (
          <RequestsList onNewRequest={() => setShowRequestForm(true)} />
        )}

        {/* Documents Content */}
        {activeTab === 'documents' && (
          <BuyerDocumentsDashboard key={documentsKey} />
        )}

        {/* Performance Dashboard */}
        {activeTab === 'performance' && (
          <AllSuppliersPerformanceDashboard />
        )}

        {/* Risk Management */}
        {activeTab === 'risk' && (
          <SupplierRiskManagement />
        )}

        {/* Document Assignments */}
        {activeTab === 'assignments' && (
          <DocumentAssignmentManager />
        )}

        {/* Item Compliance Content */}
        {activeTab === 'item-compliance' && companyId && (
          <ItemComplianceView buyerId={companyId} />
        )}

        {/* Facility Matrix Content */}
        {activeTab === 'facility-matrix' && (
          <BuyerSupplierFacilityMatrix />
        )}

        {/* Onboarding Content - Use Pipeline View */}
        {activeTab === 'onboarding' && (
          <OnboardingPipelineView />
        )}

        {/* Templates Content */}
        {activeTab === 'templates' && (
          <CustomTemplateManager />
        )}

        {/* Sample Templates Content */}
        {activeTab === 'sample-templates' && companyId && (
          <SampleTemplateManager buyerId={companyId} />
        )}

        {/* Document Sets Content */}
        {activeTab === 'document-sets' && companyId && (
          <DocumentSetManager buyerId={companyId} />
        )}

        {/* Suppliers Content */}
        {activeTab === 'suppliers' && (
          <div className="space-y-6">
            <SupplierDiscovery />
          </div>
        )}

        {/* Supplier Map */}
        {activeTab === 'supplier-map' && (
          <SupplierMap />
        )}

        {/* Supplier Requests Content */}
        {activeTab === 'supplier-requests' && (
          <BuyerConnectionRequests />
        )}

        {/* Pre-populate Documents Content */}
        {activeTab === 'pre-populate' && buyerProfile && (
          <BuyerDocumentPrePopulator
            buyerId={buyerProfile.id}
            branchId={currentBranch?.id}
            onComplete={() => {
              // Optionally refresh data or show success message
            }}
          />
        )}

        {/* Company Content */}
        {activeTab === 'company' && companyId && (
          <CompanyManagementDashboard 
            companyId={companyId}
            companyType="buyer"
            companyName={buyerProfile?.company_name || 'Company'}
          />
        )}

        {/* Subscription & Billing */}
        {activeTab === 'subscription' && (
          <SubscriptionPage />
        )}

        {/* Modals */}
      <NewRequestModal
        isOpen={showRequestForm}
        onClose={() => setShowRequestForm(false)}
        onCreateRequest={handleCreateRequest}
        userType="buyer"
        currentBranch={currentBranch}
      />

      <BuyerSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        onSettingsUpdated={refreshBuyerProfile}
      />

      {companyId && profile && (
          <BulkInviteModal
            isOpen={showBulkInvite}
            onClose={() => setShowBulkInvite(false)}
            buyerId={companyId}
            buyerProfile={buyerProfile || { id: companyId, company_name: 'Your Company', contact_email: profile.email }}
          />
      )}
    </BuyerSidebarLayout>
  </SidebarProvider>
  );
};

export default BuyerDashboard;