
import { useState, useEffect } from 'react';
import logger from '@/utils/logger';
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
  Upload
} from 'lucide-react';
import ComplianceDashboard from './ComplianceDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBranchContext } from '@/contexts/BranchContext';

const SupplierComplianceDashboard = () => {
  const [documentRequests, setDocumentRequests] = useState<any[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [connectedBuyers, setConnectedBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { currentBranch, allBranchesView } = useBranchContext();

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, currentBranch?.id, allBranchesView]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      logger.debug('Loading compliance dashboard data');
      
      // Check if user is a team member first (company ID resolution pattern)
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', user?.id)
        .eq('company_type', 'supplier')
        .eq('status', 'active')
        .maybeSingle();

      let supplierId: string | null = null;

      if (teamMember) {
        supplierId = teamMember.company_id;
      } else {
        // Load supplier profile for company owner
        const { data: supplierProfile, error: supplierError } = await supabase
          .from('suppliers')
          .select('id')
          .eq('profile_id', user?.id)
          .maybeSingle();

        if (supplierError) {
          console.error('Error loading supplier profile:', supplierError);
          return;
        }

        if (!supplierProfile) {
          logger.debug('No supplier profile found for user');
          return;
        }

        supplierId = supplierProfile.id;
      }

      logger.debug('Supplier ID resolved:', supplierId);

      // Load document requests with buyer info
      let requestsQuery = supabase
        .from('document_requests')
        .select(`
          *,
          buyers (
            id,
            company_name,
            industry
          )
        `)
        .eq('supplier_id', supplierId);

      // Apply branch filter if specific branch selected (include NULL for non-branch-specific docs)
      if (!allBranchesView && currentBranch?.id) {
        requestsQuery = requestsQuery.or(`supplier_branch_id.eq.${currentBranch.id},supplier_branch_id.is.null`);
      }

      const { data: requests, error: requestsError } = await requestsQuery
        .order('created_at', { ascending: false });

      logger.debug('Document requests loaded:', requests?.length || 0, 'requests');
      if (requestsError) {
        console.error('Error loading document requests:', requestsError);
      } else {
        setDocumentRequests(requests || []);
      }

      // Load document uploads
      const requestIds = requests?.map(r => r.id) || [];
      if (requestIds.length > 0) {
        const { data: uploadsData, error: uploadsError } = await supabase
          .from('document_uploads')
          .select('*')
          .in('request_id', requestIds)
          .order('created_at', { ascending: false });

        logger.debug('Document uploads loaded:', uploadsData?.length || 0, 'uploads');
        if (uploadsError) {
          console.error('Error loading document uploads:', uploadsError);
        } else {
          setUploads(uploadsData || []);
        }
      }

      // Load connected buyers
      let connectionsQuery = supabase
        .from('buyer_supplier_connections')
        .select(`
          *,
          buyers (
            id,
            company_name,
            industry
          )
        `)
        .eq('supplier_id', supplierId)
        .eq('status', 'approved');

      // Apply branch filter if specific branch selected (include NULL for non-branch-specific connections)
      if (!allBranchesView && currentBranch?.id) {
        connectionsQuery = connectionsQuery.or(`branch_id.eq.${currentBranch.id},branch_id.is.null`);
      }

      const { data: connections, error: connectionsError } = await connectionsQuery;

      logger.debug('Connected buyers loaded:', connections?.length || 0, 'connections');
      if (connectionsError) {
        console.error('Error loading connected buyers:', connectionsError);
      } else {
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
        <TabsList className="inline-flex h-12 items-center gap-1 rounded-full bg-card border border-border/40 p-1.5 justify-start shadow-sm">
          <TabsTrigger 
            value="overview"
            className="rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none hover:text-foreground"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="performance"
            className="rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none hover:text-foreground"
          >
            Performance
          </TabsTrigger>
          <TabsTrigger 
            value="analytics"
            className="rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none hover:text-foreground"
          >
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
                            <p className="text-sm text-muted-foreground">{request.buyers?.company_name}</p>
                          </div>
                          <Badge variant="destructive">
                            {daysUntilDue <= 0 ? 'Overdue' : `${daysUntilDue} days left`}
                          </Badge>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No urgent actions required</p>
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
                          <p className="text-sm text-muted-foreground">{request.buyers?.company_name}</p>
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
                        <p className="text-sm text-muted-foreground">{buyer.industry}</p>
                        <p className="text-xs text-muted-foreground/70">
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
          <ComplianceDashboard userRole="supplier" data={{ documentRequests }} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupplierComplianceDashboard;
