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
  FileCheck, 
  Upload, 
  Calendar,
  Bell,
  Download,
  Plus
} from 'lucide-react';
import RoleSwitcher from '@/components/RoleSwitcher';

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

  // Mock data for demonstration
  const stats = {
    pendingRequests: 8,
    documentsSubmitted: 15,
    approvedDocuments: 12,
    expiringDocuments: 3
  };

  const completionRate = Math.round((stats.approvedDocuments / (stats.approvedDocuments + stats.pendingRequests)) * 100);

  const documentRequests = [
    { 
      id: 1, 
      title: 'Food Safety Certificate', 
      buyer: 'GroceryChain Corp', 
      dueDate: '2024-06-15',
      status: 'pending',
      priority: 'high'
    },
    { 
      id: 2, 
      title: 'Insurance Certificate', 
      buyer: 'RetailPartner LLC', 
      dueDate: '2024-06-20',
      status: 'submitted',
      priority: 'medium'
    },
    { 
      id: 3, 
      title: 'Quality Assurance Report', 
      buyer: 'ManufacturingCo', 
      dueDate: '2024-06-25',
      status: 'approved',
      priority: 'low'
    },
    { 
      id: 4, 
      title: 'Environmental Compliance', 
      buyer: 'EcoFriendly Inc', 
      dueDate: '2024-06-18',
      status: 'rejected',
      priority: 'high'
    }
  ];

  const upcomingExpirations = [
    { document: 'ISO 9001 Certificate', expiryDate: '2024-07-15', daysLeft: 41 },
    { document: 'HACCP Certification', expiryDate: '2024-08-03', daysLeft: 60 },
    { document: 'Business License', expiryDate: '2024-06-30', daysLeft: 26 }
  ];

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
              <RoleSwitcher 
                currentRole={user.currentRole}
                availableRoles={user.roles}
                onRoleSwitch={onRoleSwitch}
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
              <p className="text-xs text-muted-foreground">This month</p>
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
            <TabsTrigger value="requests">Document Requests</TabsTrigger>
            <TabsTrigger value="documents">My Documents</TabsTrigger>
            <TabsTrigger value="expiry">Expiry Tracking</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Requests */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Document Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {documentRequests.slice(0, 3).map(request => (
                      <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <div>
                            <p className="font-medium">{request.title}</p>
                            <p className="text-sm text-gray-500">{request.buyer}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getPriorityColor(request.priority)} variant="secondary">
                            {request.priority}
                          </Badge>
                          <Badge className={getStatusColor(request.status)} variant="secondary">
                            {getStatusIcon(request.status)}
                            <span className="ml-1 capitalize">{request.status}</span>
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full mt-4">View All Requests</Button>
                </CardContent>
              </Card>

              {/* Expiring Documents */}
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Expirations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {upcomingExpirations.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Calendar className="w-5 h-5 text-orange-500" />
                          <div>
                            <p className="font-medium">{item.document}</p>
                            <p className="text-sm text-gray-500">Expires: {item.expiryDate}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-orange-600">
                          {item.daysLeft} days
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full mt-4">Manage Renewals</Button>
                </CardContent>
              </Card>
            </div>
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
                            <p className="text-sm text-gray-500">Requested by: {request.buyer}</p>
                            <p className="text-sm text-gray-500">Due: {request.dueDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <Badge className={getPriorityColor(request.priority)} variant="secondary">
                            {request.priority} priority
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
              </CardContent>
            </Card>
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

          <TabsContent value="expiry">
            <Card>
              <CardHeader>
                <CardTitle>Expiration Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingExpirations.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{item.document}</h3>
                            <p className="text-sm text-gray-500">Expires: {item.expiryDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <Badge variant="outline" className="text-orange-600">
                            {item.daysLeft} days left
                          </Badge>
                          <Button variant="outline" size="sm">Renew Document</Button>
                        </div>
                      </div>
                    </div>
                  ))}
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
