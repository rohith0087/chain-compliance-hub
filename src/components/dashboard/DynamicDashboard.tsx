
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, LogOut, FileText, Upload, Clock, CheckCircle, 
  AlertTriangle, Plus, Building2, ShoppingCart 
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import DocumentRequestForm from '@/components/requests/DocumentRequestForm';
import RequestsList from '@/components/requests/RequestsList';
import FileUploadZone from '@/components/uploads/FileUploadZone';
import BuyerDashboard from '@/components/BuyerDashboard';
import SupplierDashboard from '@/components/SupplierDashboard';
import RoleSwitcher from '@/components/RoleSwitcher';
import { supabase } from '@/integrations/supabase/client';

const DynamicDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [currentRole, setCurrentRole] = useState<'buyer' | 'supplier'>('supplier');
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    totalUploads: 0,
  });

  useEffect(() => {
    if (!user || !profile) return;

    // Set initial role based on available roles
    if (profile.roles?.includes('buyer')) {
      setCurrentRole('buyer');
    } else if (profile.roles?.includes('supplier')) {
      setCurrentRole('supplier');
    }

    const fetchStats = async () => {
      try {
        // Fetch request stats with proper error handling
        const { data: requests, error: requestsError } = await supabase
          .from('document_requests')
          .select('status')
          .or(`requester_id.eq.${user.id},supplier_id.eq.${user.id}`);

        if (requestsError) {
          console.error('Error fetching requests:', requestsError);
        }

        // Fetch upload stats
        const { data: uploads, error: uploadsError } = await supabase
          .from('document_uploads')
          .select('id')
          .eq('uploader_id', user.id);

        if (uploadsError) {
          console.error('Error fetching uploads:', uploadsError);
        }

        if (requests) {
          setStats({
            totalRequests: requests.length,
            pendingRequests: requests.filter(r => r.status === 'pending').length,
            approvedRequests: requests.filter(r => r.status === 'approved').length,
            totalUploads: uploads?.length || 0,
          });
        }
      } catch (error) {
        console.error('Error in fetchStats:', error);
      }
    };

    fetchStats();
  }, [user, profile]);

  const handleRoleSwitch = (role: 'buyer' | 'supplier') => {
    setCurrentRole(role);
  };

  const handleLogout = () => {
    signOut();
  };

  if (!user || !profile) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const isBuyer = profile?.roles?.includes('buyer');
  const isSupplier = profile?.roles?.includes('supplier');
  const availableRoles = profile?.roles || [];

  // If user has multiple roles, show role-specific dashboard
  if (availableRoles.length > 1 || currentRole === 'buyer') {
    if (currentRole === 'buyer') {
      return (
        <BuyerDashboard
          user={{
            roles: availableRoles,
            name: profile.full_name,
            currentRole: currentRole
          }}
          onLogout={handleLogout}
          onRoleSwitch={handleRoleSwitch}
        />
      );
    } else {
      return (
        <SupplierDashboard
          user={{
            roles: availableRoles,
            name: profile.full_name,
            currentRole: currentRole
          }}
          onLogout={handleLogout}
          onRoleSwitch={handleRoleSwitch}
        />
      );
    }
  }

  // Default unified dashboard for single-role users
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">ComplianceFlow</h1>
                <p className="text-sm text-gray-500">Welcome, {profile?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationCenter />
              <RoleSwitcher
                currentRole={currentRole}
                availableRoles={availableRoles}
                onRoleSwitch={handleRoleSwitch}
              />
              <div className="flex items-center space-x-2">
                {isBuyer && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" />
                    Buyer
                  </Badge>
                )}
                {isSupplier && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Supplier
                  </Badge>
                )}
              </div>
              <Button onClick={signOut} variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRequests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pendingRequests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approvedRequests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Uploads</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUploads}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Document Requests</CardTitle>
                  {isBuyer && (
                    <Button onClick={() => setShowRequestForm(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      New Request
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <RequestsList />
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Quick Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <FileUploadZone />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* New Request Modal */}
      {showRequestForm && (
        <DocumentRequestForm
          isOpen={showRequestForm}
          onClose={() => setShowRequestForm(false)}
        />
      )}
    </div>
  );
};

export default DynamicDashboard;
