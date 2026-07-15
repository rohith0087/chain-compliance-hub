import { useState, useEffect } from 'react';
import logger from '@/utils/logger';
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
import { UnifiedSettingsModal } from '@/components/settings/UnifiedSettingsModal';
import { SettingsWorkspace } from '@/components/settings/SettingsWorkspace';
import { CompanyManagementDashboard } from '@/components/company/CompanyManagementDashboard';
import CustomTemplateManager from '@/components/buyer/CustomTemplateManager';
import { BulkInviteModal } from '@/components/buyer/BulkInviteModal';
import BuyerSidebarLayout from '@/components/buyer/BuyerSidebarLayout';
import { BuyerDocumentPrePopulator } from '@/components/buyer/BuyerDocumentPrePopulator';
import { SidebarProvider } from '@/components/ui/sidebar';
import SubscriptionPage from '@/pages/SubscriptionPage';
import { useBranchContext } from '@/contexts/BranchContext';
import ItemComplianceView from '@/components/buyer/ItemComplianceView';
import ItemComplianceDemo from '@/components/buyer/ItemComplianceDemo';
import FacilityMatrixDemo from '@/components/buyer/FacilityMatrixDemo';
import { AllSuppliersPerformanceDashboard } from '@/components/buyer/AllSuppliersPerformanceDashboard';
import { SupplierRiskManagement } from '@/components/buyer/SupplierRiskManagement';
import { DocumentAssignmentManager } from '@/components/buyer/DocumentAssignmentManager';
import { OnboardingPipelineView } from '@/components/buyer/OnboardingPipelineView';
import { DocumentSetManager } from '@/components/buyer/DocumentSetManager';
import { BuyerSupplierFacilityMatrix } from '@/components/buyer/BuyerSupplierFacilityMatrix';
import SampleTemplateManager from '@/components/buyer/SampleTemplateManager';
import { SupplierMap } from '@/components/buyer/SupplierMap';
import { SupplierRiskAssessment } from '@/components/buyer/supplier-risk/SupplierRiskAssessment';
import { COADashboard } from '@/components/buyer/coa/COADashboard';
import BuyerCorporateDocuments from '@/components/buyer/BuyerCorporateDocuments';
import ExpiryNotificationLog from '@/components/compliance/ExpiryNotificationLog';
import { ComplianceRing } from '@/components/dashboard/ComplianceRing';
import { MetricChip } from '@/components/dashboard/MetricChip';
import { AttentionPanel } from '@/components/dashboard/AttentionPanel';
import { ExpiryPanel } from '@/components/dashboard/ExpiryPanel';
import { ActivityQuickActionsPanel } from '@/components/dashboard/ActivityQuickActionsPanel';
import { AuditorDashboardPanel } from '@/components/dashboard/auditor/AuditorDashboardPanel';
import { getWorkspaceProfileForIndustry } from '@/config/workspaceProfiles';
import { BuyerOverviewDashboard } from '@/components/dashboard/BuyerOverviewDashboard';
import { motion } from 'framer-motion';
import { Users, Clock, AlertTriangle } from 'lucide-react';
import { useCommunicationThreads } from '@/hooks/useCommunicationThreads';
import { useRequirementEngineFeature } from '@/hooks/useRequirementEngineFeature';
import RequirementEngineView from '@/components/buyer/RequirementEngineView';
import FrameworkLibraryView from '@/components/buyer/FrameworkLibraryView';
import EvidenceMappingReviewQueue from '@/components/buyer/EvidenceMappingReviewQueue';
import CommandCenterView from '@/components/buyer/CommandCenterView';
import RequirementExtractorView from '@/components/buyer/RequirementExtractorView';
import ComplianceQAView from '@/components/buyer/ComplianceQAView';
import { useComplianceDecisionsFeature } from '@/hooks/useComplianceDecisionsFeature';
import ComplianceDecisionsView from '@/components/buyer/ComplianceDecisionsView';
import { useDossiersFeature } from '@/hooks/useDossiersFeature';
import DossierGeneratorView from '@/components/buyer/DossierGeneratorView';
import SupplierComplianceWorkspace from '@/components/buyer/SupplierComplianceWorkspace';
import SupplierDetailPage from '@/components/buyer/SupplierDetailPage';
import { InboundEmailReviewQueue } from '@/components/buyer/InboundEmailReviewQueue';
import AuditorDocumentComparisonView from '@/components/buyer/AuditorDocumentComparisonView';
import { useOrganizationFeature } from '@/hooks/useOrganizationFeature';

