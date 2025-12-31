import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  Building2,
  TrendingUp,
  FileText,
  ArrowRight,
  Bell,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { ComplianceRing } from '@/components/dashboard/ComplianceRing';
import { MetricChip } from '@/components/dashboard/MetricChip';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSimulation, SimulationTab } from '@/contexts/SimulationContext';
import { formatDistanceToNow } from 'date-fns';

interface SimulationOverviewPageProps {
  onTabChange: (tab: SimulationTab) => void;
}

export const SimulationOverviewPage = ({ onTabChange }: SimulationOverviewPageProps) => {
  const { 
    getSupplierProfile,
    getComplianceStats,
    getExpiringDocuments,
    getActivityTrend,
    documentRequests,
    connectedBuyers,
    pendingConnectionRequest,
  } = useSimulation();
  
  const supplierProfile = getSupplierProfile();
  const stats = getComplianceStats();
  const expiringDocuments = getExpiringDocuments();
  const activityTrend = getActivityTrend();
  
  const pendingRequests = documentRequests.filter(r => r.status === 'pending').length;
  const submittedRequests = documentRequests.filter(r => r.status === 'submitted').length;
  const approvedRequests = documentRequests.filter(r => r.status === 'approved').length;
  const completionRate = documentRequests.length > 0 
    ? Math.round((approvedRequests / documentRequests.length) * 100) 
    : 0;

  const documentStatusData = [
    { name: 'Approved', value: approvedRequests, color: 'hsl(142, 76%, 36%)' },
    { name: 'Pending', value: pendingRequests, color: 'hsl(38, 92%, 50%)' },
    { name: 'Submitted', value: submittedRequests, color: 'hsl(221, 83%, 53%)' },
  ].filter(d => d.value > 0);

  const COLORS = ['hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(221, 83%, 53%)'];

  // Check if there's a pending connection
  const hasPendingConnection = pendingConnectionRequest !== null;

  return (
    <div className="space-y-6">
      {/* Pending Connection Alert */}
      {hasPendingConnection && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-100 rounded-lg animate-pulse">
                    <Bell className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900">You have a pending connection request!</h3>
                    <p className="text-sm text-blue-700">Acme Fresh Foods Inc. wants to connect with you.</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => onTabChange('connections')}
                >
                  View Request
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Welcome Card */}
        <div className="lg:col-span-2">
          <Card className="h-full bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-teal-500/10 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      Welcome back, {supplierProfile.company_name}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                      Here's your compliance overview for today
                    </p>
                  </div>
                  
                  {/* Metric Chips */}
                  <div className="flex flex-wrap gap-3 mt-6">
                    <MetricChip 
                      label="Pending" 
                      value={pendingRequests} 
                      color="amber"
                      pulse={pendingRequests > 0}
                      onClick={() => onTabChange('documents')}
                    />
                    <MetricChip 
                      label="Submitted" 
                      value={submittedRequests} 
                      color="blue"
                      onClick={() => onTabChange('documents')}
                    />
                    <MetricChip 
                      label="Approved" 
                      value={approvedRequests} 
                      color="green"
                      onClick={() => onTabChange('documents')}
                    />
                    <MetricChip 
                      label="Buyers" 
                      value={connectedBuyers.length} 
                      color="purple"
                      onClick={() => onTabChange('connections')}
                    />
                  </div>
                </div>
                
                {/* Company Logo Placeholder */}
                <div className="w-16 h-16 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Ring */}
        <Card className="flex items-center justify-center">
          <CardContent className="p-6 text-center">
            <ComplianceRing score={completionRate} size={140} />
            <p className="text-sm text-muted-foreground mt-2">Completion Rate</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Status Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Document Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentStatusData.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={documentStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {documentStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                  <div className="flex justify-center gap-4 mt-2">
                    {documentStatusData.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <div 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No documents yet
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Activity Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                7-Day Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityTrend}>
                    <defs>
                      <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 12 }} 
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="requests" 
                      stroke="hsl(142, 76%, 36%)" 
                      fillOpacity={1} 
                      fill="url(#colorRequests)" 
                      name="Requests"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Expiring Documents */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Expiring Documents
              <Badge variant="outline" className="ml-2 text-xs">Demo Data</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringDocuments.length > 0 ? (
              <ScrollArea className="h-[180px] pr-4">
                <div className="space-y-3">
                  {expiringDocuments.map((doc) => (
                    <div 
                      key={doc.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        doc.is_expired 
                          ? 'bg-red-50 border-red-200' 
                          : doc.days_until_expiry <= 7 
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          doc.is_expired ? 'bg-red-100' : 'bg-orange-100'
                        }`}>
                          <FileText className={`h-4 w-4 ${
                            doc.is_expired ? 'text-red-600' : 'text-orange-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.buyer_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={doc.is_expired 
                            ? 'bg-red-100 text-red-700 border-red-300' 
                            : 'bg-orange-100 text-orange-700 border-orange-300'
                          }
                        >
                          {doc.is_expired 
                            ? `Expired ${Math.abs(doc.days_until_expiry)}d ago`
                            : `${doc.days_until_expiry}d left`
                          }
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-7 text-xs"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Renew
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-[120px] flex items-center justify-center text-muted-foreground">
                No expiring documents
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Requests */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Recent Requests
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onTabChange('requests')}
              className="text-xs"
            >
              View All
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {documentRequests.slice(0, 3).map((request) => (
                <div 
                  key={request.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      request.status === 'approved' ? 'bg-green-100' :
                      request.status === 'submitted' ? 'bg-blue-100' :
                      'bg-amber-100'
                    }`}>
                      <FileText className={`h-4 w-4 ${
                        request.status === 'approved' ? 'text-green-600' :
                        request.status === 'submitted' ? 'text-blue-600' :
                        'text-amber-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{request.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {request.buyers?.company_name}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline"
                    className={
                      request.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                      request.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }
                  >
                    {request.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
