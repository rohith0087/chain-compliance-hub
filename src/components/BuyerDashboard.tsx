import { useState } from 'react';
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
  FileX, 
  Users, 
  TrendingUp,
  Bell,
  Download,
  Plus,
  Search,
  Building2,
  FileText
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import RoleSwitcher from '@/components/RoleSwitcher';
import NewRequestModal from '@/components/NewRequestModal';

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
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  // Mock data for demonstration
  const stats = {
    totalSuppliers: 24,
    compliantSuppliers: 18,
    pendingDocuments: 12,
    expiringDocuments: 5
  };

  const complianceRate = Math.round((stats.compliantSuppliers / stats.totalSuppliers) * 100);

  const suppliers = [
    { 
      id: 1, 
      name: 'FreshProduce Co.', 
      status: 'compliant', 
      documents: 8, 
      lastUpdate: '2 days ago',
      compliance: 95 
    },
    { 
      id: 2, 
      name: 'PackagingSolutions LLC', 
      status: 'pending', 
      documents: 5, 
      lastUpdate: '1 week ago',
      compliance: 75 
    },
    { 
      id: 3, 
      name: 'LogisticsCorp', 
      status: 'expiring', 
      documents: 6, 
      lastUpdate: '3 days ago',
      compliance: 60 
    },
    { 
      id: 4, 
      name: 'QualityMaterials Inc.', 
      status: 'non-compliant', 
      documents: 3, 
      lastUpdate: '2 weeks ago',
      compliance: 30 
    }
  ];

  const recentActivity = [
    { action: 'Document uploaded', supplier: 'FreshProduce Co.', time: '2 hours ago', type: 'upload' },
    { action: 'Compliance review completed', supplier: 'LogisticsCorp', time: '4 hours ago', type: 'review' },
    { action: 'Document request sent', supplier: 'New Supplier', time: '1 day ago', type: 'request' },
    { action: 'Certificate expired', supplier: 'PackagingSolutions LLC', time: '2 days ago', type: 'expire' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'expiring': return 'bg-orange-100 text-orange-800';
      case 'non-compliant': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'expiring': return <AlertTriangle className="w-4 h-4" />;
      case 'non-compliant': return <FileX className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const handleCreateRequest = (newRequest: any) => {
    setRequests(prev => [...prev, newRequest]);
    console.log('New request created:', newRequest);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">ComplianceFlow</h1>
              <Badge variant="secondary">Buyer Portal</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <RoleSwitcher 
                currentRole={user.currentRole}
                onRoleChange={onRoleSwitch}
              />
              <Button variant="ghost" size="sm">
                <Bell className="w-4 h-4 mr-2" />
                Notifications
              </Button>
              <span className="text-sm text-gray-600">Welcome, {user.name}</span>
              <Button variant="outline" size="sm" onClick={onLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSuppliers}</div>
              <p className="text-xs text-muted-foreground">+2 from last month</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{complianceRate}%</div>
              <Progress value={complianceRate} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Documents</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingDocuments}</div>
              <p className="text-xs text-muted-foreground">Awaiting submission</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.expiringDocuments}</div>
              <p className="text-xs text-muted-foreground">Next 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Suppliers Status */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Supplier Compliance Status</CardTitle>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {suppliers.map(supplier => (
                      <div key={supplier.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <div>
                            <p className="font-medium">{supplier.name}</p>
                            <p className="text-sm text-gray-500">{supplier.documents} documents</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{supplier.compliance}%</span>
                          <Badge className={getStatusColor(supplier.status)} variant="secondary">
                            {getStatusIcon(supplier.status)}
                            <span className="ml-1 capitalize">{supplier.status}</span>
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.action}</p>
                          <p className="text-sm text-gray-500">{activity.supplier}</p>
                          <p className="text-xs text-gray-400">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Supplier Management</CardTitle>
                <div className="flex space-x-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input placeholder="Search suppliers..." className="pl-10 w-64" />
                  </div>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Supplier
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {suppliers.map(supplier => (
                    <div key={supplier.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-gray-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{supplier.name}</h3>
                            <p className="text-sm text-gray-500">Last updated: {supplier.lastUpdate}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">{supplier.compliance}% Compliant</p>
                            <Progress value={supplier.compliance} className="w-24 mt-1" />
                          </div>
                          <Badge className={getStatusColor(supplier.status)} variant="secondary">
                            {getStatusIcon(supplier.status)}
                            <span className="ml-1 capitalize">{supplier.status}</span>
                          </Badge>
                          <Button variant="outline" size="sm">View Details</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Document Center</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <FileX className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Document Management</h3>
                  <p className="text-gray-500 mb-6">View, track, and manage all compliance documents</p>
                  <Button>Explore Documents</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Document Requests</CardTitle>
                <Button onClick={() => setShowNewRequestModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Request
                </Button>
              </CardHeader>
              <CardContent>
                {requests.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Request Management</h3>
                    <p className="text-gray-500 mb-6">Create and track document requests to suppliers</p>
                    <Button onClick={() => setShowNewRequestModal(true)}>Create New Request</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {requests.map((request) => (
                      <div key={request.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{request.documentType}</h3>
                              <p className="text-sm text-gray-500">Supplier: {request.supplier}</p>
                              <p className="text-xs text-gray-400">Due: {new Date(request.dueDate).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <Badge variant="secondary">{request.category}</Badge>
                            <Badge 
                              className={
                                request.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                                request.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                request.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }
                              variant="secondary"
                            >
                              {request.priority}
                            </Badge>
                            <Badge variant="outline">{request.status}</Badge>
                            <Button variant="outline" size="sm">View Details</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <NewRequestModal
        isOpen={showNewRequestModal}
        onClose={() => setShowNewRequestModal(false)}
        onCreateRequest={handleCreateRequest}
        userType={user.name}
      />
    </div>
  );
};

export default BuyerDashboard;
