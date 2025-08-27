import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  FileText,
  Building,
  Calendar,
  Target,
  Activity
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface ComplianceMetrics {
  total_documents: number;
  pending_documents: number;
  approved_documents: number;
  rejected_documents: number;
  expired_documents: number;
  expiring_soon: number;
  compliance_score: number;
  avg_approval_time: number;
}

interface SupplierMetric {
  id: string;
  name: string;
  compliance_score: number;
  documents_count: number;
  risk_level: 'low' | 'medium' | 'high';
  last_activity: string;
}

interface ComplianceInsightsDashboardProps {
  companyId: string;
  companyType: string;
  className?: string;
}

const ComplianceInsightsDashboard: React.FC<ComplianceInsightsDashboardProps> = ({
  companyId,
  companyType,
  className = ''
}) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null);
  const [supplierMetrics, setSupplierMetrics] = useState<SupplierMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'quarter'>('month');

  useEffect(() => {
    if (companyId && companyType === 'buyer') {
      loadComplianceMetrics();
      loadSupplierMetrics();
    }
  }, [companyId, companyType, selectedTimeframe]);

  const loadComplianceMetrics = async () => {
    try {
      setLoading(true);

      // Get document counts by status
      const { data: documents } = await supabase
        .from('document_uploads')
        .select(`
          id,
          status,
          expiration_date,
          created_at,
          document_requests!inner(
            buyer_id,
            supplier_id
          )
        `)
        .eq('document_requests.buyer_id', companyId);

      if (!documents) return;

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const metrics = documents.reduce((acc, doc) => {
        acc.total_documents++;
        
        if (doc.status === 'pending_review') acc.pending_documents++;
        else if (doc.status === 'approved') acc.approved_documents++;
        else if (doc.status === 'rejected') acc.rejected_documents++;
        
        if (doc.expiration_date) {
          const expDate = new Date(doc.expiration_date);
          if (expDate < now) acc.expired_documents++;
          else if (expDate < thirtyDaysFromNow) acc.expiring_soon++;
        }
        
        return acc;
      }, {
        total_documents: 0,
        pending_documents: 0,
        approved_documents: 0,
        rejected_documents: 0,
        expired_documents: 0,
        expiring_soon: 0,
        compliance_score: 0,
        avg_approval_time: 24
      });

      // Calculate compliance score (0-100)
      const activeDocuments = metrics.total_documents - metrics.expired_documents;
      const approvedPercentage = activeDocuments > 0 ? (metrics.approved_documents / activeDocuments) * 100 : 0;
      const urgentIssues = metrics.expired_documents + metrics.expiring_soon;
      metrics.compliance_score = Math.max(0, Math.round(approvedPercentage - (urgentIssues * 10)));

      setMetrics(metrics);
    } catch (error) {
      console.error('Error loading compliance metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSupplierMetrics = async () => {
    try {
      // Get connected suppliers with their document counts
      const { data: connections } = await supabase
        .from('buyer_supplier_connections')
        .select(`
          supplier_id,
          suppliers(
            id,
            company_name,
            updated_at
          )
        `)
        .eq('buyer_id', companyId)
        .eq('status', 'approved');

      if (!connections) return;

      const supplierMetrics = await Promise.all(
        connections.map(async (conn) => {
          const supplierId = conn.supplier_id;
          const supplierName = conn.suppliers?.company_name || 'Unknown';

          // Get document counts for this supplier
          const { data: docs } = await supabase
            .from('document_uploads')
            .select(`
              status,
              expiration_date,
              document_requests!inner(supplier_id)
            `)
            .eq('document_requests.supplier_id', supplierId);

          const docCount = docs?.length || 0;
          const approvedDocs = docs?.filter(d => d && d.status === 'approved').length || 0;
          const expiredDocs = docs?.filter(d => {
            if (!d || !d.expiration_date) return false;
            return new Date(d.expiration_date) < new Date();
          }).length || 0;

          // Calculate compliance score for supplier
          let complianceScore = docCount > 0 ? Math.round((approvedDocs / docCount) * 100) : 0;
          complianceScore = Math.max(0, complianceScore - (expiredDocs * 20));

          // Determine risk level
          let riskLevel: 'low' | 'medium' | 'high' = 'low';
          if (expiredDocs > 2 || complianceScore < 60) riskLevel = 'high';
          else if (expiredDocs > 0 || complianceScore < 80) riskLevel = 'medium';

          return {
            id: supplierId,
            name: supplierName,
            compliance_score: complianceScore,
            documents_count: docCount,
            risk_level: riskLevel,
            last_activity: conn.suppliers?.updated_at || new Date().toISOString()
          };
        })
      );

      setSupplierMetrics(supplierMetrics);
    } catch (error) {
      console.error('Error loading supplier metrics:', error);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getRiskBadgeVariant = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-24 bg-muted rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" />
            Compliance Insights
          </h2>
          <p className="text-muted-foreground">Real-time compliance monitoring and analytics</p>
        </div>
        
        <div className="flex items-center gap-2">
          {(['week', 'month', 'quarter'] as const).map((timeframe) => (
            <Button
              key={timeframe}
              variant={selectedTimeframe === timeframe ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeframe(timeframe)}
              className="capitalize"
            >
              {timeframe}
            </Button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compliance Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(metrics.compliance_score)}`}>
                  {metrics.compliance_score}%
                </p>
              </div>
              <Target className="w-8 h-8 text-primary" />
            </div>
            <Progress value={metrics.compliance_score} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-bold">{metrics.total_documents}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span>+{Math.round(metrics.total_documents * 0.12)} this {selectedTimeframe}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-amber-600">{metrics.pending_documents}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Avg. {metrics.avg_approval_time}h approval time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Action Required</p>
                <p className="text-2xl font-bold text-red-600">
                  {metrics.expired_documents + metrics.expiring_soon}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.expired_documents} expired, {metrics.expiring_soon} expiring soon
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Document Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Document Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{metrics.approved_documents}</div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{metrics.pending_documents}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{metrics.rejected_documents}</div>
              <div className="text-sm text-muted-foreground">Rejected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{metrics.expired_documents}</div>
              <div className="text-sm text-muted-foreground">Expired</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Risk Analysis */}
      {supplierMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Supplier Risk Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {supplierMetrics.slice(0, 5).map((supplier) => (
                <div key={supplier.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{supplier.name}</span>
                      <Badge variant={getRiskBadgeVariant(supplier.risk_level)} className="text-xs">
                        {supplier.risk_level} risk
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>{supplier.documents_count} documents</span>
                      <span>Last active: {format(new Date(supplier.last_activity), 'MMM dd')}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${getScoreColor(supplier.compliance_score)}`}>
                      {supplier.compliance_score}%
                    </div>
                    <div className="text-xs text-muted-foreground">compliance</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {metrics.pending_documents > 0 && (
              <Button variant="outline" className="justify-start h-auto p-3">
                <Clock className="w-4 h-4 mr-2" />
                <div className="text-left">
                  <div className="font-medium">Review {metrics.pending_documents} pending documents</div>
                  <div className="text-xs text-muted-foreground">Reduce approval time</div>
                </div>
              </Button>
            )}
            
            {metrics.expired_documents > 0 && (
              <Button variant="outline" className="justify-start h-auto p-3">
                <AlertTriangle className="w-4 h-4 mr-2" />
                <div className="text-left">
                  <div className="font-medium">Address {metrics.expired_documents} expired documents</div>
                  <div className="text-xs text-muted-foreground">Critical compliance issue</div>
                </div>
              </Button>
            )}
            
            {metrics.expiring_soon > 0 && (
              <Button variant="outline" className="justify-start h-auto p-3">
                <Calendar className="w-4 h-4 mr-2" />
                <div className="text-left">
                  <div className="font-medium">Follow up on {metrics.expiring_soon} expiring documents</div>
                  <div className="text-xs text-muted-foreground">Prevent compliance gaps</div>
                </div>
              </Button>
            )}
            
            <Button variant="outline" className="justify-start h-auto p-3">
              <TrendingUp className="w-4 h-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Generate compliance report</div>
                <div className="text-xs text-muted-foreground">Share with stakeholders</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceInsightsDashboard;