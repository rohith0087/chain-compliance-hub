
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from '@/hooks/useAuth';
import RequestsList from '@/components/requests/RequestsList';
import SupplierDiscovery from '@/components/buyer/SupplierDiscovery';
import DocumentRequestForm from '@/components/requests/DocumentRequestForm';
import { Building2, Users, ListChecks, Plus } from 'lucide-react';
import NotificationCenter from '@/components/notifications/NotificationCenter';

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
  const { profile } = useAuth();

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Welcome, {user.name}!</CardTitle>
                    <p className="text-gray-600">
                      As a buyer, you can discover suppliers and request compliance documents.
                    </p>
                  </div>
                  <Button onClick={() => setShowRequestForm(true)} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    New Request
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('suppliers')}>
                    <CardContent className="p-4 text-center">
                      <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                      <h3 className="font-medium">Find Suppliers</h3>
                      <p className="text-sm text-gray-600">Connect with suppliers</p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('requests')}>
                    <CardContent className="p-4 text-center">
                      <ListChecks className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <h3 className="font-medium">My Requests</h3>
                      <p className="text-sm text-gray-600">Track document requests</p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowRequestForm(true)}>
                    <CardContent className="p-4 text-center">
                      <Plus className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                      <h3 className="font-medium">New Request</h3>
                      <p className="text-sm text-gray-600">Request documents</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      case 'requests':
        return <RequestsList />;
      case 'suppliers':
        return <SupplierDiscovery />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Buyer Dashboard</h1>
        <div className="space-x-4 flex items-center">
          <NotificationCenter />
          {profile?.roles?.includes('supplier') && (
            <Button variant="outline" size="sm" onClick={() => onRoleSwitch('supplier')}>
              Switch to Supplier
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">
            <Building2 className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="requests">
            <ListChecks className="w-4 h-4 mr-2" />
            My Requests
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            <Users className="w-4 h-4 mr-2" />
            Suppliers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="space-y-2">
          {renderContent()}
        </TabsContent>
        <TabsContent value="requests" className="space-y-2">
          {renderContent()}
        </TabsContent>
        <TabsContent value="suppliers" className="space-y-2">
          {renderContent()}
        </TabsContent>
      </Tabs>

      <DocumentRequestForm 
        isOpen={showRequestForm} 
        onClose={() => setShowRequestForm(false)} 
      />
    </div>
  );
};

export default BuyerDashboard;
