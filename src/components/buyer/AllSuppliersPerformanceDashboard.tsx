import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSupplierPerformance } from '@/hooks/useSupplierPerformance';
import { TrendingUp, TrendingDown, Minus, Search, AlertTriangle, CheckCircle2, Clock, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function AllSuppliersPerformanceDashboard() {
  const { profile } = useAuth();
  const [buyerId, setBuyerId] = useState<string>();
  const { performance, loading } = useSupplierPerformance(buyerId);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('compliance');

  useEffect(() => {
    const fetchBuyerId = async () => {
      if (profile) {
        const { data } = await supabase
          .from('buyers')
          .select('id')
          .eq('profile_id', profile.id)
          .single();
        if (data) setBuyerId(data.id);
      }
    };
    fetchBuyerId();
  }, [profile]);

  // Calculate aggregate statistics
  const stats = {
    totalSuppliers: performance.length,
    avgCompliance: performance.length > 0
      ? (performance.reduce((sum, p) => sum + Number(p.compliance_score), 0) / performance.length).toFixed(1)
      : '0',
    avgResponseTime: performance.length > 0
      ? (performance.reduce((sum, p) => sum + Number(p.response_time_avg || 0), 0) / performance.length).toFixed(1)
      : '0',
    criticalRisk: performance.filter(p => p.risk_level === 'critical').length,
    highRisk: performance.filter(p => p.risk_level === 'high').length,
    mediumRisk: performance.filter(p => p.risk_level === 'medium').length,
    lowRisk: performance.filter(p => p.risk_level === 'low').length,
  };

  // Filter and sort suppliers
  const filteredSuppliers = performance
    .filter(p => {
      const matchesSearch = p.supplier?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const matchesRisk = riskFilter === 'all' || p.risk_level === riskFilter;
      return matchesSearch && matchesRisk;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'compliance':
          return Number(b.compliance_score) - Number(a.compliance_score);
        case 'risk':
          const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return riskOrder[b.risk_level] - riskOrder[a.risk_level];
        case 'response':
          return Number(a.response_time_avg) - Number(b.response_time_avg);
        default:
          return 0;
      }
    });

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-success" />;
      case 'declining': return <TrendingDown className="w-4 h-4 text-danger" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading performance data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSuppliers}</div>
            <p className="text-xs text-muted-foreground mt-1">Active suppliers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgCompliance}%</div>
            <p className="text-xs text-muted-foreground mt-1">Across all suppliers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(Number(stats.avgResponseTime) / 24).toFixed(1)}d</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.avgResponseTime} hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{stats.criticalRisk + stats.highRisk}</div>
            <p className="text-xs text-muted-foreground mt-1">Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-4 border rounded-lg">
              <AlertTriangle className="w-8 h-8 text-danger mb-2" />
              <div className="text-2xl font-bold">{stats.criticalRisk}</div>
              <Badge variant="destructive" className="mt-2">Critical</Badge>
            </div>
            <div className="flex flex-col items-center p-4 border rounded-lg">
              <AlertTriangle className="w-8 h-8 text-warning mb-2" />
              <div className="text-2xl font-bold">{stats.highRisk}</div>
              <Badge variant="destructive" className="mt-2">High</Badge>
            </div>
            <div className="flex flex-col items-center p-4 border rounded-lg">
              <Clock className="w-8 h-8 text-warning mb-2" />
              <div className="text-2xl font-bold">{stats.mediumRisk}</div>
              <Badge variant="default" className="mt-2">Medium</Badge>
            </div>
            <div className="flex flex-col items-center p-4 border rounded-lg">
              <CheckCircle2 className="w-8 h-8 text-success mb-2" />
              <div className="text-2xl font-bold">{stats.lowRisk}</div>
              <Badge variant="secondary" className="mt-2">Low</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Performance Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="risk">Risk Level</SelectItem>
                <SelectItem value="response">Response Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-center">Compliance Score</TableHead>
                  <TableHead className="text-center">Risk Level</TableHead>
                  <TableHead className="text-center">Avg Response</TableHead>
                  <TableHead className="text-center">Documents</TableHead>
                  <TableHead className="text-center">Trend</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No suppliers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{supplier.supplier?.company_name || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">{supplier.supplier?.industry}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-semibold">{Number(supplier.compliance_score).toFixed(1)}%</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getRiskBadgeVariant(supplier.risk_level)}>
                          {supplier.risk_level.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div>{(Number(supplier.response_time_avg || 0) / 24).toFixed(1)}d</div>
                        <div className="text-xs text-muted-foreground">{Number(supplier.response_time_avg || 0).toFixed(0)}h</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{supplier.total_requests}</div>
                            <div className="text-xs text-muted-foreground">
                              {supplier.approved_requests}✓ {supplier.pending_requests}⏳
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getTrendIcon(supplier.trend_direction)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">View Details</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
