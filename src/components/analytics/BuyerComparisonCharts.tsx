
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Building2, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

interface BuyerMetrics {
  buyerId: string;
  buyerName: string;
  complianceRate: number;
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  avgResponseTime: number;
  industry: string;
}

interface BuyerComparisonChartsProps {
  buyerMetrics: BuyerMetrics[];
  comparisonMode: boolean;
}

const BuyerComparisonCharts = ({ buyerMetrics, comparisonMode }: BuyerComparisonChartsProps) => {
  const chartConfig = {
    compliance: { label: 'Compliance Rate', color: '#10b981' },
    requests: { label: 'Total Requests', color: '#3b82f6' },
    approved: { label: 'Approved', color: '#10b981' },
    pending: { label: 'Pending', color: '#f59e0b' },
    rejected: { label: 'Rejected', color: '#ef4444' },
    responseTime: { label: 'Response Time (days)', color: '#8b5cf6' }
  };

  const getComplianceColor = (rate: number) => {
    if (rate >= 90) return '#10b981';
    if (rate >= 70) return '#f59e0b';
    return '#ef4444';
  };

  if (!comparisonMode) {
    // Standard single-buyer view
    const totalMetrics = buyerMetrics.reduce((acc, buyer) => ({
      totalRequests: acc.totalRequests + buyer.totalRequests,
      approvedRequests: acc.approvedRequests + buyer.approvedRequests,
      pendingRequests: acc.pendingRequests + buyer.pendingRequests,
      rejectedRequests: acc.rejectedRequests + buyer.rejectedRequests,
      avgResponseTime: acc.avgResponseTime + buyer.avgResponseTime
    }), { totalRequests: 0, approvedRequests: 0, pendingRequests: 0, rejectedRequests: 0, avgResponseTime: 0 });

    const avgComplianceRate = buyerMetrics.length > 0 
      ? Math.round(buyerMetrics.reduce((sum, buyer) => sum + buyer.complianceRate, 0) / buyerMetrics.length)
      : 0;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Overall Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">{avgComplianceRate}%</div>
                <div className="text-sm text-gray-600">Avg Compliance</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Building2 className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">{totalMetrics.totalRequests}</div>
                <div className="text-sm text-gray-600">Total Requests</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Approved', value: totalMetrics.approvedRequests, fill: '#10b981' },
                      { name: 'Pending', value: totalMetrics.pendingRequests, fill: '#f59e0b' },
                      { name: 'Rejected', value: totalMetrics.rejectedRequests, fill: '#ef4444' }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="value"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Comparison mode
  return (
    <div className="space-y-6">
      {/* Compliance Rate Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Rate Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buyerMetrics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="buyerName" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="complianceRate" 
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Request Volume Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Request Volume & Status Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buyerMetrics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="buyerName" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="approvedRequests" stackId="a" fill="#10b981" />
                <Bar dataKey="pendingRequests" stackId="a" fill="#f59e0b" />
                <Bar dataKey="rejectedRequests" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Response Time Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Average Response Time Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buyerMetrics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="buyerName" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="avgResponseTime" 
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Detailed Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Buyer</th>
                  <th className="text-left p-2">Industry</th>
                  <th className="text-center p-2">Compliance Rate</th>
                  <th className="text-center p-2">Total Requests</th>
                  <th className="text-center p-2">Approved</th>
                  <th className="text-center p-2">Pending</th>
                  <th className="text-center p-2">Rejected</th>
                  <th className="text-center p-2">Avg Response Time</th>
                </tr>
              </thead>
              <tbody>
                {buyerMetrics.map((buyer) => (
                  <tr key={buyer.buyerId} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{buyer.buyerName}</td>
                    <td className="p-2 text-gray-600">{buyer.industry}</td>
                    <td className="p-2 text-center">
                      <span 
                        className="px-2 py-1 rounded text-white text-xs font-medium"
                        style={{ backgroundColor: getComplianceColor(buyer.complianceRate) }}
                      >
                        {buyer.complianceRate}%
                      </span>
                    </td>
                    <td className="p-2 text-center">{buyer.totalRequests}</td>
                    <td className="p-2 text-center text-green-600">{buyer.approvedRequests}</td>
                    <td className="p-2 text-center text-yellow-600">{buyer.pendingRequests}</td>
                    <td className="p-2 text-center text-red-600">{buyer.rejectedRequests}</td>
                    <td className="p-2 text-center">{buyer.avgResponseTime.toFixed(1)} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BuyerComparisonCharts;
