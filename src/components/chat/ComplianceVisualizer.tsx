import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, FileX } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ComplianceVisualData {
  type: 'compliance_dashboard' | 'document_status_chart' | 'expiration_timeline' | 'supplier_comparison';
  data: any;
  config?: any;
}

interface ComplianceVisualizerProps {
  visualData: ComplianceVisualData;
}

const COLORS = {
  approved: 'hsl(var(--success))',
  pending: 'hsl(var(--warning))',
  rejected: 'hsl(var(--destructive))',
  expired: 'hsl(var(--destructive-foreground))',
  expiring: 'hsl(var(--orange))'
};

const ComplianceVisualizer: React.FC<ComplianceVisualizerProps> = ({ visualData }) => {
  const renderComplianceDashboard = (data: any) => {
    const statusData = [
      { name: 'Approved', value: data.document_status.approved, color: COLORS.approved },
      { name: 'Pending', value: data.document_status.pending, color: COLORS.pending },
      { name: 'Rejected', value: data.document_status.rejected, color: COLORS.rejected },
      { name: 'Expired', value: data.document_status.expired, color: COLORS.expired }
    ];

    const getTrendIcon = (trend: string) => {
      switch (trend) {
        case 'positive': return <TrendingUp className="h-4 w-4 text-success" />;
        case 'negative': return <TrendingDown className="h-4 w-4 text-destructive" />;
        default: return <Clock className="h-4 w-4 text-warning" />;
      }
    };

    const getScoreColor = (score: number) => {
      if (score >= 85) return 'text-success';
      if (score >= 70) return 'text-warning';
      return 'text-destructive';
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Compliance Score Card */}
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            {getTrendIcon(data.trend)}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(data.compliance_score)}`}>
              {data.compliance_score}%
            </div>
            <Progress value={data.compliance_score} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {data.compliance_score >= 85 ? 'Excellent compliance' : 
               data.compliance_score >= 70 ? 'Good compliance' : 'Needs attention'}
            </p>
          </CardContent>
        </Card>

        {/* Urgent Items Card */}
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{data.urgent_items}</div>
            <p className="text-xs text-muted-foreground">
              Documents requiring immediate attention
            </p>
          </CardContent>
        </Card>

        {/* Document Status Chart */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Document Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <Badge variant="secondary">{item.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSupplierComparison = (data: any) => {
    const riskBadgeVariant = data.risk_level === 'low' ? 'default' : 
                            data.risk_level === 'medium' ? 'secondary' : 'destructive';
    
    const statusData = [
      { name: 'Total', value: data.document_breakdown.total, icon: FileX },
      { name: 'Approved', value: data.document_breakdown.approved, icon: CheckCircle },
      { name: 'Pending', value: data.document_breakdown.pending, icon: Clock },
      { name: 'Expired', value: data.document_breakdown.expired, icon: AlertTriangle }
    ];

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{data.supplier_name} Compliance Overview</span>
              <Badge variant={riskBadgeVariant}>
                {data.risk_level.toUpperCase()} RISK
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statusData.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.name} className="text-center">
                    <Icon className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <div className="text-2xl font-bold">{item.value}</div>
                    <div className="text-xs text-muted-foreground">{item.name}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Progress value={data.compliance_score} className="flex-1" />
              <span className="text-lg font-semibold">{Math.round(data.compliance_score)}%</span>
            </div>
            {data.compliance_score < 70 && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Attention Required</AlertTitle>
                <AlertDescription>
                  This supplier's compliance score is below acceptable levels. Consider requesting document updates.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  switch (visualData.type) {
    case 'compliance_dashboard':
      return renderComplianceDashboard(visualData.data);
    case 'supplier_comparison':
      return renderSupplierComparison(visualData.data);
    default:
      return (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Visual data type not supported yet.</p>
          </CardContent>
        </Card>
      );
  }
};

export default ComplianceVisualizer;