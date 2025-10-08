import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { differenceInDays, differenceInHours } from 'date-fns';

interface PipelineAnalyticsProps {
  requests: any[];
}

export const PipelineAnalytics = ({ requests }: PipelineAnalyticsProps) => {
  // Calculate metrics
  const calculateMetrics = () => {
    const total = requests.length;
    const byStatus = {
      invited: requests.filter(r => r.status === 'pending').length,
      started: requests.filter(r => r.status === 'onboarding_initiated').length,
      underReview: requests.filter(r => r.status === 'under_review').length,
      approved: requests.filter(r => r.status === 'approved').length,
      declined: requests.filter(r => r.status === 'declined').length,
    };
    
    // Conversion rates
    const startedConversion = byStatus.invited > 0 ? ((byStatus.started / byStatus.invited) * 100).toFixed(1) : '0';
    const reviewConversion = byStatus.started > 0 ? ((byStatus.underReview / byStatus.started) * 100).toFixed(1) : '0';
    const approvalConversion = byStatus.underReview > 0 ? ((byStatus.approved / byStatus.underReview) * 100).toFixed(1) : '0';
    const overallConversion = total > 0 ? ((byStatus.approved / total) * 100).toFixed(1) : '0';
    
    // Time metrics
    const completedRequests = requests.filter(r => r.status === 'approved');
    const avgTimeToComplete = completedRequests.length > 0
      ? completedRequests.reduce((sum, r) => {
          return sum + differenceInDays(new Date(r.responded_at || new Date()), new Date(r.created_at));
        }, 0) / completedRequests.length
      : 0;
    
    // Time in current stage
    const avgTimeInStage = requests.reduce((acc, r) => {
      const referenceDate = r.responded_at || new Date();
      const days = differenceInDays(new Date(referenceDate), new Date(r.created_at));
      acc[r.status] = (acc[r.status] || []).concat(days);
      return acc;
    }, {} as Record<string, number[]>);
    
    const avgByStage = Object.entries(avgTimeInStage).map(([status, days]) => {
      const daysArray = days as number[];
      return {
        status,
        avgDays: (daysArray.reduce((a, b) => a + b, 0) / daysArray.length).toFixed(1)
      };
    });
    
    // Bottlenecks - requests waiting > 7 days
    const bottlenecks = requests.filter(r => {
      const referenceDate = r.responded_at || new Date();
      return differenceInDays(new Date(referenceDate), new Date(r.created_at)) > 7 && r.status !== 'approved' && r.status !== 'declined';
    }).length;
    
    return {
      total,
      byStatus,
      conversions: { startedConversion, reviewConversion, approvalConversion, overallConversion },
      avgTimeToComplete: avgTimeToComplete.toFixed(1),
      avgByStage,
      bottlenecks
    };
  };
  
  const metrics = calculateMetrics();
  
  // Data for charts
  const statusDistribution = [
    { name: 'Invited', value: metrics.byStatus.invited, color: 'hsl(var(--chart-1))' },
    { name: 'Started', value: metrics.byStatus.started, color: 'hsl(var(--chart-2))' },
    { name: 'Under Review', value: metrics.byStatus.underReview, color: 'hsl(var(--chart-3))' },
    { name: 'Approved', value: metrics.byStatus.approved, color: 'hsl(var(--chart-4))' },
    { name: 'Declined', value: metrics.byStatus.declined, color: 'hsl(var(--chart-5))' },
  ].filter(item => item.value > 0);
  
  const conversionFunnel = [
    { stage: 'Invited', count: metrics.byStatus.invited, conversion: 100 },
    { stage: 'Started', count: metrics.byStatus.started, conversion: parseFloat(metrics.conversions.startedConversion) },
    { stage: 'Review', count: metrics.byStatus.underReview, conversion: parseFloat(metrics.conversions.reviewConversion) },
    { stage: 'Approved', count: metrics.byStatus.approved, conversion: parseFloat(metrics.conversions.approvalConversion) },
  ];
  
  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Conversion</p>
                <p className="text-2xl font-bold">{metrics.conversions.overallConversion}%</p>
              </div>
              {parseFloat(metrics.conversions.overallConversion) > 50 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Time to Complete</p>
                <p className="text-2xl font-bold">{metrics.avgTimeToComplete} days</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{metrics.byStatus.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bottlenecks</p>
                <p className="text-2xl font-bold">{metrics.bottlenecks}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Conversion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={conversionFunnel}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
