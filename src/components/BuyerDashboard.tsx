
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
import { Building2, Users, ListChecks, Plus, BarChart3, FileCheck } from 'lucide-react';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import BuyerDocumentsDashboard from '@/components/documents/BuyerDocumentsDashboard';
import { BuyerIdCard } from '@/components/buyer/BuyerIdCard';
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
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const { user: authUser, profile } = useAuth();
  const { t } = useTranslation(['dashboard', 'common']);

  // Fetch buyer profile data
  useEffect(() => {
    const fetchBuyerProfile = async () => {
      if (!authUser) return;

      try {
        const { data: buyer, error } = await supabase
          .from('buyers')
          .select('*')
          .eq('profile_id', authUser.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching buyer profile:', error);
          return;
        }

        setBuyerProfile(buyer);
      } catch (error) {
        console.error('Error in fetchBuyerProfile:', error);
      }
    };

    fetchBuyerProfile();
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
        <h1 className="text-3xl font-semibold">{t('dashboard:buyer.title')}</h1>
        <div className="space-x-4 flex items-center">
          <NotificationCenter />
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
          <TabsTrigger value="suppliers">
            <Users className="w-4 h-4 mr-2" />
            {t('common:navigation.suppliers')}
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
            {buyerProfile?.buyer_id_number && (
              <BuyerIdCard buyerId={buyerProfile.buyer_id_number} />
            )}

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
        
        <TabsContent value="suppliers" className="space-y-2">
          <SupplierDiscovery />
        </TabsContent>
      </Tabs>

      <NewRequestModal 
        isOpen={showRequestForm} 
        onClose={() => setShowRequestForm(false)}
        onCreateRequest={handleCreateRequest}
        userType={profile?.industry || 'General Business'}
      />
    </div>
  );
};

export default BuyerDashboard;
