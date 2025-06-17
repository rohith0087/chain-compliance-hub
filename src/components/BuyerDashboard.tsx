
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from '@/hooks/useAuth';
import RequestsList from '@/components/requests/RequestsList';
import SupplierDiscovery from '@/components/buyer/SupplierDiscovery';
import DocumentRequestForm from '@/components/requests/DocumentRequestForm';
import BuyerComplianceDashboard from '@/components/dashboard/BuyerComplianceDashboard';
import { Building2, Users, ListChecks, Plus, BarChart3, FileCheck } from 'lucide-react';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import BuyerDocumentsDashboard from '@/components/documents/BuyerDocumentsDashboard';

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
          <Button variant="destructive" size="sm" onClick={handleLogoutClick}>
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
          <TabsTrigger value="compliance">
            <BarChart3 className="w-4 h-4 mr-2" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileCheck className="w-4 h-4 mr-2" />
            Documents
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
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleFindSuppliersClick}>
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

            {/* Show the connect with suppliers message if no connections */}
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Connect with Suppliers First</h3>
                <p className="text-gray-600 mb-4">
                  Before you can request documents, you need to connect with suppliers. Browse and connect with suppliers to start requesting compliance documents.
                </p>
                <Button onClick={handleFindSuppliersClick} className="flex items-center gap-2 mx-auto">
                  <Users className="w-4 h-4" />
                  Find Suppliers
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

      <DocumentRequestForm 
        isOpen={showRequestForm} 
        onClose={() => setShowRequestForm(false)} 
      />
    </div>
  );
};

export default BuyerDashboard;
