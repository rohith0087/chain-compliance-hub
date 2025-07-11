
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, RefreshCw, TrendingUp, Users, BarChart3 } from 'lucide-react';
import AnalyticsFilters from './AnalyticsFilters';
import BuyerComparisonCharts from './BuyerComparisonCharts';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';

const EnhancedAnalyticsDashboard = () => {
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState('30d');
  const [category, setCategory] = useState('');
  const [comparisonMode, setComparisonMode] = useState(false);

  const { buyers, buyerMetrics, loading, error, loadAnalyticsData } = useAnalyticsData();

  // Load data on component mount and when filters change
  useEffect(() => {
    loadAnalyticsData(selectedBuyers, dateRange, category);
  }, [selectedBuyers, dateRange, category]);

  const handleRefresh = () => {
    loadAnalyticsData(selectedBuyers, dateRange, category);
  };

  const handleExport = () => {
    // Create CSV data
    const csvData = [
      ['Buyer', 'Industry', 'Compliance Rate', 'Total Requests', 'Approved', 'Pending', 'Rejected', 'Avg Response Time'],
      ...buyerMetrics.map(buyer => [
        buyer.buyerName,
        buyer.industry,
        `${buyer.complianceRate}%`,
        buyer.totalRequests.toString(),
        buyer.approvedRequests.toString(),
        buyer.pendingRequests.toString(),
        buyer.rejectedRequests.toString(),
        `${buyer.avgResponseTime.toFixed(1)} days`
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate summary metrics
  const summaryMetrics = {
    totalBuyers: buyers.length,
    selectedBuyers: selectedBuyers.length || buyers.length,
    avgCompliance: buyerMetrics.length > 0 
      ? Math.round(buyerMetrics.reduce((sum, buyer) => sum + buyer.complianceRate, 0) / buyerMetrics.length)
      : 0,
    totalRequests: buyerMetrics.reduce((sum, buyer) => sum + buyer.totalRequests, 0),
    avgResponseTime: buyerMetrics.length > 0
      ? buyerMetrics.reduce((sum, buyer) => sum + buyer.avgResponseTime, 0) / buyerMetrics.length
      : 0
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Loading analytics data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Compliance Analytics</h2>
          <p className="text-gray-600">Compare performance across buyers and track trends</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <AnalyticsFilters
        buyers={buyers}
        selectedBuyers={selectedBuyers}
        onBuyersChange={setSelectedBuyers}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        category={category}
        onCategoryChange={setCategory}
        comparisonMode={comparisonMode}
        onComparisonModeChange={setComparisonMode}
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Buyers</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryMetrics.selectedBuyers}</div>
            <p className="text-xs text-muted-foreground">
              {selectedBuyers.length > 0 ? 'Selected' : 'Total'} buyers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Compliance</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summaryMetrics.avgCompliance}%</div>
            <p className="text-xs text-muted-foreground">
              Across {comparisonMode ? 'selected' : 'all'} buyers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryMetrics.totalRequests}</div>
            <p className="text-xs text-muted-foreground">
              In selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryMetrics.avgResponseTime.toFixed(1)} days</div>
            <p className="text-xs text-muted-foreground">
              Average time to respond
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analysis */}
      {buyerMetrics.length > 0 ? (
        <BuyerComparisonCharts 
          buyerMetrics={buyerMetrics}
          comparisonMode={comparisonMode}
        />
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-500">
              {selectedBuyers.length > 0 
                ? "No data found for the selected buyers and filters."
                : "No document requests found for the selected filters."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EnhancedAnalyticsDashboard;
