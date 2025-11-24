import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import RequestsList from '@/components/requests/RequestsList';
import SupplierDiscovery from '@/components/buyer/SupplierDiscovery';
import NewRequestModal from '@/components/NewRequestModal';
import BuyerComplianceDashboard from '@/components/dashboard/BuyerComplianceDashboard';
import { Building2, Users, ListChecks, Plus, BarChart3, FileCheck, UserCheck, Settings, Calendar, AlertTriangle, Clock, MessageSquare, Compass, FileText, Send, CheckCircle, TrendingUp, MapPin } from 'lucide-react';
import AgentManagementDashboard from '@/components/agents/AgentManagementDashboard';
import BuyerDocumentsDashboard from '@/components/documents/BuyerDocumentsDashboard';
import BuyerConnectionRequests from '@/components/buyer/BuyerConnectionRequests';
import { BuyerSettingsModal } from '@/components/settings/BuyerSettingsModal';
import { CompanyManagementDashboard } from '@/components/company/CompanyManagementDashboard';
import ChatAgentPanel from '@/components/chat/ChatAgentPanel';
import CustomTemplateManager from '@/components/buyer/CustomTemplateManager';
import { QuickOnboardingModal } from '@/components/buyer/QuickOnboardingModal';
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
import { MyAssignments } from '@/components/shared/MyAssignments';
import { StatCard } from '@/components/ui/stat-card';
import { StatCardSkeleton, TimelineItemSkeleton } from '@/components/ui/skeleton-card';
import { UrgencyBadge, PriorityBadge } from '@/components/ui/priority-badge';
import { DocumentSetManager } from '@/components/buyer/DocumentSetManager';
import { BuyerSupplierFacilityMatrix } from '@/components/buyer/BuyerSupplierFacilityMatrix';
import { SupplierMap } from '@/components/buyer/SupplierMap';

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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickOnboarding, setShowQuickOnboarding] = useState(false);
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const { user: authUser, profile } = useAuth();
  const { t } = useTranslation(['dashboard', 'common']);
  const { currentBranch, allBranchesView } = useBranchContext();

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

  // Fetch buyer profile data and dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!authUser) return;

      try {
        setDashboardLoading(true);

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
          // User is a team member - use company_id from company_users
          console.log('User is team member, using company_id:', teamMember.company_id);
          setCompanyId(teamMember.company_id);
          setBuyerProfile(null); // No buyer profile for team members
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

          console.log('User is company owner, using buyer profile:', buyer?.id);
          setCompanyId(buyer?.id);
          setBuyerProfile(buyer);
        }

        const effectiveBuyerId = teamMember?.company_id || buyerProfile?.id;

        if (effectiveBuyerId) {
          // Fetch upcoming deadlines - requests with due dates in next 30 days
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

          let deadlinesQuery = supabase
            .from('document_requests')
            .select(`
              id,
              title,
              due_date,
              status,
              priority,
              suppliers (
                company_name
              )
            `)
            .eq('buyer_id', effectiveBuyerId)
            .not('due_date', 'is', null)
            .gte('due_date', new Date().toISOString().split('T')[0])
            .lte('due_date', thirtyDaysFromNow.toISOString().split('T')[0]);

          // Filter by branch if not viewing all branches
          if (currentBranch?.id && !allBranchesView) {
            deadlinesQuery = deadlinesQuery.eq('branch_id', currentBranch.id);
          }

          deadlinesQuery = deadlinesQuery.order('due_date', { ascending: true }).limit(5);

          const { data: deadlines, error: deadlineError } = await deadlinesQuery;

          if (deadlineError) {
            console.error('Error fetching deadlines:', deadlineError);
          } else {
            setUpcomingDeadlines(deadlines || []);
          }

          // Fetch action items - pending requests, overdue items, etc.
          let pendingQuery = supabase
            .from('document_requests')
            .select(`
              id,
              title,
              created_at,
              due_date,
              status,
              priority,
              suppliers (
                company_name
              )
            `)
            .eq('buyer_id', effectiveBuyerId)
            .in('status', ['pending', 'submitted']);

          // Filter by branch if not viewing all branches
          if (currentBranch?.id && !allBranchesView) {
            pendingQuery = pendingQuery.eq('branch_id', currentBranch.id);
          }

          pendingQuery = pendingQuery.order('created_at', { ascending: false }).limit(5);

          const { data: pendingRequests, error: pendingError } = await pendingQuery;

          if (pendingError) {
            console.error('Error fetching pending requests:', pendingError);
          } else {
            // Add action type to distinguish different types of action items
            const actionItemsData = (pendingRequests || []).map(req => {
              const isOverdue = req.due_date && new Date(req.due_date) < new Date();
              return {
                ...req,
                actionType: isOverdue ? 'overdue' : 'pending',
                actionText: isOverdue ? 'Overdue - Follow up required' : 'Awaiting supplier response'
              };
            });
            setActionItems(actionItemsData);
          }
        }
      } catch (error) {
        console.error('Error in fetchDashboardData:', error);
      } finally {
        setDashboardLoading(false);
      }
    };

    fetchDashboardData();
  }, [authUser, currentBranch, allBranchesView]);

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
        onShowQuickOnboarding={() => setShowQuickOnboarding(true)}
        onShowBulkInvite={() => setShowBulkInvite(true)}
        buyerProfile={buyerProfile}
        companyId={companyId}
      >
        {/* Dashboard Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fade-in">
            {/* Hero Section - Welcome */}
            <div className="relative overflow-hidden rounded-2xl bg-background/60 backdrop-blur-xl border border-primary/20 border-t-4 border-t-primary/40 p-8 shadow-lg">
              <div className="relative z-10">
                <h1 className="text-3xl font-bold mb-2 text-foreground">
                  {t('dashboard:buyer.welcome', { name: user.name })}
                </h1>
                <p className="text-muted-foreground text-lg">
                  {t('dashboard:buyer.description')}
                </p>
              </div>
              <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-48 -mt-48" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -ml-32 -mb-32" />
            </div>


            {/* Quick Actions */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="group cursor-pointer hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 border-0 bg-gradient-card relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary-hover" />
                <CardContent className="p-6 text-center" onClick={handleFindSuppliersClick}>
                  <div className="relative mb-4 inline-block">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 blur-xl group-hover:blur-2xl transition-all" />
                    <div className="relative h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-lg">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{t('dashboard:buyer.findSuppliers')}</h3>
                  <p className="text-sm text-muted-foreground">{t('dashboard:buyer.connectSuppliers')}</p>
                </CardContent>
              </Card>
              <Card className="group cursor-pointer hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 border-0 bg-gradient-card relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-accent/70" />
                <CardContent className="p-6 text-center" onClick={() => setActiveTab('requests')}>
                  <div className="relative mb-4 inline-block">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-accent/10 blur-xl group-hover:blur-2xl transition-all" />
                    <div className="relative h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-lg">
                      <ListChecks className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{t('dashboard:buyer.myRequests')}</h3>
                  <p className="text-sm text-muted-foreground">{t('dashboard:buyer.trackRequests')}</p>
                </CardContent>
              </Card>
              <Card className="group cursor-pointer hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 border-0 bg-gradient-card relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary to-secondary/70" />
                <CardContent className="p-6 text-center" onClick={() => navigate('/chat')}>
                  <div className="relative mb-4 inline-block">
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 to-secondary/10 blur-xl group-hover:blur-2xl transition-all" />
                    <div className="relative h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center shadow-lg">
                      <Compass className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Compliance Compass</h3>
                  <p className="text-sm text-muted-foreground">AI-powered compliance guidance</p>
                </CardContent>
              </Card>
            </div>


            {/* Activity & Timeline Section */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Upcoming Deadlines */}
              <Card className="border-0 bg-gradient-card">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    Upcoming Deadlines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardLoading ? (
                    <div className="space-y-3">
                      <TimelineItemSkeleton />
                      <TimelineItemSkeleton />
                      <TimelineItemSkeleton />
                    </div>
                  ) : upcomingDeadlines.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingDeadlines.map((deadline) => {
                        const daysUntilDue = Math.ceil((new Date(deadline.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        
                        return (
                          <div key={deadline.id} className="group flex items-start gap-3 p-4 bg-surface rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center flex-shrink-0">
                              <Calendar className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="font-medium text-sm mb-1">{deadline.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {deadline.suppliers?.company_name}
                                  </p>
                                </div>
                                <UrgencyBadge daysUntilDue={daysUntilDue} />
                              </div>
                              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {daysUntilDue === 0 ? 'Due Today' : 
                                   daysUntilDue === 1 ? 'Due Tomorrow' : 
                                   `${daysUntilDue} days`}
                                </span>
                                <span>{new Date(deadline.due_date).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-2 hover:bg-primary/10"
                        onClick={() => setActiveTab('requests')}
                      >
                        View All Requests
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
                        <Calendar className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium mb-1">No upcoming deadlines</p>
                      <p className="text-xs text-muted-foreground">You're all caught up!</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Items */}
              <Card className="border-0 bg-gradient-card">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-warning to-danger" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                    </div>
                    Action Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardLoading ? (
                    <div className="space-y-3">
                      <TimelineItemSkeleton />
                      <TimelineItemSkeleton />
                      <TimelineItemSkeleton />
                    </div>
                  ) : actionItems.length > 0 ? (
                    <div className="space-y-3">
                      {actionItems.map((item) => (
                        <div key={item.id} className="group flex items-start gap-3 p-4 bg-surface rounded-xl border border-border/50 hover:border-warning/30 hover:bg-warning/5 transition-all duration-300">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            item.actionType === 'overdue' 
                              ? 'bg-gradient-to-br from-danger/20 to-danger/10 animate-pulse' 
                              : 'bg-gradient-to-br from-warning/20 to-warning/10'
                          }`}>
                            {item.actionType === 'overdue' ? (
                              <AlertTriangle className="w-5 h-5 text-danger" />
                            ) : (
                              <Clock className="w-5 h-5 text-warning" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1">
                                <p className="font-medium text-sm mb-1">{item.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.suppliers?.company_name}
                                </p>
                              </div>
                              {item.priority && (
                                <PriorityBadge priority={item.priority} />
                              )}
                            </div>
                            <p className={`text-xs ${item.actionType === 'overdue' ? 'text-danger' : 'text-warning'}`}>
                              {item.actionText}
                            </p>
                          </div>
                        </div>
                      ))}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-2 hover:bg-warning/10"
                        onClick={() => setActiveTab('requests')}
                      >
                        View All Requests
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="w-8 h-8 text-success" />
                      </div>
                      <p className="text-sm font-medium mb-1">No action items</p>
                      <p className="text-xs text-muted-foreground">All tasks completed!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* My Assignments Widget */}
            {authUser && (
              <MyAssignments />
            )}

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
          <BuyerDocumentsDashboard />
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

      {buyerProfile && profile && (
        <>
          <QuickOnboardingModal
            isOpen={showQuickOnboarding}
            onClose={() => setShowQuickOnboarding(false)}
            buyerId={buyerProfile.id}
            buyerProfile={buyerProfile}
            userProfile={profile}
          />

          <BulkInviteModal
            isOpen={showBulkInvite}
            onClose={() => setShowBulkInvite(false)}
            buyerId={buyerProfile.id}
            buyerProfile={buyerProfile}
          />
        </>
      )}
    </BuyerSidebarLayout>
  </SidebarProvider>
  );
};

export default BuyerDashboard;