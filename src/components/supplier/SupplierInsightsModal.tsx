import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileCheck,
  Download,
  Mail,
  Phone,
  Calendar,
  Target,
  Award,
  XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface SupplierInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: any;
  buyerId: string;
}

const SupplierInsightsModal = ({ isOpen, onClose, supplier, buyerId }: SupplierInsightsModalProps) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryStats, setCategoryStats] = useState<any>({});

  useEffect(() => {
    if (isOpen && supplier && buyerId) {
      loadSupplierData();
    }
  }, [isOpen, supplier, buyerId]);

  // Add defensive check for supplier
  if (!supplier) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supplier Insights</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">No supplier data available</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const loadSupplierData = async () => {
    setLoading(true);
    try {
      // Load document requests for this supplier
      const { data: requestsData } = await supabase
        .from('document_requests')
        .select('*')
        .eq('supplier_id', supplier.id)
        .eq('buyer_id', buyerId)
        .order('created_at', { ascending: false });

      setRequests(requestsData || []);

      // Load document uploads
      const { data: uploadsData } = await supabase
        .from('document_uploads')
        .select(`
          *,
          document_requests!inner(
            supplier_id,
            buyer_id,
            category,
            document_type
          )
        `)
        .eq('document_requests.supplier_id', supplier.id)
        .eq('document_requests.buyer_id', buyerId);

      setUploads(uploadsData || []);

      // Calculate category-wise statistics
      const categories: any = {};
      requestsData?.forEach((request: any) => {
        const category = request.category || 'Other';
        if (!categories[category]) {
          categories[category] = {
            total: 0,
            approved: 0,
            pending: 0,
            rejected: 0,
            submitted: 0
          };
        }
        categories[category].total++;
        categories[category][request.status]++;
      });

      setCategoryStats(categories);
    } catch (error) {
      console.error('Error loading supplier data:', error);
    } finally {
      setLoading(false);
    }
  };

  const overallMetrics = {
    totalRequests: requests.length,
    approvedRequests: requests.filter(r => r.status === 'approved').length,
    pendingRequests: requests.filter(r => r.status === 'pending').length,
    rejectedRequests: requests.filter(r => r.status === 'rejected').length,
    submittedRequests: requests.filter(r => r.status === 'submitted').length,
    complianceScore: requests.length > 0 
      ? Math.round((requests.filter(r => r.status === 'approved').length / requests.length) * 100)
      : 0,
    avgResponseTime: '3.2 days', // Mock data - could be calculated from actual data
    overdueCount: requests.filter(r => r.due_date && new Date(r.due_date) < new Date() && r.status === 'pending').length
  };

  const riskLevel = overallMetrics.complianceScore >= 90 ? 'Low' :
                   overallMetrics.complianceScore >= 70 ? 'Medium' : 'High';

  const getRiskColor = () => {
    if (riskLevel === 'Low') return 'text-green-600 bg-green-100';
    if (riskLevel === 'Medium') return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Building2 className="h-6 w-6" />
            {supplier?.company_name} - Detailed Insights
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">Loading...</div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="requests">Requests</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Company Info & Key Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Company Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Company Name</p>
                      <p className="font-medium">{supplier.company_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Industry</p>
                      <p>{supplier.industry || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Risk Level</p>
                      <Badge className={getRiskColor()}>{riskLevel} Risk</Badge>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button variant="outline" size="sm">
                        <Mail className="h-4 w-4 mr-2" />
                        Contact
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Compliance Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">{overallMetrics.complianceScore}%</div>
                      <Progress value={overallMetrics.complianceScore} className="mt-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {overallMetrics.approvedRequests} of {overallMetrics.totalRequests} approved
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Avg Response Time
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{overallMetrics.avgResponseTime}</div>
                      <p className="text-xs text-muted-foreground mt-1">Average time to respond</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileCheck className="h-4 w-4" />
                        Total Requests
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{overallMetrics.totalRequests}</div>
                      <p className="text-xs text-muted-foreground mt-1">All time requests</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Overdue Items
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-600">{overallMetrics.overdueCount}</div>
                      <p className="text-xs text-muted-foreground mt-1">Past due date</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Approved
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{overallMetrics.approvedRequests}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      Pending
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{overallMetrics.pendingRequests}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-blue-500" />
                      Submitted
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{overallMetrics.submittedRequests}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Rejected
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{overallMetrics.rejectedRequests}</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="requests" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Request History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {requests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileCheck className="w-5 h-5 text-blue-500" />
                          <div>
                            <p className="font-medium">{request.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {request.document_type} • {request.category}
                            </p>
                            {request.due_date && (
                              <p className="text-xs text-muted-foreground">
                                Due: {format(new Date(request.due_date), 'MMM dd, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant={
                              request.status === 'approved' ? 'default' :
                              request.status === 'pending' ? 'secondary' : 
                              request.status === 'submitted' ? 'outline' : 'destructive'
                            }
                            className={
                              request.status === 'approved' ? 'bg-green-100 text-green-800' :
                              request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              request.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }
                          >
                            {request.status}
                          </Badge>
                          <Badge variant="outline" className={
                            request.priority === 'high' ? 'border-red-500 text-red-500' :
                            request.priority === 'medium' ? 'border-yellow-500 text-yellow-500' :
                            'border-green-500 text-green-500'
                          }>
                            {request.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(categoryStats).map(([category, stats]: [string, any]) => (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="text-lg">{category}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Total Requests</span>
                          <span className="font-bold">{stats.total}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-green-600">Approved</span>
                          <span className="font-bold text-green-600">{stats.approved}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-yellow-600">Pending</span>
                          <span className="font-bold text-yellow-600">{stats.pending}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-red-600">Rejected</span>
                          <span className="font-bold text-red-600">{stats.rejected}</span>
                        </div>
                        <Progress 
                          value={stats.total > 0 ? (stats.approved / stats.total) * 100 : 0} 
                          className="mt-2" 
                        />
                        <p className="text-xs text-muted-foreground">
                          {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}% completion rate
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Request Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {requests.slice(0, 10).map((request, index) => (
                      <div key={request.id} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{request.title}</p>
                            <time className="text-xs text-muted-foreground">
                              {format(new Date(request.created_at), 'MMM dd, yyyy')}
                            </time>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {request.document_type} request {request.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-2">Key Insights</h4>
                      <div className="space-y-2 text-sm">
                        <p>• This supplier has a {overallMetrics.complianceScore}% compliance rate</p>
                        <p>• Average response time is {overallMetrics.avgResponseTime}</p>
                        <p>• {overallMetrics.overdueCount} requests are currently overdue</p>
                        <p>• Most active in {Object.keys(categoryStats)[0] || 'N/A'} category</p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Recommendations</h4>
                      <div className="space-y-2 text-sm">
                        {overallMetrics.complianceScore < 70 && (
                          <p className="text-red-600">• Consider additional support or training for this supplier</p>
                        )}
                        {overallMetrics.overdueCount > 0 && (
                          <p className="text-yellow-600">• Follow up on {overallMetrics.overdueCount} overdue requests</p>
                        )}
                        {overallMetrics.complianceScore >= 90 && (
                          <p className="text-green-600">• Excellent performance - consider strategic partnership opportunities</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SupplierInsightsModal;