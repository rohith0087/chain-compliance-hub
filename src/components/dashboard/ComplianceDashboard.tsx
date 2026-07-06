
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  TrendingDown,
  Calendar,
  FileCheck,
  Users,
  AlertCircle
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

interface ComplianceDashboardProps {
  userRole: 'buyer' | 'supplier';
  data: any;
}

const ComplianceDashboard = ({ userRole, data }: ComplianceDashboardProps) => {
  const [timeframe, setTimeframe] = useState('30d');

  const chartConfig = {
    pending: { label: 'Pending', color: '#f59e0b' },
    approved: { label: 'Approved', color: '#10b981' },
    rejected: { label: 'Rejected', color: '#ef4444' },
    submitted: { label: 'Submitted', color: '#3b82f6' }
  };

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

  // Extract document requests from data
  const documentRequests = data?.documentRequests || [];

  // Calculate dynamic metrics
  const dynamicMetrics = useMemo(() => {
    if (!documentRequests.length) {
      return {
        complianceData: { overallScore: 0, trend: 0, criticalIssues: 0, completionRate: 0, avgResponseTime: '0 days' },
        statusDistribution: [],
        monthlyTrend: [],
        categoryBreakdown: [],
        upcomingDeadlines: [],
        actionItems: { critical: 0, upcoming: 0, completed: 0 }
      };
    }

    // Calculate overall metrics
    const totalRequests = documentRequests.length;
    const approvedCount = documentRequests.filter(req => req.status === 'approved').length;
    const rejectedCount = documentRequests.filter(req => req.status === 'rejected').length;
    const pendingCount = documentRequests.filter(req => req.status === 'pending').length;
    const submittedCount = documentRequests.filter(req => req.status === 'submitted').length;

    // Calculate compliance score (approved / total * 100)
    const overallScore = totalRequests > 0 ? Math.round((approvedCount / totalRequests) * 100) : 0;
    
    // Calculate completion rate (approved + submitted / total * 100)
    const completionRate = totalRequests > 0 ? Math.round(((approvedCount + submittedCount) / totalRequests) * 100) : 0;

    // Count critical issues (overdue + rejected)
    const now = new Date();
    const overdueCount = documentRequests.filter(req => 
      req.due_date && new Date(req.due_date) < now && req.status !== 'approved'
    ).length;
    const criticalIssues = overdueCount + rejectedCount;

    // Calculate average response time
    const completedRequests = documentRequests.filter(req => req.status === 'approved' || req.status === 'submitted');
    let avgResponseTime = '0 days';
    if (completedRequests.length > 0) {
      const totalDays = completedRequests.reduce((sum, req) => {
        const created = new Date(req.created_at);
        const updated = new Date(req.updated_at);
        const daysDiff = Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return sum + daysDiff;
      }, 0);
      const avgDays = Math.round(totalDays / completedRequests.length);
      avgResponseTime = `${avgDays} days`;
    }

    // Status distribution for pie chart
    const statusDistribution = [
      { name: 'Approved', value: approvedCount, color: '#10b981' },
      { name: 'Pending', value: pendingCount, color: '#f59e0b' },
      { name: 'Rejected', value: rejectedCount, color: '#ef4444' },
      { name: 'Submitted', value: submittedCount, color: '#3b82f6' }
    ].filter(item => item.value > 0);

    // Monthly trend data
    const monthlyData = {};
    documentRequests.forEach(req => {
      const month = new Date(req.created_at).toLocaleDateString('en-US', { month: 'short' });
      if (!monthlyData[month]) {
        monthlyData[month] = { month, requests: 0, completed: 0 };
      }
      monthlyData[month].requests++;
      if (req.status === 'approved' || req.status === 'submitted') {
        monthlyData[month].completed++;
      }
    });
    const monthlyTrend = Object.values(monthlyData);

    // Category breakdown
    const categoryData: Record<string, { category: string; count: number; approved: number }> = {};
    documentRequests.forEach(req => {
      const category = req.category || 'Other';
      if (!categoryData[category]) {
        categoryData[category] = { category, count: 0, approved: 0 };
      }
      categoryData[category].count++;
      if (req.status === 'approved') {
        categoryData[category].approved++;
      }
    });
    const categoryBreakdown = Object.values(categoryData).map(cat => ({
      ...cat,
      compliance: cat.count > 0 ? Math.round((cat.approved / cat.count) * 100) : 0
    }));

    // Upcoming deadlines
    const upcomingDeadlines = documentRequests
      .filter(req => req.due_date && req.status !== 'approved')
      .map(req => {
        const dueDate = new Date(req.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          ...req,
          daysUntilDue,
          isOverdue: daysUntilDue < 0,
          isUrgent: daysUntilDue <= 3 && daysUntilDue >= 0
        };
      })
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .slice(0, 5);

    // Action items
    const upcomingCount = documentRequests.filter(req => {
      if (!req.due_date || req.status === 'approved') return false;
      const daysUntilDue = Math.ceil((new Date(req.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= 7 && daysUntilDue >= 0;
    }).length;

    const thisMonth = new Date().getMonth();
    const completedThisMonth = documentRequests.filter(req => 
      req.status === 'approved' && new Date(req.updated_at).getMonth() === thisMonth
    ).length;

    return {
      complianceData: {
        overallScore,
        trend: 0, // Would need historical data to calculate trend
        criticalIssues,
        completionRate,
        avgResponseTime
      },
      statusDistribution,
      monthlyTrend,
      categoryBreakdown,
      upcomingDeadlines,
      actionItems: {
        critical: criticalIssues,
        upcoming: upcomingCount,
        completed: completedThisMonth
      }
    };
  }, [documentRequests]);

  const { complianceData, statusDistribution, monthlyTrend, categoryBreakdown, upcomingDeadlines, actionItems } = dynamicMetrics;

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{complianceData.overallScore}%</div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              +{complianceData.trend}% from last month
            </div>
            <Progress value={complianceData.overallScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{complianceData.criticalIssues}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{complianceData.completionRate}%</div>
            <p className="text-xs text-muted-foreground">Documents completed on time</p>
            <Progress value={complianceData.completionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{complianceData.avgResponseTime}</div>
            <p className="text-xs text-muted-foreground">Time to submit documents</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Document Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {statusDistribution.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Request Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Requests"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="completed" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Completed"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryBreakdown.map((category, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileCheck className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-medium">{category.category}</p>
                      <p className="text-sm text-muted-foreground">{category.count} documents</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      category.compliance >= 90 ? 'text-green-600' :
                      category.compliance >= 80 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {category.compliance}%
                    </div>
                    <Progress value={category.compliance} className="w-20 h-2 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingDeadlines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming deadlines</p>
                </div>
              ) : (
                upcomingDeadlines.map((deadline, index) => {
                  const isOverdue = deadline.isOverdue;
                  const isUrgent = deadline.isUrgent;
                  const daysText = isOverdue 
                    ? `Overdue by ${Math.abs(deadline.daysUntilDue)} days`
                    : `Due in ${deadline.daysUntilDue} days`;
                  
                  return (
                    <div 
                      key={index} 
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        isOverdue 
                          ? 'border-red-200 bg-red-50' 
                          : isUrgent 
                          ? 'border-yellow-200 bg-yellow-50'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {isOverdue ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : isUrgent ? (
                          <Calendar className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-blue-500" />
                        )}
                        <div>
                          <p className="font-medium">{deadline.title}</p>
                          <p className="text-sm text-muted-foreground">{deadline.category}</p>
                        </div>
                      </div>
                      <Badge 
                        variant={
                          isOverdue 
                            ? "destructive" 
                            : isUrgent 
                            ? "secondary"
                            : "outline"
                        }
                        className={
                          isUrgent && !isOverdue
                            ? "bg-yellow-100 text-yellow-800"
                            : ""
                        }
                      >
                        {daysText}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Items */}
      <Card>
        <CardHeader>
          <CardTitle>Action Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg border-red-200 bg-red-50">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-medium text-red-800">Critical</h3>
              </div>
               <p className="text-sm text-red-700">{actionItems.critical} documents require immediate attention</p>
             </div>
             
             <div className="p-4 border rounded-lg border-yellow-200 bg-yellow-50">
               <div className="flex items-center space-x-2 mb-2">
                 <Clock className="w-5 h-5 text-yellow-500" />
                 <h3 className="font-medium text-yellow-800">Upcoming</h3>
               </div>
               <p className="text-sm text-yellow-700">{actionItems.upcoming} documents due within 7 days</p>
             </div>
             
             <div className="p-4 border rounded-lg border-green-200 bg-green-50">
               <div className="flex items-center space-x-2 mb-2">
                 <CheckCircle className="w-5 h-5 text-green-500" />
                 <h3 className="font-medium text-green-800">On Track</h3>
               </div>
               <p className="text-sm text-green-700">{actionItems.completed} documents completed this month</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceDashboard;
