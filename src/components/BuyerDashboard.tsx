
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import RequestsList from '@/components/requests/RequestsList';
import SupplierDiscovery from '@/components/buyer/SupplierDiscovery';
import NewRequestModal from '@/components/NewRequestModal';
import BuyerComplianceDashboard from '@/components/dashboard/BuyerComplianceDashboard';
import { Building2, Users, ListChecks, Plus, BarChart3, FileCheck, UserCheck, Settings, Calendar, AlertTriangle, Clock } from 'lucide-react';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import BuyerDocumentsDashboard from '@/components/documents/BuyerDocumentsDashboard';
import { BuyerIdCard } from '@/components/buyer/BuyerIdCard';
import BuyerConnectionRequests from '@/components/buyer/BuyerConnectionRequests';
import { BuyerSettingsModal } from '@/components/settings/BuyerSettingsModal';
import { CompanyManagementDashboard } from '@/components/company/CompanyManagementDashboard';
import { BranchSelector } from '@/components/company/BranchSelector';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const { user: authUser, profile } = useAuth();
  const { t } = useTranslation(['dashboard', 'common']);

  // Company branches management
  const {
    branches,
    currentBranch,
    switchBranch,
    loading: branchesLoading
  } = useCompanyBranches(buyerProfile?.id, 'buyer');

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

          const { data: deadlines, error: deadlineError } = await supabase
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
            .lte('due_date', thirtyDaysFromNow.toISOString().split('T')[0])
            .order('due_date', { ascending: true })
            .limit(5);

          if (deadlineError) {
            console.error('Error fetching deadlines:', deadlineError);
          } else {
            setUpcomingDeadlines(deadlines || []);
          }

          // Fetch action items - pending requests, overdue items, etc.
          const { data: pendingRequests, error: pendingError } = await supabase
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
            .in('status', ['pending', 'submitted'])
            .order('created_at', { ascending: false })
            .limit(5);

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
  }, [authUser]);

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
    <div className="container mx-auto py-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-semibold">{t('dashboard:buyer.title')}</h1>
          {branches.length > 1 && (
            <BranchSelector
              branches={branches}
              currentBranch={currentBranch}
              onBranchChange={switchBranch}
              loading={branchesLoading}
            />
          )}
        </div>
        <div className="space-x-4 flex items-center">
          <NotificationCenter />
          <Button 
            onClick={() => setShowSettings(true)}
            variant="outline"
            size="sm"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          {profile?.roles?.includes('supplier') && (
            <Button variant="outline" size="sm" onClick={() => onRoleSwitch('supplier')}>
              {t('common:navigation.switchTo', { role: 'supplier' })}
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={handleLogoutClick}>
            {t('common:navigation.logout')}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">
            <Building2 className="w-4 h-4 mr-2" />
            {t('common:navigation.dashboard')}
          </TabsTrigger>
          <TabsTrigger value="compliance">
            <BarChart3 className="w-4 h-4 mr-2" />
            {t('common:navigation.compliance')}
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileCheck className="w-4 h-4 mr-2" />
            {t('common:navigation.documents')}
          </TabsTrigger>
          <TabsTrigger value="requests">
            <ListChecks className="w-4 h-4 mr-2" />
            {t('common:navigation.requests')}
          </TabsTrigger>
          <TabsTrigger value="connections">
            <UserCheck className="w-4 h-4 mr-2" />
            Connection Requests
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            <Users className="w-4 h-4 mr-2" />
            {t('common:navigation.suppliers')}
          </TabsTrigger>
          <TabsTrigger value="company">
            <Building2 className="w-4 h-4 mr-2" />
            Company Management
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="space-y-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{t('dashboard:buyer.welcome', { name: user.name })}</CardTitle>
                    <p className="text-gray-600">
                      {t('dashboard:buyer.description')}
                    </p>
                  </div>
                  <Button onClick={() => setShowRequestForm(true)} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    {t('dashboard:buyer.newRequest')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleFindSuppliersClick}>
                    <CardContent className="p-4 text-center">
                      <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                      <h3 className="font-medium">{t('dashboard:buyer.findSuppliers')}</h3>
                      <p className="text-sm text-gray-600">{t('dashboard:buyer.connectSuppliers')}</p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('requests')}>
                    <CardContent className="p-4 text-center">
                      <ListChecks className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <h3 className="font-medium">{t('dashboard:buyer.myRequests')}</h3>
                      <p className="text-sm text-gray-600">{t('dashboard:buyer.trackRequests')}</p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowRequestForm(true)}>
                    <CardContent className="p-4 text-center">
                      <Plus className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                      <h3 className="font-medium">{t('dashboard:buyer.newRequest')}</h3>
                      <p className="text-sm text-gray-600">{t('dashboard:buyer.requestDocuments')}</p>
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
                    <Calendar className="w-5 h-5 text-blue-500" />
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
                              <div className={`text-xs font-medium ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
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
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            ) : (
                              <Clock className="w-4 h-4 text-orange-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.title}</p>
                            <p className="text-xs text-muted-foreground mb-1">
                              {item.suppliers?.company_name}
                            </p>
                            <p className={`text-xs ${item.actionType === 'overdue' ? 'text-red-600' : 'text-orange-600'}`}>
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

            {/* Show the connect with suppliers message if no connections */}
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t('dashboard:buyer.connectFirst.title')}</h3>
                <p className="text-gray-600 mb-4">
                  {t('dashboard:buyer.connectFirst.description')}
                </p>
                <Button onClick={handleFindSuppliersClick} className="flex items-center gap-2 mx-auto">
                  <Users className="w-4 h-4" />
                  {t('dashboard:buyer.findSuppliers')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="compliance" className="space-y-2">
          <BuyerComplianceDashboard />
        </TabsContent>

        <TabsContent value="documents" className="space-y-2">
          <BuyerDocumentsDashboard />
        </TabsContent>
        
        <TabsContent value="requests" className="space-y-2">
          <RequestsList />
        </TabsContent>
        
        <TabsContent value="connections" className="space-y-2">
          <BuyerConnectionRequests />
        </TabsContent>
        
        <TabsContent value="suppliers" className="space-y-2">
          <SupplierDiscovery />
        </TabsContent>
        
        <TabsContent value="company" className="space-y-2">
          {buyerProfile && (
            <CompanyManagementDashboard
              companyId={buyerProfile.id}
              companyType="buyer"
              companyName={buyerProfile.company_name}
            />
          )}
        </TabsContent>
      </Tabs>

      <NewRequestModal 
        isOpen={showRequestForm} 
        onClose={() => setShowRequestForm(false)}
        onCreateRequest={handleCreateRequest}
        userType={profile?.industry || 'General Business'}
      />

      <BuyerSettingsModal 
        open={showSettings} 
        onOpenChange={setShowSettings}
      />
    </div>
  );
};

export default BuyerDashboard;
