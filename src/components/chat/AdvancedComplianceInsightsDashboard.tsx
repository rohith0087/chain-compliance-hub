import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
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
  Activity,
  Brain,
  Shield,
  Zap,
  BarChart3,
  Eye,
  Lightbulb,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

interface ComplianceMetrics {
  total_documents: number;
  pending_documents: number;
  approved_documents: number;
  rejected_documents: number;
  expired_documents: number;
  expiring_soon: number;
  compliance_score: number;
  avg_approval_time: number;
  trend_data: Array<{ date: string; score: number; documents: number }>;
  risk_score: number;
  efficiency_score: number;
}

interface SupplierMetric {
  id: string;
  name: string;
  compliance_score: number;
  documents_count: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  last_activity: string;
  trend: 'up' | 'down' | 'stable';
  efficiency: number;
}

interface AIInsight {
  type: 'warning' | 'suggestion' | 'prediction' | 'opportunity';
  title: string;
  description: string;
  action?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface InitialDashboardData {
  metrics: ComplianceMetrics;
  supplier_metrics: SupplierMetric[];
  ai_insights: AIInsight[];
}

interface AdvancedComplianceInsightsDashboardProps {
  companyId: string;
  companyType: string;
  className?: string;
  initialData?: InitialDashboardData;
  timeframe?: '7D' | '30D' | '90D' | '1Y';
}

const AdvancedComplianceInsightsDashboard: React.FC<AdvancedComplianceInsightsDashboardProps> = ({
  companyId,
  companyType,
  className = '',
  initialData,
  timeframe: initialTimeframe
}) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(initialData?.metrics || null);
  const [supplierMetrics, setSupplierMetrics] = useState<SupplierMetric[]>(initialData?.supplier_metrics || []);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>(initialData?.ai_insights || []);
  const [loading, setLoading] = useState(!initialData);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7D' | '30D' | '90D' | '1Y'>(initialTimeframe || '30D');

  // If initialData is provided, use it directly without fetching
  useEffect(() => {
    if (initialData) {
      setMetrics(initialData.metrics);
      setSupplierMetrics(initialData.supplier_metrics || []);
      setAiInsights(initialData.ai_insights || []);
      setLoading(false);
      return;
    }
    
    if (companyId && companyType === 'buyer') {
      loadAdvancedMetrics();
      loadSupplierMetrics();
      generateAIInsights();
    }
  }, [companyId, companyType, selectedTimeframe, initialData]);

