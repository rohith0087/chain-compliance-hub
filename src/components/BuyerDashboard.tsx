import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import RequestsList from '@/components/requests/RequestsList';
import SupplierDiscovery from '@/components/buyer/SupplierDiscovery';
import NewRequestModal from '@/components/NewRequestModal';
import BuyerComplianceDashboard from '@/components/dashboard/BuyerComplianceDashboard';
import { Building2, Users, ListChecks, Plus, BarChart3, FileCheck, UserCheck, Settings, Calendar, AlertTriangle, Clock, MessageSquare, Compass, FileText, Send } from 'lucide-react';
import AgentManagementDashboard from '@/components/agents/AgentManagementDashboard';
import BuyerDocumentsDashboard from '@/components/documents/BuyerDocumentsDashboard';
import { BuyerIdCard } from '@/components/buyer/BuyerIdCard';
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

        // Fetch buyer profile
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

        if (buyer) {
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
            .eq('buyer_id', buyer.id)
            .not('due_date', 'is', null)
            .gte('due_date', new Date().toISOString().split('T')[0])
            .lte('due_date', thirtyDaysFromNow.toISOString().split('T')[0]);

          // Filter by branch if not viewing all branches
          if (!allBranchesView && currentBranch) {
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
            .eq('buyer_id', buyer.id)
            .in('status', ['pending', 'submitted']);

          // Filter by branch if not viewing all branches
          if (!allBranchesView && currentBranch) {
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
      >
        {/* Dashboard Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{t('dashboard:buyer.welcome', { name: user.name })}</CardTitle>
                    <p className="text-muted-foreground">
                      {t('dashboard:buyer.description')}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <Card className="group cursor-pointer hover:shadow-elegant transition-all duration-300 hover:scale-105 border-0 bg-gradient-card">
                    <CardContent className="p-6 text-center" onClick={handleFindSuppliersClick}>
                      <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-200">
                        <Users className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{t('dashboard:buyer.findSuppliers')}</h3>
                      <p className="text-sm text-muted-foreground">{t('dashboard:buyer.connectSuppliers')}</p>
                    </CardContent>
                  </Card>
                  <Card className="group cursor-pointer hover:shadow-elegant transition-all duration-300 hover:scale-105 border-0 bg-gradient-card">
                    <CardContent className="p-6 text-center" onClick={() => setActiveTab('requests')}>
                      <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors duration-200">
                        <ListChecks className="w-8 h-8 text-accent" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{t('dashboard:buyer.myRequests')}</h3>
                      <p className="text-sm text-muted-foreground">{t('dashboard:buyer.trackRequests')}</p>
                    </CardContent>
                  </Card>
                  <Card className="group cursor-pointer hover:shadow-elegant transition-all duration-300 hover:scale-105 border-0 bg-gradient-card">
                    <CardContent className="p-6 text-center" onClick={() => navigate('/chat')}>
                      <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors duration-200">
                        <Compass className="w-8 h-8 text-secondary-foreground" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">Compliance Compass</h3>
                      <p className="text-sm text-muted-foreground">AI-powered compliance guidance</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Show Buyer ID Card if available */}
            {buyerProfile?.buyer_id_number && profile && (
              <BuyerIdCard 
                buyerId={buyerProfile.buyer_id_number}
                buyerProfile={buyerProfile}
                userProfile={{ full_name: profile.full_name }}
              />
            )}

            {/* Upcoming Deadlines and Action Items */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Upcoming Deadlines */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Upcoming Deadlines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardLoading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : upcomingDeadlines.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingDeadlines.map((deadline) => {
                        const daysUntilDue = Math.ceil((new Date(deadline.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        const isUrgent = daysUntilDue <= 3;
                        
                        return (
                          <div key={deadline.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{deadline.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {deadline.suppliers?.company_name}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`text-xs font-medium ${isUrgent ? 'text-destructive' : 'text-orange-600'}`}>
                                {daysUntilDue === 0 ? 'Due Today' : 
                                 daysUntilDue === 1 ? 'Due Tomorrow' : 
                                 `${daysUntilDue} days`}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(deadline.due_date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => setActiveTab('requests')}
                      >
                        View All Requests
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Action Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardLoading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : actionItems.length > 0 ? (
                    <div className="space-y-3">
                      {actionItems.map((item) => (
                        <div key={item.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="mt-1">
                            {item.actionType === 'overdue' ? (
                              <AlertTriangle className="w-4 h-4 text-destructive" />
                            ) : (
                              <Clock className="w-4 h-4 text-orange-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.title}</p>
                            <p className="text-xs text-muted-foreground mb-1">
                              {item.suppliers?.company_name}
                            </p>
                            <p className={`text-xs ${item.actionType === 'overdue' ? 'text-destructive' : 'text-orange-600'}`}>
                              {item.actionText}
                            </p>
                          </div>
                        </div>
                      ))}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => setActiveTab('requests')}
                      >
                        View All Requests
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No action items</p>
                    </div>
                  )}
                </CardContent>
              </Card>
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
          <BuyerDocumentsDashboard />
        )}

        {/* Templates Content */}
        {activeTab === 'templates' && (
          <CustomTemplateManager />
        )}

        {/* Suppliers Content */}
        {activeTab === 'suppliers' && (
          <SupplierDiscovery />
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
        {activeTab === 'company' && buyerProfile && (
          <CompanyManagementDashboard 
            companyId={buyerProfile.id}
            companyType="buyer"
            companyName={buyerProfile.company_name || 'Company'}
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