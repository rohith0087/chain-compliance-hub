import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileCheck, 
  Calendar,
  TrendingUp,
  Building2,
  Users,
  Upload,
  BarChart3
} from 'lucide-react';
import ComplianceDashboard from './ComplianceDashboard';
import EnhancedAnalyticsDashboard from '@/components/analytics/EnhancedAnalyticsDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const SupplierComplianceDashboard = () => {
  const [documentRequests, setDocumentRequests] = useState<any[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [connectedBuyers, setConnectedBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load supplier profile first
      const { data: supplierProfile } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

      if (supplierProfile) {
        // Load document requests with buyer info
        const { data: requests } = await supabase
          .from('document_requests')
          .select(`
            *,
            buyers (
              id,
              company_name,
              industry
            )
          `)
          .eq('supplier_id', supplierProfile.id)
          .order('created_at', { ascending: false });

        setDocumentRequests(requests || []);

        // Load document uploads
        const requestIds = requests?.map(r => r.id) || [];
        if (requestIds.length > 0) {
          const { data: uploadsData } = await supabase
            .from('document_uploads')
            .select('*')
            .in('request_id', requestIds)
            .order('created_at', { ascending: false });

          setUploads(uploadsData || []);
        }

        // Load connected buyers
        const { data: connections } = await supabase
          .from('buyer_supplier_connections')
          .select(`
            *,
            buyers (
              id,
              company_name,
              industry
            )
          `)
          .eq('supplier_id', supplierProfile.id)
          .eq('status', 'approved');

        setConnectedBuyers(connections || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate compliance metrics
  const stats = {
    totalRequests: documentRequests.length,
    pendingRequests: documentRequests.filter(r => r.status === 'pending').length,
    approvedRequests: documentRequests.filter(r => r.status === 'approved').length,
    rejectedRequests: documentRequests.filter(r => r.status === 'rejected').length,
    submittedRequests: documentRequests.filter(r => r.status === 'submitted').length,
    overallCompliance: documentRequests.length > 0 
      ? Math.round((documentRequests.filter(r => r.status === 'approved').length / documentRequests.length) * 100)
      : 0,
    totalUploads: uploads.length,
    connectedBuyers: connectedBuyers.length
  };

  // Calculate upcoming deadlines
  const upcomingDeadlines = documentRequests
    .filter(r => r.due_date && r.status === 'pending')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5);

  // Calculate performance by buyer
  const buyerPerformance = connectedBuyers.map(connection => {
    const buyerRequests = documentRequests.filter(r => r.buyer_id === connection.buyers?.id);
    const approvedForBuyer = buyerRequests.filter(r => r.status === 'approved').length;
    return {
      ...connection.buyers,
      totalRequests: buyerRequests.length,
      approvedRequests: approvedForBuyer,
      complianceRate: buyerRequests.length > 0 ? Math.round((approvedForBuyer / buyerRequests.length) * 100) : 0
    };
  });

  if (loading) {
    return <div className="flex items-center justify-center py-8">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Compliance Dashboard</h2>
        <Button variant="outline" onClick={loadDashboardData}>
          Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
                <Shield className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.overallCompliance}%</div>
                <Progress value={stats.overallCompliance} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.pendingRequests}</div>
                <p className="text-xs text-muted-foreground">Need attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved Docs</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.approvedRequests}</div>
                <p className="text-xs text-muted-foreground">Successfully approved</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Uploads</CardTitle>
                <Upload className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUploads}</div>
                <p className="text-xs text-muted-foreground">Documents uploaded</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connected Buyers</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.connectedBuyers}</div>
                <p className="text-xs text-muted-foreground">Active partnerships</p>
              </CardContent>
            </Card>
          </div>

          {/* Urgent Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Urgent Actions Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingDeadlines.length > 0 ? (
                    upcomingDeadlines.map((request) => {
                      const daysUntilDue = Math.ceil(
                        (new Date(request.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                      );
                      return (
                        <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg border-red-200 bg-red-50">
                          <div>
                            <p className="font-medium">{request.title}</p>
                            <p className="text-sm text-gray-600">{request.buyers?.company_name}</p>
                          </div>
                          <Badge variant="destructive">
                            {daysUntilDue <= 0 ? 'Overdue' : `${daysUntilDue} days left`}
                          </Badge>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-500 text-center py-4">No urgent actions required</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {documentRequests.slice(0, 5).map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileCheck className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium">{request.title}</p>
                          <p className="text-sm text-gray-500">{request.buyers?.company_name}</p>
                        </div>
                      </div>
                      <Badge 
                        variant={
                          request.status === 'approved' ? 'default' :
                          request.status === 'pending' ? 'secondary' : 'destructive'
                        }
                        className={
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'rejected' ? 'bg-red-100 text-red-800' : ''
                        }
                      >
                        {request.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Buyer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {buyerPerformance.map((buyer) => (
                  <div key={buyer.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium">{buyer.company_name}</h3>
                        <p className="text-sm text-gray-500">{buyer.industry}</p>
                        <p className="text-xs text-gray-400">
                          {buyer.totalRequests} requests • {buyer.approvedRequests} approved
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        buyer.complianceRate >= 90 ? 'text-green-600' :
                        buyer.complianceRate >= 70 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {buyer.complianceRate}%
                      </div>
                      <Progress value={buyer.complianceRate} className="w-24 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <EnhancedAnalyticsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupplierComplianceDashboard;