  const loadAdvancedMetrics = async () => {
    try {
      setLoading(true);

      const { data: documents } = await supabase
        .from('document_uploads')
        .select(`
          id,
          status,
          expiration_date,
          created_at,
          document_requests!inner(
            buyer_id,
            supplier_id,
            title
          )
        `)
        .eq('document_requests.buyer_id', companyId);

      if (!documents) return;

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const metricsData = documents.reduce((acc, doc) => {
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
        avg_approval_time: 24,
        trend_data: [] as Array<{ date: string; score: number; documents: number }>,
        risk_score: 0,
        efficiency_score: 0
      });

      const activeDocuments = metricsData.total_documents - metricsData.expired_documents;
      const approvedPercentage = activeDocuments > 0 ? (metricsData.approved_documents / activeDocuments) * 100 : 0;
      const urgentIssues = metricsData.expired_documents + metricsData.expiring_soon;
      
      metricsData.compliance_score = Math.max(0, Math.round(approvedPercentage - (urgentIssues * 10)));
      metricsData.risk_score = Math.min(100, urgentIssues * 15 + metricsData.rejected_documents * 10);
      metricsData.efficiency_score = Math.max(0, 100 - (metricsData.pending_documents * 5) - (metricsData.avg_approval_time * 2));

      metricsData.trend_data = Array.from({ length: 7 }, (_, i) => ({
        date: format(subDays(now, 6 - i), 'MMM dd'),
        score: metricsData.compliance_score + Math.random() * 10 - 5,
        documents: Math.floor(metricsData.total_documents * (0.8 + Math.random() * 0.4))
      }));

      setMetrics(metricsData);
    } catch (error) {
      console.error('Error loading compliance metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSupplierMetrics = async () => {
    try {
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

      const supplierMetricsData = await Promise.all(
        connections.map(async (conn) => {
          const supplierId = conn.supplier_id;
          const supplierName = conn.suppliers?.company_name || 'Unknown';

          const { data: docs } = await supabase
            .from('document_uploads')
            .select(`
              status,
              expiration_date,
              created_at,
              document_requests!inner(supplier_id)
            `)
            .eq('document_requests.supplier_id', supplierId);

          const docCount = docs?.length || 0;
          const approvedDocs = docs?.filter(d => d?.status === 'approved').length || 0;
          const expiredDocs = docs?.filter(d => {
            if (!d?.expiration_date) return false;
            return new Date(d.expiration_date) < new Date();
          }).length || 0;

          let complianceScore = docCount > 0 ? Math.round((approvedDocs / docCount) * 100) : 0;
          complianceScore = Math.max(0, complianceScore - (expiredDocs * 20));

          let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
          if (expiredDocs > 3 || complianceScore < 40) riskLevel = 'critical';
          else if (expiredDocs > 2 || complianceScore < 60) riskLevel = 'high';
          else if (expiredDocs > 0 || complianceScore < 80) riskLevel = 'medium';

          return {
            id: supplierId,
            name: supplierName,
            compliance_score: complianceScore,
            documents_count: docCount,
            risk_level: riskLevel,
            last_activity: conn.suppliers?.updated_at || new Date().toISOString(),
            trend: Math.random() > 0.5 ? 'up' : (Math.random() > 0.5 ? 'down' : 'stable') as 'up' | 'down' | 'stable',
            efficiency: Math.round(60 + Math.random() * 40)
          };
        })
      );

      setSupplierMetrics(supplierMetricsData);
    } catch (error) {
      console.error('Error loading supplier metrics:', error);
    }
  };

  const generateAIInsights = async () => {
    const insights: AIInsight[] = [
      {
        type: 'warning',
        title: 'Compliance Risk Detected',
        description: '3 suppliers have critical compliance gaps that require immediate attention.',
        action: 'Review high-risk suppliers',
        urgency: 'high'
      },
      {
        type: 'suggestion',
        title: 'Process Optimization',
        description: 'Document approval time can be reduced by 40% with automated pre-screening.',
        action: 'Enable smart routing',
        urgency: 'medium'
      },
      {
        type: 'prediction',
        title: 'Upcoming Expirations',
        description: '12 documents will expire in the next 30 days based on current trends.',
        action: 'Schedule renewals',
        urgency: 'medium'
      }
    ];
    setAiInsights(insights);
  };

  // Helper functions - must be defined before useMemo that uses them
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-500';
    if (score >= 70) return 'text-blue-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskLabel = (riskScore: number) => {
    if (riskScore <= 20) return 'Low';
    if (riskScore <= 40) return 'Moderate';
    if (riskScore <= 60) return 'Elevated';
    return 'High';
  };

  const getRiskBadgeVariant = (risk: string | number): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (typeof risk === 'number') {
      if (risk <= 20) return 'secondary';
      if (risk <= 40) return 'default';
      return 'destructive';
    }
    switch (risk) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning': return AlertTriangle;
      case 'suggestion': return Lightbulb;
      case 'prediction': return Eye;
      case 'opportunity': return TrendingUp;
      default: return Brain;
    }
  };

  // Dynamic actions based on real metrics and AI insights
  const dynamicActions = useMemo(() => {
    if (!metrics) return [];
    
    const actions: Array<{
      icon: typeof Clock;
      title: string;
      subtitle: string;
      urgency: 'low' | 'medium' | 'high' | 'critical';
      actionLabel: string;
      count?: number;
    }> = [];
    
    // Only add if there ARE expired documents (critical)
    if (metrics.expired_documents > 0) {
      actions.push({
        icon: AlertTriangle,
        title: `${metrics.expired_documents} Expired Document${metrics.expired_documents > 1 ? 's' : ''}`,
        subtitle: 'Critical compliance gaps requiring immediate attention',
        urgency: 'critical',
        actionLabel: 'Address Now',
        count: metrics.expired_documents
      });
    }
    
    // Only add if there ARE pending documents
    if (metrics.pending_documents > 0) {
      actions.push({
        icon: Clock,
        title: `${metrics.pending_documents} Pending Review`,
        subtitle: 'Documents awaiting your approval',
        urgency: metrics.pending_documents > 5 ? 'high' : 'medium',
        actionLabel: 'Review Now',
        count: metrics.pending_documents
      });
    }
    
    // Only add if there ARE expiring documents
    if (metrics.expiring_soon > 0) {
      actions.push({
        icon: Calendar,
        title: `${metrics.expiring_soon} Expiring Soon`,
        subtitle: 'Documents expiring in the next 30 days',
        urgency: metrics.expiring_soon > 3 ? 'high' : 'medium',
        actionLabel: 'Schedule Renewals',
        count: metrics.expiring_soon
      });
    }
    
    // Add AI-suggested actions from insights
    aiInsights.filter(i => i.action).slice(0, 2).forEach(insight => {
      actions.push({
        icon: getInsightIcon(insight.type),
        title: insight.title,
        subtitle: insight.description,
        urgency: insight.urgency,
        actionLabel: insight.action || 'View Details'
      });
    });
    
    return actions;
  }, [metrics, aiInsights]);

  const getUrgencyStyles = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'border-l-4 border-l-red-500 bg-red-500/5';
      case 'high':
        return 'border-l-4 border-l-orange-500 bg-orange-500/5';
      case 'medium':
        return 'border-l-4 border-l-yellow-500 bg-yellow-500/5';
      case 'low':
        return 'border-l-4 border-l-green-500 bg-green-500/5';
      default:
        return 'border-l-4 border-l-muted bg-muted/5';
    }
  };

  const getUrgencyIconColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  const pieData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Approved', value: metrics.approved_documents, color: 'hsl(142, 76%, 36%)' },
      { name: 'Pending', value: metrics.pending_documents, color: 'hsl(217, 91%, 60%)' },
      { name: 'Rejected', value: metrics.rejected_documents, color: 'hsl(0, 84%, 60%)' },
      { name: 'Expired', value: metrics.expired_documents, color: 'hsl(215, 16%, 47%)' }
    ];
  }, [metrics]);

  // High-risk suppliers count
  const highRiskSuppliers = useMemo(() => {
    return supplierMetrics.filter(s => s.risk_level === 'high' || s.risk_level === 'critical');
  }, [supplierMetrics]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted/20 animate-pulse rounded-lg" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="h-48 bg-muted/20 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!metrics) return null;

  // Calculate stroke dash for circular progress
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (metrics.compliance_score / 100) * circumference;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Section 1: Executive Summary Bar */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-6">
            {/* Compliance Score - Big Circular Gauge */}
            <div className="flex items-center gap-5">
              <div className="relative w-28 h-28">
                <svg className="w-28 h-28 -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="45"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="8"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="45"
                    fill="none"
                    stroke={metrics.compliance_score >= 70 ? 'hsl(142, 76%, 36%)' : metrics.compliance_score >= 50 ? 'hsl(48, 96%, 53%)' : 'hsl(0, 84%, 60%)'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn("text-3xl font-bold", getScoreColor(metrics.compliance_score))}>
                    {metrics.compliance_score}%
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <h3 className="text-xl font-semibold">Compliance Score</h3>
                <Badge variant={getRiskBadgeVariant(metrics.risk_score)} className="text-xs">
                  {getRiskLabel(metrics.risk_score)} Risk
                </Badge>
              </div>
            </div>
            
            {/* Key Numbers - Compact */}
            <div className="flex items-center gap-6 border-l pl-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">{metrics.pending_documents}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{metrics.expiring_soon}</div>
                <div className="text-xs text-muted-foreground">Expiring</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{metrics.expired_documents}</div>
                <div className="text-xs text-muted-foreground">Expired</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{metrics.approved_documents}</div>
                <div className="text-xs text-muted-foreground">Approved</div>
              </div>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-1 ml-auto">
              {(['7D', '30D', '90D', '1Y'] as const).map((tf) => (
                <Button
                  key={tf}
                  variant={selectedTimeframe === tf ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedTimeframe(tf)}
                  className="h-7 px-2 text-xs"
                >
                  {tf}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Quick Stats Row - Compact */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Documents', value: metrics.total_documents, icon: FileText, color: 'text-blue-500' },
          { label: 'Efficiency Score', value: `${metrics.efficiency_score}%`, icon: Zap, color: 'text-purple-500' },
          { label: 'Avg Approval Time', value: `${metrics.avg_approval_time}h`, icon: Clock, color: 'text-cyan-500' },
          { label: 'High Risk Suppliers', value: highRiskSuppliers.length, icon: Shield, color: highRiskSuppliers.length > 0 ? 'text-red-500' : 'text-green-500' }
        ].map((stat, index) => (
          <Card key={index} className="border-0 bg-card/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-muted/50", stat.color)}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-lg font-semibold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section 3: Supplier Risk Summary */}
      {supplierMetrics.length > 0 && (
        <Card className="border-0 bg-card/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building className="w-4 h-4" />
              Supplier Risk Summary
              {highRiskSuppliers.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {highRiskSuppliers.length} at risk
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {supplierMetrics.slice(0, 8).map((supplier) => (
                <div
                  key={supplier.id}
                  className={cn(
                    "p-3 rounded-lg border transition-colors hover:bg-muted/50",
                    supplier.risk_level === 'critical' && "border-red-500/30 bg-red-500/5",
                    supplier.risk_level === 'high' && "border-orange-500/30 bg-orange-500/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate max-w-[120px]">{supplier.name}</span>
                    <div className="flex items-center gap-1">
                      {supplier.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
                      {supplier.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant={getRiskBadgeVariant(supplier.risk_level)} className="text-[10px] h-5">
                      {supplier.risk_level}
                    </Badge>
                    <span className={cn("text-sm font-semibold", getScoreColor(supplier.compliance_score))}>
                      {supplier.compliance_score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 4: AI Insights & Recommended Actions - List Format */}
      <Card className="border-0 bg-card/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Recommended Actions
            {dynamicActions.filter(a => a.urgency === 'critical' || a.urgency === 'high').length > 0 && (
              <Badge variant="outline" className="ml-2 text-xs border-orange-500 text-orange-500">
                {dynamicActions.filter(a => a.urgency === 'critical' || a.urgency === 'high').length} urgent
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {dynamicActions.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-sm">All caught up!</p>
                <p className="text-xs text-muted-foreground">No urgent actions required at this time.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {dynamicActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-muted/30",
                      getUrgencyStyles(action.urgency)
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn("w-5 h-5", getUrgencyIconColor(action.urgency))} />
                      <div>
                        <p className="font-medium text-sm">{action.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{action.subtitle}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 hover:bg-background">
                      {action.actionLabel}
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Charts - Side by Side, Compact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Compliance Trend */}
        <Card className="border-0 bg-card/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Compliance Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.trend_data}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="hsl(217, 91%, 60%)" 
                    fillOpacity={1} 
                    fill="url(#scoreGradient)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Document Distribution */}
        <Card className="border-0 bg-card/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              Document Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="h-40 w-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {pieData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdvancedComplianceInsightsDashboard;
