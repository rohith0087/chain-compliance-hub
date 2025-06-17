
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from '@/hooks/useAuth';
import RequestsList from '@/components/requests/RequestsList';
import SupplierDiscovery from '@/components/buyer/SupplierDiscovery';
import FileUploadZone from '@/components/uploads/FileUploadZone';
import { Building2, Users, FileUp, ListChecks } from 'lucide-react';
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
  const { profile } = useAuth();

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Welcome, {user.name}!</CardTitle>
                <p className="text-gray-600">
                  As a buyer, you can discover new suppliers, manage requests, and upload files.
                </p>
              </CardHeader>
              <CardContent>
                <p>
                  Explore the available tabs to get started.
                </p>
              </CardContent>
            </Card>
          </div>
        );
      case 'requests':
        return <RequestsList />;
      case 'suppliers':
        return <SupplierDiscovery />;
      case 'uploads':
        return <FileUploadZone />;
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
            Requests
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            <Users className="w-4 h-4 mr-2" />
            Suppliers
          </TabsTrigger>
          <TabsTrigger value="uploads">
            <FileUp className="w-4 h-4 mr-2" />
            Uploads
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
        <TabsContent value="uploads" className="space-y-2">
          {renderContent()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BuyerDashboard;
