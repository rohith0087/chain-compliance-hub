import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDailyOverview } from '@/hooks/useDailyOverview';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  FileCheck,
  Calendar,
  AlertOctagon,
  XCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Shield,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';

interface BuyerDailyOverviewProps {
  companyId: string;
}

const BuyerDailyOverview: React.FC<BuyerDailyOverviewProps> = ({ companyId }) => {
  const { data, loading } = useDailyOverview(companyId);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthScoreIcon = (score: number) => {
    if (score >= 60) return <TrendingUp className="h-6 w-6" />;
    return <TrendingDown className="h-6 w-6" />;
  };

  const getSeverityBadge = (severity: 'low' | 'medium' | 'high' | 'critical') => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[severity]}>{severity.toUpperCase()}</Badge>;
  };

  const totalIssues = 
    data.pendingApproval.count + 
    data.expiringDocuments.next7Days.count + 
    data.overdueDocuments.count + 
    data.complianceIssues.count;

  return (
    <div className="space-y-6 p-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Today's Overview</h1>
          <p className="text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Card className="border-2">
          <CardContent className="flex items-center gap-4 p-6">
            <div className={`${getHealthScoreColor(data.dailyHealthScore)}`}>
              {getHealthScoreIcon(data.dailyHealthScore)}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Health Score</p>
              <p className={`text-3xl font-bold ${getHealthScoreColor(data.dailyHealthScore)}`}>
                {data.dailyHealthScore}/100
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {(data.overdueDocuments.count > 0 || data.expiringDocuments.next7Days.count > 0) && (
        <div className="space-y-2">
          {data.overdueDocuments.count > 0 && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex items-center gap-3">
                <AlertOctagon className="h-5 w-5 text-red-600" />
                <p className="text-red-800 font-medium">
                  {data.overdueDocuments.count} overdue document{data.overdueDocuments.count !== 1 ? 's' : ''} requiring immediate attention
                </p>
              </div>
            </div>
          )}
          {data.expiringDocuments.next7Days.count > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <p className="text-orange-800 font-medium">
                  {data.expiringDocuments.next7Days.count} document{data.expiringDocuments.next7Days.count !== 1 ? 's' : ''} expiring within 7 days
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-6">
          <p className="text-lg">
            {totalIssues === 0 ? (
              <span className="text-green-700 font-medium">✓ All caught up! No items need your attention today.</span>
            ) : (
              <span>
                <span className="font-bold text-foreground">{totalIssues} item{totalIssues !== 1 ? 's' : ''}</span>
                <span className="text-muted-foreground"> need your attention today</span>
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Action Items Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Pending Approvals */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <FileCheck className="h-8 w-8 text-blue-600" />
              {data.pendingApproval.count > 0 && (
                <Badge className="bg-blue-100 text-blue-800">{data.pendingApproval.count}</Badge>
              )}
            </div>
            <CardTitle className="text-lg mt-4">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {data.pendingApproval.count === 0 
                ? 'No documents awaiting review' 
                : `${data.pendingApproval.count} document${data.pendingApproval.count !== 1 ? 's' : ''} awaiting your review`}
            </p>
            {data.pendingApproval.documents.slice(0, 3).map(doc => (
              <div key={doc.id} className="mb-3 pb-3 border-b last:border-0">
                <p className="text-sm font-medium truncate">{doc.title}</p>
                <p className="text-xs text-muted-foreground">{doc.supplier_name}</p>
              </div>
            ))}
            {data.pendingApproval.count > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-4"
                onClick={() => navigate('/buyer', { state: { activeTab: 'documents', filters: { status: 'pending_review' } } })}
              >
                Review Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Calendar className="h-8 w-8 text-orange-600" />
              {(data.expiringDocuments.next7Days.count + data.expiringDocuments.next14Days.count) > 0 && (
                <Badge className="bg-orange-100 text-orange-800">
                  {data.expiringDocuments.next7Days.count + data.expiringDocuments.next14Days.count}
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg mt-4">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Next 7 days</span>
                <span className="font-medium">{data.expiringDocuments.next7Days.count}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Next 14 days</span>
                <span className="font-medium">{data.expiringDocuments.next14Days.count}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Next 30 days</span>
                <span className="font-medium">{data.expiringDocuments.next30Days.count}</span>
              </div>
            </div>
            {data.expiringDocuments.next7Days.documents.slice(0, 2).map(doc => (
              <div key={doc.id} className="mb-3 pb-3 border-b last:border-0">
                <p className="text-sm font-medium truncate">{doc.title}</p>
                <p className="text-xs text-muted-foreground">{doc.supplier_name}</p>
                <p className="text-xs text-orange-600 mt-1">{doc.days_until_expiry} days left</p>
              </div>
            ))}
            {(data.expiringDocuments.next7Days.count + data.expiringDocuments.next14Days.count) > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-4"
                onClick={() => navigate('/buyer', { state: { activeTab: 'documents' } })}
              >
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Compliance Issues */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Shield className="h-8 w-8 text-yellow-600" />
              {data.complianceIssues.count > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800">{data.complianceIssues.count}</Badge>
              )}
            </div>
            <CardTitle className="text-lg mt-4">Compliance Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {data.complianceIssues.count === 0 
                ? 'No compliance concerns' 
                : `${data.complianceIssues.count} supplier${data.complianceIssues.count !== 1 ? 's' : ''} with concerns`}
            </p>
            {data.complianceIssues.issues.slice(0, 3).map(issue => (
              <div key={issue.supplier_id} className="mb-3 pb-3 border-b last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium truncate">{issue.supplier_name}</p>
                  {getSeverityBadge(issue.severity)}
                </div>
                <p className="text-xs text-muted-foreground">{issue.issue_type}</p>
              </div>
            ))}
            {data.complianceIssues.count > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-4"
                onClick={() => navigate('/buyer', { state: { activeTab: 'suppliers' } })}
              >
                View Details <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Overdue Items */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <XCircle className="h-8 w-8 text-red-600" />
              {data.overdueDocuments.count > 0 && (
                <Badge className="bg-red-100 text-red-800">{data.overdueDocuments.count}</Badge>
              )}
            </div>
            <CardTitle className="text-lg mt-4">Overdue Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {data.overdueDocuments.count === 0 
                ? 'No overdue documents' 
                : `${data.overdueDocuments.count} overdue document${data.overdueDocuments.count !== 1 ? 's' : ''}`}
            </p>
            {data.overdueDocuments.documents.slice(0, 3).map(doc => (
              <div key={doc.id} className="mb-3 pb-3 border-b last:border-0">
                <p className="text-sm font-medium truncate">{doc.title}</p>
                <p className="text-xs text-muted-foreground">{doc.supplier_name}</p>
                <p className="text-xs text-red-600 mt-1 font-medium">{doc.days_overdue} days overdue</p>
              </div>
            ))}
            {data.overdueDocuments.count > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-4"
                onClick={() => navigate('/buyer', { state: { activeTab: 'requests' } })}
              >
                Take Action <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{data.pendingApproval.count}</p>
              <p className="text-sm text-muted-foreground mt-1">Pending Review</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{data.expiringDocuments.next7Days.count}</p>
              <p className="text-sm text-muted-foreground mt-1">Expiring Soon</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{data.complianceIssues.count}</p>
              <p className="text-sm text-muted-foreground mt-1">Compliance Issues</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{data.overdueDocuments.count}</p>
              <p className="text-sm text-muted-foreground mt-1">Overdue</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BuyerDailyOverview;
