import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Building2,
  FileText,
  Send,
  RefreshCw,
  Upload,
  Calendar,
  ArrowUpRight
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, differenceInDays, isPast } from 'date-fns';

export const SimulationCompliancePage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const { 
    getComplianceStats,
    documentRequests,
    connectedBuyers,
    getExpiringDocuments,
    getActivityTrend,
    documentUploads,
  } = useSimulation();
  
  const stats = getComplianceStats();
  const expiringDocs = getExpiringDocuments();
  const activityTrend = getActivityTrend();

  const statusData = [
    { name: 'Approved', value: stats.approved, color: 'hsl(142, 76%, 36%)' },
    { name: 'Submitted', value: stats.submitted, color: 'hsl(221, 83%, 53%)' },
    { name: 'Pending', value: stats.pending, color: 'hsl(38, 92%, 50%)' },
    { name: 'Rejected', value: stats.rejected, color: 'hsl(0, 84%, 60%)' },
  ].filter(d => d.value > 0);

  // Get urgent actions - pending requests sorted by due date
  const urgentActions = documentRequests
    .filter(r => r.status === 'pending')
    .map(req => {
      const daysLeft = differenceInDays(new Date(req.due_date), new Date());
      return { ...req, daysLeft };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Recent activity from document uploads
  const recentActivity = documentUploads
    .slice(0, 5)
    .map(upload => ({
      id: upload.id,
      action: upload.status === 'approved' ? 'Document approved' : 
              upload.status === 'submitted' ? 'Document submitted' : 'Document uploaded',
      document: upload.file_name,
      status: upload.status,
      date: upload.created_at,
    }));

  // Compliance by buyer
  const complianceByBuyer = connectedBuyers.map(conn => {
    const buyerRequests = documentRequests.filter(r => r.buyer_id === conn.buyer_id);
    const approved = buyerRequests.filter(r => r.status === 'approved').length;
    const total = buyerRequests.length;
    return {
      name: conn.buyers.company_name,
      approved,
      total,
      rate: total > 0 ? Math.round((approved / total) * 100) : 0,
    };
  });

  const getUrgencyColor = (daysLeft: number) => {
    if (daysLeft < 0) return 'bg-red-500 text-white';
    if (daysLeft <= 3) return 'bg-red-100 text-red-700';
    if (daysLeft <= 7) return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Compliance Dashboard
            <Badge variant="outline" className="text-xs">Demo Data</Badge>
          </h1>
          <p className="text-muted-foreground">Monitor your compliance status across all buyers</p>
        </div>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* 5 Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-2">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle cx="32" cy="32" r="28" stroke="hsl(var(--muted))" strokeWidth="6" fill="none" />
                        <circle 
                          cx="32" cy="32" r="28" 
                          stroke="hsl(142, 76%, 36%)" 
                          strokeWidth="6" 
                          fill="none"
                          strokeDasharray={`${stats.complianceRate * 1.76} 176`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                        {stats.complianceRate}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Compliance Score</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
                      <p className="text-sm text-muted-foreground">Pending Requests</p>
                      <p className="text-xs text-amber-600">Need attention</p>
                    </div>
                    <div className="p-3 rounded-full bg-amber-100">
                      <Clock className="h-6 w-6 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
                      <p className="text-sm text-muted-foreground">Approved Docs</p>
                      <p className="text-xs text-green-600">Successfully approved</p>
                    </div>
                    <div className="p-3 rounded-full bg-green-100">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-blue-600">{stats.totalRequests}</p>
                      <p className="text-sm text-muted-foreground">Total Uploads</p>
                      <p className="text-xs text-blue-600">Documents uploaded</p>
                    </div>
                    <div className="p-3 rounded-full bg-blue-100">
                      <Upload className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-purple-600">{stats.connectedBuyers}</p>
                      <p className="text-sm text-muted-foreground">Connected Buyers</p>
                      <p className="text-xs text-purple-600">Active partnerships</p>
                    </div>
                    <div className="p-3 rounded-full bg-purple-100">
                      <Building2 className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Urgent Actions & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Urgent Actions */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Urgent Actions Required
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {urgentActions.length > 0 ? (
                    <div className="space-y-3">
                      {urgentActions.slice(0, 5).map((action) => (
                        <div key={action.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{action.title}</p>
                              <p className="text-xs text-muted-foreground">{action.document_type}</p>
                            </div>
                          </div>
                          <Badge className={getUrgencyColor(action.daysLeft)}>
                            {action.daysLeft < 0 
                              ? `${Math.abs(action.daysLeft)}d overdue`
                              : `${action.daysLeft}d left`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>No urgent actions required</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Activity */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            {activity.status === 'approved' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : activity.status === 'submitted' ? (
                              <Send className="h-4 w-4 text-blue-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500" />
                            )}
                            <div>
                              <p className="font-medium text-sm">{activity.action}</p>
                              <p className="text-xs text-muted-foreground">{activity.document}</p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(activity.date), 'MMM d')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No recent activity</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Compliance by Buyer</CardTitle>
            </CardHeader>
            <CardContent>
              {complianceByBuyer.length > 0 ? (
                <div className="space-y-4">
                  {complianceByBuyer.map((buyer) => (
                    <div key={buyer.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{buyer.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {buyer.approved}/{buyer.total} ({buyer.rate}%)
                        </span>
                      </div>
                      <Progress value={buyer.rate} className="h-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No buyer data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Document Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
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
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Activity Trend (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {activityTrend.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activityTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                        <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area 
                          type="monotone" 
                          dataKey="uploads" 
                          stroke="hsl(221, 83%, 53%)" 
                          fill="hsl(221, 83%, 53%, 0.2)" 
                          name="Uploads"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="approvals" 
                          stroke="hsl(142, 76%, 36%)" 
                          fill="hsl(142, 76%, 36%, 0.2)" 
                          name="Approvals"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
