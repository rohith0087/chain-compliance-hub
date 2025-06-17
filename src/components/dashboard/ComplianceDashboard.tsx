
import { useState, useEffect } from 'react';
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

  // Sample data - in real app this would come from props
  const complianceData = {
    overallScore: 85,
    trend: +12,
    criticalIssues: 3,
    expiringDocuments: 5,
    completionRate: 78,
    avgResponseTime: '2.3 days'
  };

  const statusDistribution = [
    { name: 'Approved', value: 45, color: '#10b981' },
    { name: 'Pending', value: 30, color: '#f59e0b' },
    { name: 'Rejected', value: 15, color: '#ef4444' },
    { name: 'Submitted', value: 10, color: '#3b82f6' }
  ];

  const monthlyTrend = [
    { month: 'Jan', requests: 20, completed: 18 },
    { month: 'Feb', requests: 25, completed: 22 },
    { month: 'Mar', requests: 30, completed: 28 },
    { month: 'Apr', requests: 28, completed: 25 },
    { month: 'May', requests: 35, completed: 32 },
    { month: 'Jun', requests: 32, completed: 30 }
  ];

  const categoryBreakdown = [
    { category: 'Insurance', count: 12, compliance: 85 },
    { category: 'Certifications', count: 8, compliance: 92 },
    { category: 'Financial', count: 6, compliance: 78 },
    { category: 'Safety', count: 10, compliance: 88 },
    { category: 'Quality', count: 7, compliance: 82 }
  ];

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
                      <p className="text-sm text-gray-500">{category.count} documents</p>
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
              <div className="flex items-center justify-between p-3 border rounded-lg border-red-200 bg-red-50">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="font-medium">ISO 9001 Certificate</p>
                    <p className="text-sm text-gray-500">Quality Management</p>
                  </div>
                </div>
                <Badge variant="destructive">Due in 2 days</Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg border-yellow-200 bg-yellow-50">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">Insurance Policy</p>
                    <p className="text-sm text-gray-500">General Liability</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Due in 5 days</Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Safety Training Records</p>
                    <p className="text-sm text-gray-500">Annual Update</p>
                  </div>
                </div>
                <Badge variant="outline">Due in 10 days</Badge>
              </div>
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
              <p className="text-sm text-red-700">3 documents require immediate attention</p>
            </div>
            
            <div className="p-4 border rounded-lg border-yellow-200 bg-yellow-50">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                <h3 className="font-medium text-yellow-800">Upcoming</h3>
              </div>
              <p className="text-sm text-yellow-700">5 documents due within 7 days</p>
            </div>
            
            <div className="p-4 border rounded-lg border-green-200 bg-green-50">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h3 className="font-medium text-green-800">On Track</h3>
              </div>
              <p className="text-sm text-green-700">12 documents completed this month</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceDashboard;
