import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileCheck, 
  Upload, 
  Calendar,
  Bell,
  Download,
  Plus,
  Settings,
  Users,
  Building2
} from 'lucide-react';
import RoleSwitcher from '@/components/RoleSwitcher';
import SupplierProfileSetup from '@/components/supplier/SupplierProfileSetup';
import ConnectionRequests from '@/components/supplier/ConnectionRequests';
import ConnectedBuyersTab from '@/components/supplier/ConnectedBuyersTab';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySetup } from '@/hooks/useCompanySetup';
import { supabase } from '@/integrations/supabase/client';

interface SupplierDashboardProps {
  user: { 
    roles: ('buyer' | 'supplier')[];
    name: string;
    currentRole: 'buyer' | 'supplier';
  };
  onLogout: () => void;
  onRoleSwitch: (role: 'buyer' | 'supplier') => void;
}

const SupplierDashboard = ({ user, onLogout, onRoleSwitch }: SupplierDashboardProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [supplierProfile, setSupplierProfile] = useState<any>(null);
  const [documentRequests, setDocumentRequests] = useState<any[]>([]);
  const [connectedBuyers, setConnectedBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  const { user: authUser } = useAuth();
  const { getSupplierProfile } = useCompanySetup();

  // Calculate stats from real data
  const stats = {
    pendingRequests: documentRequests.filter(req => req.status === 'pending').length,
    documentsSubmitted: documentRequests.filter(req => req.status === 'submitted').length,
    approvedDocuments: documentRequests.filter(req => req.status === 'approved').length,
    expiringDocuments: 0 // This would need a separate query for expiring documents
  };

  const completionRate = documentRequests.length > 0 
    ? Math.round((stats.approvedDocuments / documentRequests.length) * 100) 
    : 0;

  useEffect(() => {
    if (authUser) {
      loadSupplierData();
    }
  }, [authUser]);

  const loadSupplierData = async () => {
    setLoading(true);
    try {
      // Load supplier profile
      const profile = await getSupplierProfile();
      setSupplierProfile(profile);

      if (profile) {
        // Load document requests for this supplier
        const { data: requests, error: requestsError } = await supabase
          .from('document_requests')
          .select('*')
          .eq('supplier_id', profile.id)
          .order('created_at', { ascending: false });

        if (requestsError) {
          console.error('Error loading document requests:', requestsError);
        } else {
          setDocumentRequests(requests || []);
        }

        // Load connected buyers
        const { data: connections, error: connectionsError } = await supabase
          .from('buyer_supplier_connections')
          .select(`
            *,
            buyers (
              id,
              company_name,
              industry,
              contact_email,
              phone,
              address
            )
          `)
          .eq('supplier_id', profile.id)
          .eq('status', 'approved');

        if (connectionsError) {
          console.error('Error loading buyer connections:', connectionsError);
        } else {
          setConnectedBuyers(connections || []);
        }
      }
    } catch (error) {
      console.error('Error loading supplier data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdated = () => {
    loadSupplierData();
    setShowSettings(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'submitted': return <FileCheck className="w-4 h-4" />;
      case 'rejected': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (showSettings) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <Button variant="ghost" onClick={() => setShowSettings(false)}>
                  ← Back to Dashboard
                </Button>
                <h1 className="text-xl font-bold text-gray-900">Company Settings</h1>
              </div>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <SupplierProfileSetup onProfileCreated={handleProfileUpdated} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">ComplianceFlow</h1>
              <Badge variant="secondary" className="bg-green-100 text-green-800">Supplier Portal</Badge>
            </div>
            <div className="flex items-center space-x-4">
              {user.roles.length > 1 && (
                <RoleSwitcher 
                  currentRole={user.currentRole}
                  onRoleChange={onRoleSwitch}
                />
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Company Settings
              </Button>
              <NotificationCenter />
              <span className="text-sm text-gray-600">Welcome, {user.name}</span>
              <Button variant="outline" size="sm" onClick={onLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Company Info Banner */}
        {supplierProfile && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{supplierProfile.company_name}</h2>
                    <p className="text-gray-600">{supplierProfile.industry}</p>
                    <p className="text-sm text-gray-500">{supplierProfile.contact_email}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setShowSettings(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingRequests}</div>
              <p className="text-xs text-muted-foreground">Awaiting submission</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completionRate}%</div>
              <Progress value={completionRate} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documents Submitted</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.documentsSubmitted}</div>
              <p className="text-xs text-muted-foreground">Total submitted</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connected Buyers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{connectedBuyers.length}</div>
              <p className="text-xs text-muted-foreground">Active connections</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="connections">Connection Requests</TabsTrigger>
            <TabsTrigger value="requests">Document Requests</TabsTrigger>
            <TabsTrigger value="buyers">Connected Buyers</TabsTrigger>
            <TabsTrigger value="documents">My Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Requests */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Document Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  {documentRequests.length > 0 ? (
                    <div className="space-y-4">
                      {documentRequests.slice(0, 3).map(request => (
                        <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <div>
                              <p className="font-medium">{request.title}</p>
                              <p className="text-sm text-gray-500">{request.document_type}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getPriorityColor(request.priority || 'medium')} variant="secondary">
                              {request.priority || 'medium'}
                            </Badge>
                            <Badge className={getStatusColor(request.status)} variant="secondary">
                              {getStatusIcon(request.status)}
                              <span className="ml-1 capitalize">{request.status}</span>
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">No document requests yet</p>
                  )}
                  <Button variant="outline" className="w-full mt-4" onClick={() => setActiveTab('requests')}>
                    View All Requests
                  </Button>
                </CardContent>
              </Card>

              {/* Connected Buyers */}
              <Card>
                <CardHeader>
                  <CardTitle>Connected Buyers</CardTitle>
                </CardHeader>
                <CardContent>
                  {connectedBuyers.length > 0 ? (
                    <div className="space-y-4">
                      {connectedBuyers.slice(0, 3).map((connection) => (
                        <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Users className="w-5 h-5 text-blue-500" />
                            <div>
                              <p className="font-medium">{connection.buyers?.company_name}</p>
                              <p className="text-sm text-gray-500">{connection.buyers?.industry}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-green-600">
                            Connected
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">No connected buyers yet</p>
                  )}
                  <Button variant="outline" className="w-full mt-4" onClick={() => setActiveTab('buyers')}>
                    View All Buyers
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="connections" className="space-y-6">
            <ConnectionRequests />
          </TabsContent>

          <TabsContent value="requests" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Document Requests</CardTitle>
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </CardHeader>
              <CardContent>
                {documentRequests.length > 0 ? (
                  <div className="space-y-4">
                    {documentRequests.map(request => (
                      <div key={request.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                              <FileCheck className="w-6 h-6 text-gray-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{request.title}</h3>
                              <p className="text-sm text-gray-500">Type: {request.document_type}</p>
                              <p className="text-sm text-gray-500">Due: {request.due_date || 'No due date'}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <Badge className={getPriorityColor(request.priority || 'medium')} variant="secondary">
                              {request.priority || 'medium'} priority
                            </Badge>
                            <Badge className={getStatusColor(request.status)} variant="secondary">
                              {getStatusIcon(request.status)}
                              <span className="ml-1 capitalize">{request.status}</span>
                            </Badge>
                            <Button variant="outline" size="sm">
                              {request.status === 'pending' ? 'Upload' : 'View Details'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Document Requests</h3>
                    <p className="text-gray-500">You don't have any document requests yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buyers">
            <ConnectedBuyersTab connectedBuyers={connectedBuyers} />
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Document Library</CardTitle>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Document
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Document Management</h3>
                  <p className="text-gray-500 mb-6">Upload, organize, and manage your compliance documents</p>
                  <Button>Upload New Document</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SupplierDashboard;
