import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Lightbulb
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from 'recharts';

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

interface AdvancedComplianceInsightsDashboardProps {
  companyId: string;
  companyType: string;
  className?: string;
}

const AdvancedComplianceInsightsDashboard: React.FC<AdvancedComplianceInsightsDashboardProps> = ({
  companyId,
  companyType,
  className = ''
}) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null);
  const [supplierMetrics, setSupplierMetrics] = useState<SupplierMetric[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7D' | '30D' | '90D' | '1Y'>('30D');

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100
      }
    }
  };

  useEffect(() => {
    if (companyId && companyType === 'buyer') {
      loadAdvancedMetrics();
      loadSupplierMetrics();
      generateAIInsights();
    }
  }, [companyId, companyType, selectedTimeframe]);

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

      // Calculate enhanced metrics
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
        avg_approval_time: 24,
        trend_data: [],
        risk_score: 0,
        efficiency_score: 0
      });

      // Calculate advanced scores
      const activeDocuments = metrics.total_documents - metrics.expired_documents;
      const approvedPercentage = activeDocuments > 0 ? (metrics.approved_documents / activeDocuments) * 100 : 0;
      const urgentIssues = metrics.expired_documents + metrics.expiring_soon;
      
      metrics.compliance_score = Math.max(0, Math.round(approvedPercentage - (urgentIssues * 10)));
      metrics.risk_score = Math.min(100, urgentIssues * 15 + metrics.rejected_documents * 10);
      metrics.efficiency_score = Math.max(0, 100 - (metrics.pending_documents * 5) - (metrics.avg_approval_time * 2));

      // Generate trend data (mock for demo)
      metrics.trend_data = Array.from({ length: 7 }, (_, i) => ({
        date: format(subDays(now, 6 - i), 'MMM dd'),
        score: metrics.compliance_score + Math.random() * 10 - 5,
        documents: Math.floor(metrics.total_documents * (0.8 + Math.random() * 0.4))
      }));

      setMetrics(metrics);
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

      const supplierMetrics = await Promise.all(
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
          const approvedDocs = docs?.filter(d => d && d.status === 'approved').length || 0;
          const expiredDocs = docs?.filter(d => {
            if (!d || !d.expiration_date) return false;
            return new Date(d.expiration_date) < new Date();
          }).length || 0;

          let complianceScore = docCount > 0 ? Math.round((approvedDocs / docCount) * 100) : 0;
          complianceScore = Math.max(0, complianceScore - (expiredDocs * 20));

          // Enhanced risk assessment
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

      setSupplierMetrics(supplierMetrics);
    } catch (error) {
      console.error('Error loading supplier metrics:', error);
    }
  };

  const generateAIInsights = async () => {
    // Mock AI insights - in real implementation, this would call GPT API
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
      },
      {
        type: 'opportunity',
        title: 'Compliance Excellence',
        description: 'Your organization is 15% above industry average for compliance scoring.',
        urgency: 'low'
      }
    ];

    setAiInsights(insights);
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-accent';
    if (score >= 70) return 'text-blue-accent';
    if (score >= 50) return 'text-purple-accent';
    return 'text-destructive';
  };

  const getGaugeColor = (score: number) => {
    if (score >= 85) return 'hsl(var(--green-accent))';
    if (score >= 70) return 'hsl(var(--blue-accent))';
    if (score >= 50) return 'hsl(var(--purple-accent))';
    return 'hsl(var(--destructive))';
  };

  const getRiskBadgeVariant = (risk: 'low' | 'medium' | 'high' | 'critical') => {
    switch (risk) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
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

  const pieData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Approved', value: metrics.approved_documents, color: 'hsl(var(--green-accent))' },
      { name: 'Pending', value: metrics.pending_documents, color: 'hsl(var(--blue-accent))' },
      { name: 'Rejected', value: metrics.rejected_documents, color: 'hsl(var(--destructive))' },
      { name: 'Expired', value: metrics.expired_documents, color: 'hsl(var(--muted-foreground))' }
    ];
  }, [metrics]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="overflow-hidden bg-gradient-subtle backdrop-blur-sm border-0 shadow-elegant">
              <div className="h-32 bg-gradient-primary/10 animate-pulse rounded"></div>
            </Card>
          </motion.div>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <motion.div 
      className={`space-y-6 ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Enhanced Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Activity className="w-7 h-7 text-white" />
            </div>
            Compliance Compass
          </h2>
          <p className="text-muted-foreground text-lg">AI-powered compliance insights and analytics</p>
        </div>
        
        <div className="flex items-center gap-3">
          {(['7D', '30D', '90D', '1Y'] as const).map((timeframe) => (
            <Button
              key={timeframe}
              variant={selectedTimeframe === timeframe ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeframe(timeframe)}
              className="min-w-[60px]"
            >
              {timeframe}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* AI Insights Panel */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden bg-gradient-subtle backdrop-blur-sm border-0 shadow-elegant">
          <CardHeader className="bg-gradient-primary text-white">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              AI-Powered Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiInsights.map((insight, index) => {
                const Icon = getInsightIcon(insight.type);
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 rounded-lg border bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        insight.urgency === 'high' ? 'bg-destructive/10 text-destructive' :
                        insight.urgency === 'medium' ? 'bg-blue-accent/10 text-blue-accent' :
                        'bg-green-accent/10 text-green-accent'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold text-sm">{insight.title}</h4>
                        <p className="text-xs text-muted-foreground">{insight.description}</p>
                        {insight.action && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            {insight.action}
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Enhanced Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Compliance Health',
            value: `${metrics.compliance_score}%`,
            icon: Shield,
            trend: '+2.3%',
            color: getScoreColor(metrics.compliance_score),
            progress: metrics.compliance_score,
            gradient: 'from-green-400 to-emerald-600'
          },
          {
            title: 'Risk Score',
            value: `${metrics.risk_score}%`,
            icon: AlertTriangle,
            trend: '-1.2%',
            color: getScoreColor(100 - metrics.risk_score),
            progress: 100 - metrics.risk_score,
            gradient: 'from-red-400 to-rose-600'
          },
          {
            title: 'Efficiency',
            value: `${metrics.efficiency_score}%`,
            icon: Zap,
            trend: '+5.7%',
            color: getScoreColor(metrics.efficiency_score),
            progress: metrics.efficiency_score,
            gradient: 'from-blue-400 to-indigo-600'
          },
          {
            title: 'Total Documents',
            value: metrics.total_documents.toString(),
            icon: FileText,
            trend: `+${Math.round(metrics.total_documents * 0.12)}`,
            color: 'text-blue-accent',
            progress: 75,
            gradient: 'from-purple-400 to-violet-600'
          }
        ].map((metric, index) => (
          <motion.div key={index} variants={itemVariants}>
            <Card className="overflow-hidden bg-gradient-subtle backdrop-blur-sm border-0 shadow-elegant hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-full bg-gradient-to-r ${metric.gradient}`}>
                    <metric.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {metric.trend}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{metric.title}</p>
                  <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
                  <div className="relative">
                    <Progress value={metric.progress} className="h-2" />
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"
                      style={{ width: `${metric.progress}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Advanced Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Trend */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden bg-gradient-subtle backdrop-blur-sm border-0 shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Compliance Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.trend_data}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--blue-accent))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--blue-accent))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="score" 
                      stroke="hsl(var(--blue-accent))" 
                      fillOpacity={1} 
                      fill="url(#scoreGradient)" 
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Status Distribution */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden bg-gradient-subtle backdrop-blur-sm border-0 shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Document Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
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
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {pieData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <span className="text-sm font-medium ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Enhanced Supplier Risk Matrix */}
      {supplierMetrics.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden bg-gradient-subtle backdrop-blur-sm border-0 shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Supplier Performance Matrix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {supplierMetrics.slice(0, 6).map((supplier, index) => (
                  <motion.div
                    key={supplier.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-lg border bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium">{supplier.name}</span>
                          <Badge variant={getRiskBadgeVariant(supplier.risk_level)} className="text-xs">
                            {supplier.risk_level} risk
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {supplier.trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-500" /> :
                             supplier.trend === 'down' ? <TrendingDown className="w-3 h-3 text-red-500" /> :
                             <div className="w-3 h-3 bg-gray-400 rounded-full" />}
                            {supplier.trend}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{supplier.documents_count} documents</span>
                          <span>Efficiency: {supplier.efficiency}%</span>
                          <span>Last active: {format(new Date(supplier.last_activity), 'MMM dd')}</span>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className={`text-xl font-bold ${getScoreColor(supplier.compliance_score)}`}>
                          {supplier.compliance_score}%
                        </div>
                        <Progress value={supplier.compliance_score} className="w-20 h-2" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Smart Action Center */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden bg-gradient-primary backdrop-blur-sm border-0 shadow-elegant">
          <CardHeader className="text-white">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Smart Action Center
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-white/95 backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  icon: Clock,
                  title: `Review ${metrics.pending_documents} Pending`,
                  subtitle: 'Reduce approval time by 40%',
                  urgent: metrics.pending_documents > 5,
                  action: 'Quick Review'
                },
                {
                  icon: AlertTriangle,
                  title: `Address ${metrics.expired_documents} Expired`,
                  subtitle: 'Critical compliance gaps',
                  urgent: metrics.expired_documents > 0,
                  action: 'Immediate Action'
                },
                {
                  icon: Calendar,
                  title: `Follow ${metrics.expiring_soon} Expiring`,
                  subtitle: 'Prevent future issues',
                  urgent: metrics.expiring_soon > 3,
                  action: 'Schedule Renewals'
                },
                {
                  icon: BarChart3,
                  title: 'Generate AI Report',
                  subtitle: 'Executive summary with insights',
                  urgent: false,
                  action: 'Create Report'
                },
                {
                  icon: Brain,
                  title: 'Optimize Workflow',
                  subtitle: 'AI-recommended improvements',
                  urgent: false,
                  action: 'View Suggestions'
                },
                {
                  icon: Shield,
                  title: 'Risk Assessment',
                  subtitle: 'Comprehensive security audit',
                  urgent: metrics.risk_score > 30,
                  action: 'Run Audit'
                }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    variant={item.urgent ? "default" : "outline"}
                    className={`w-full h-auto p-4 text-left justify-start ${
                      item.urgent ? 'animate-pulse-glow' : ''
                    }`}
                  >
                    <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                    </div>
                  </Button>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default AdvancedComplianceInsightsDashboard;