import { supabase } from '@/integrations/supabase/client';

interface BuyerDashboardProps {
  user: {
    roles: ('buyer' | 'supplier')[];
    name: string;
    currentRole: 'buyer' | 'supplier';
  };
  onLogout: () => void;
  onRoleSwitch: (role: 'buyer' | 'supplier') => void;
  impersonatedBuyerId?: string; // Optional: when super admin is impersonating
}

const BuyerDashboard = ({ user, onLogout, onRoleSwitch, impersonatedBuyerId }: BuyerDashboardProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('buyerDashboard_activeTab') || 'dashboard';
  });
  const [dashboardView, setDashboardView] = useState<'overview' | 'detailed'>(() => {
    return (localStorage.getItem('buyerDashboard_view') as 'overview' | 'detailed') || 'overview';
  });
  useEffect(() => {
    const handler = () => {
      setDashboardView((localStorage.getItem('buyerDashboard_view') as 'overview' | 'detailed') || 'overview');
    };
    window.addEventListener('buyer-dashboard-view-changed', handler);
    return () => window.removeEventListener('buyer-dashboard-view-changed', handler);
  }, []);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [companyId, setCompanyId] = useState<string | undefined>(impersonatedBuyerId);
  const [documentsKey, setDocumentsKey] = useState(0); // Force remount when navigating from dashboard
  // Per-supplier consolidated compliance workspace (opened from Frameworks coverage or Suppliers)
  const [complianceSupplier, setComplianceSupplier] = useState<{ id: string; name: string } | null>(null);
  const openSupplierCompliance = (supplierId: string, supplierName: string) => {
    setComplianceSupplier({ id: supplierId, name: supplierName });
    setActiveTab('supplier-compliance');
  };
  // Full-page supplier detail (redesigned modal) opened from Suppliers → View details
  const [detailSupplier, setDetailSupplier] = useState<{ id: string; name: string } | null>(null);
  const openSupplierDetail = (supplierId: string, supplierName: string) => {
    setDetailSupplier({ id: supplierId, name: supplierName });
    setActiveTab('supplier-detail');
  };
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
  const { enabled: requirementEngineEnabled, loading: requirementEngineLoading } = useRequirementEngineFeature(companyId);
  const { enabled: complianceDecisionsEnabled, loading: complianceDecisionsLoading } = useComplianceDecisionsFeature(companyId);
  const { enabled: dossiersEnabled, loading: dossiersLoading } = useDossiersFeature(companyId);
  const { enabled: emailReplyIngestionEnabled, loading: emailReplyIngestionLoading } = useOrganizationFeature('email_reply_ingestion_v1',companyId,'buyer');

  useEffect(() => {
    if (!dossiersLoading && !dossiersEnabled && activeTab === 'dossiers') {
      setActiveTab('compliance');
    }
  }, [activeTab, dossiersEnabled, dossiersLoading]);

  useEffect(()=>{
    if(!emailReplyIngestionLoading&&!emailReplyIngestionEnabled&&activeTab==='email-intake')setActiveTab('documents');
  },[activeTab,emailReplyIngestionEnabled,emailReplyIngestionLoading]);

  useEffect(() => {
    if (!requirementEngineLoading && !requirementEngineEnabled && activeTab === 'requirements') {
      setActiveTab('compliance');
    }
  }, [activeTab, requirementEngineEnabled, requirementEngineLoading]);

  useEffect(() => {
    if (!complianceDecisionsLoading && !complianceDecisionsEnabled && (activeTab === 'compliance-decisions' || activeTab === 'supplier-compliance')) {
      setActiveTab('compliance');
    }
  }, [activeTab, complianceDecisionsEnabled, complianceDecisionsLoading]);

  // Guard the consolidated workspace: if we land on it without a chosen supplier
  // (e.g. restored from localStorage), send the user back to Frameworks.
  useEffect(() => {
    if (activeTab === 'supplier-compliance' && !complianceSupplier) {
      setActiveTab(requirementEngineEnabled ? 'frameworks' : 'compliance');
    }
    if (activeTab === 'supplier-detail' && !detailSupplier) {
      setActiveTab('suppliers');
    }
  }, [activeTab, complianceSupplier, detailSupplier, requirementEngineEnabled]);
  
  // Get permissions to check if user is company owner
  const { isOwner, loading: permissionsLoading } = useCompanyPermissions(companyId, 'buyer');
  
  // Get unread message count for sidebar badge
  const { totalUnread } = useCommunicationThreads(companyId || '', 'buyer');
  
  // Reset activeTab if non-owner tries to access owner-only tabs
  useEffect(() => {
    // 'settings' is already owner-gated by the sidebar nav filter; guarding it
    // here too caused a redirect race on direct load.
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
        logger.debug('Refreshing profile for team member');
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
        logger.debug('Refreshing profile for company owner');
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
      let effectiveBuyerId: string | undefined = undefined;

      // If impersonating, use the impersonated buyer ID directly
      if (impersonatedBuyerId) {
        const { data: buyer } = await supabase
          .from('buyers')
          .select('*')
          .eq('id', impersonatedBuyerId)
          .single();
        
        setBuyerProfile(buyer);
        setCompanyId(impersonatedBuyerId);
        effectiveBuyerId = impersonatedBuyerId;
        // Continue to load stats (removed early return)

      } else if (!authUser) {
        return;
      } else {
        // Not impersonating - normal flow
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
            effectiveBuyerId = teamMember.company_id;
            
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
            effectiveBuyerId = buyer?.id;
          }
        } catch (error) {
          console.error('Error in fetchDashboardData:', error);
          return;
        }
      }

      // Load dashboard stats with effectiveBuyerId

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
    };

    fetchDashboardData();
  }, [authUser, currentBranch?.id, allBranchesView, impersonatedBuyerId]);

  const handleFindSuppliersClick = () => {
    logger.debug('Find Suppliers button clicked, switching to suppliers tab');
    setActiveTab('suppliers');
  };

  const handleLogoutClick = async () => {
    try {
      logger.debug('Buyer dashboard logout clicked');
      await onLogout();
    } catch (error) {
      console.error('Error in buyer dashboard logout:', error);
    }
  };

  const handleCreateRequest = (request: any) => {
    logger.debug('Request created');
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
        requirementEngineEnabled={requirementEngineEnabled}
        complianceDecisionsEnabled={complianceDecisionsEnabled}
        dossiersEnabled={dossiersEnabled}
        emailReplyIngestionEnabled={emailReplyIngestionEnabled}
      >
        {/* Dashboard Content */}
        {activeTab === 'dashboard' && companyId && (
          getWorkspaceProfileForIndustry(buyerProfile?.industry).id === 'auditor' ? (
            <div className="animate-fade-in p-6 h-[calc(100vh-80px)] overflow-y-auto">
              <AuditorDashboardPanel 
                buyerId={companyId} 
                onNavigateToTab={setActiveTab} 
              />
            </div>
          ) : dashboardView === 'overview' ? (
            <BuyerOverviewDashboard
              stats={dashboardStats}
              onTabChange={setActiveTab}
              onNewRequest={() => setShowRequestForm(true)}
              onAddSupplier={() => setShowBulkInvite(true)}
            />
          ) : (
            <div className="h-[calc(100vh-120px)] overflow-hidden flex flex-col animate-fade-in">
              {/* Top Metrics Bar - Fixed Height */}
            <motion.div 
              className="flex-shrink-0 mb-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="grid grid-cols-5 gap-3">
                <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" onClick={() => setActiveTab('suppliers')}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{getWorkspaceProfileForIndustry(buyerProfile?.industry).terms.suppliers}</p>
                      <p className="text-2xl font-bold text-foreground">{dashboardStats.connectedSuppliers}</p>
                      <p className="text-[11px] text-muted-foreground/70">Total suppliers</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" onClick={() => {
                  sessionStorage.setItem('buyer_docs_filter_status', 'pending');
                  setDocumentsKey(prev => prev + 1);
                  setActiveTab('documents');
                }}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10">
                      <Users className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Active</p>
                      <p className="text-2xl font-bold text-foreground">{dashboardStats.activeRequests}</p>
                      <p className="text-[11px] text-muted-foreground/70">Active suppliers</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" onClick={() => {
                  sessionStorage.setItem('buyer_docs_filter_status', 'submitted');
                  setDocumentsKey(prev => prev + 1);
                  setActiveTab('documents');
                }}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-teal-500/10">
                      <Clock className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Pending Review</p>
                      <p className="text-2xl font-bold text-foreground">{dashboardStats.pendingReview}</p>
                      <p className="text-[11px] text-muted-foreground/70">Under review</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" onClick={() => {
                  sessionStorage.setItem('buyer_docs_filter_expiration', 'expiring_soon');
                  setDocumentsKey(prev => prev + 1);
                  setActiveTab('documents');
                }}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-red-500/10">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Expiring</p>
                      <p className="text-2xl font-bold text-foreground">{dashboardStats.expiringSoon}</p>
                      <p className="text-[11px] text-muted-foreground/70">Within 60 days</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-4">
                  <div className="flex items-center justify-between h-full">
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground">Compliance Score</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">Overall compliance</p>
                    </div>
                    <ComplianceRing 
                      score={dashboardStats.totalDocs > 0 
                        ? Math.round((dashboardStats.approvedDocs / dashboardStats.totalDocs) * 100) 
                        : 0
                      }
                      size={60}
                      strokeWidth={6}
                    />
                  </div>
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
                  industry={buyerProfile?.industry}
                />

              </motion.div>
            </div>
          </div>
          )
        )}

        {/* Compliance home — a single page. Command Center (action-first, computed
            chain) is the home for orgs on the decisions engine; the legacy Workbench
            remains only as an ungated fallback so nothing breaks without it. */}
        {activeTab === 'compliance' && (
          companyId && complianceDecisionsEnabled
            ? <CommandCenterView buyerId={companyId} onNavigate={setActiveTab} />
            : <BuyerComplianceDashboard onNavigateToComplianceDecisions={() => setActiveTab('compliance-decisions')} />
        )}

        {activeTab === 'requirements' && companyId && requirementEngineEnabled && (
          <RequirementEngineView
            buyerId={companyId}
            onNavigateToDocuments={(documentType) => {
              if (documentType) sessionStorage.setItem('buyer_docs_filter_document_type', documentType);
              setDocumentsKey(prev => prev + 1);
              setActiveTab('documents');
            }}
          />
        )}

        {activeTab === 'frameworks' && companyId && requirementEngineEnabled && (
          <FrameworkLibraryView buyerId={companyId} onOpenSupplier={openSupplierCompliance} />
        )}

        {activeTab === 'supplier-compliance' && companyId && complianceDecisionsEnabled && complianceSupplier && (
          <SupplierComplianceWorkspace
            buyerId={companyId}
            supplierId={complianceSupplier.id}
            supplierName={complianceSupplier.name}
            dossiersEnabled={dossiersEnabled}
            onBack={() => setActiveTab(requirementEngineEnabled ? 'frameworks' : 'compliance')}
          />
        )}

        {activeTab === 'compliance-decisions' && companyId && complianceDecisionsEnabled && (
          <ComplianceDecisionsView buyerId={companyId} />
        )}

        {activeTab === 'mapping-review' && companyId && complianceDecisionsEnabled && (
          <EvidenceMappingReviewQueue buyerId={companyId} />
        )}

        {activeTab === 'command-center' && companyId && complianceDecisionsEnabled && (
          <CommandCenterView buyerId={companyId} onNavigate={setActiveTab} />
        )}

        {activeTab === 'requirement-extractor' && companyId && requirementEngineEnabled && (
          <RequirementExtractorView buyerId={companyId} />
        )}

        {activeTab === 'compliance-qa' && companyId && complianceDecisionsEnabled && (
          <ComplianceQAView buyerId={companyId} />
        )}

        {activeTab === 'dossiers' && companyId && dossiersEnabled && (
          <DossierGeneratorView buyerId={companyId} />
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
          <BuyerDocumentsDashboard key={documentsKey} view="documents" />
        )}

        {/* Document Activity Content */}
        {activeTab === 'document-activity' && (
          <BuyerDocumentsDashboard key={documentsKey} view="activity" />
        )}

        {activeTab === 'email-intake' && companyId && (
          <InboundEmailReviewQueue buyerId={companyId} />
        )}

        {/* Auditor AI: side-by-side document comparison */}
        {activeTab === 'document-comparison' && companyId && (
          <AuditorDocumentComparisonView buyerId={companyId} />
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

        {/* Item Compliance Content — static demo dataset */}
        {activeTab === 'item-compliance' && companyId && (
          <ItemComplianceDemo />
        )}

        {/* Facility Matrix Content — static demo dataset */}
        {activeTab === 'facility-matrix' && (
          <FacilityMatrixDemo />
        )}

        {/* Supplier Risk Assessment */}
        {activeTab === 'supplier-risk' && (
          <SupplierRiskAssessment buyerId={companyId} />
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

        {/* COA Analysis */}
        {activeTab === 'coa-analysis' && (
          <COADashboard />
        )}

        {/* Corporate Documents (relocated from Compliance > Overview's old internal tabs) */}
        {activeTab === 'corporate-documents' && companyId && (
          <BuyerCorporateDocuments buyerId={companyId} />
        )}

        {/* Communication Log (relocated from Compliance > Overview's old internal tabs) */}
        {activeTab === 'communication-log' && companyId && (
          <ExpiryNotificationLog buyerId={companyId} />
        )}

        {/* Suppliers Content */}
        {activeTab === 'suppliers' && (
          <div className="space-y-6">
            <SupplierDiscovery
              onOpenCompliance={complianceDecisionsEnabled ? openSupplierCompliance : undefined}
              onViewSupplier={openSupplierDetail}
            />
          </div>
        )}

        {/* Full-page supplier detail + report */}
        {activeTab === 'supplier-detail' && companyId && detailSupplier && (
          <SupplierDetailPage
            buyerId={companyId}
            supplierId={detailSupplier.id}
            supplierName={detailSupplier.name}
            onBack={() => setActiveTab('suppliers')}
            onOpenCompliance={complianceDecisionsEnabled ? openSupplierCompliance : undefined}
          />
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

        {/* Settings — full page (Settings-04 style), replaces the old modal on the buyer side */}
        {activeTab === 'settings' && (
          <SettingsWorkspace
            companyId={companyId}
            companyType="buyer"
            companyName={buyerProfile?.company_name || 'Your Company'}
          />
        )}

        {/* Modals */}
      <NewRequestModal
        isOpen={showRequestForm}
        onClose={() => setShowRequestForm(false)}
        onCreateRequest={handleCreateRequest}
        userType="buyer"
        currentBranch={currentBranch}
      />

      <UnifiedSettingsModal
        open={showSettings}
        onOpenChange={(open) => {
          setShowSettings(open);
          if (!open) refreshBuyerProfile();
        }}
        companyId={companyId}
        companyType="buyer"
        companyName={buyerProfile?.company_name || 'Your Company'}
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
