import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Building2,
  FileText,
  Send
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export const SimulationCompliancePage = () => {
  const { 
    getComplianceStats,
    documentRequests,
    connectedBuyers,
  } = useSimulation();
  
  const stats = getComplianceStats();

  const statusData = [
    { name: 'Approved', value: stats.approved, color: 'hsl(142, 76%, 36%)' },
    { name: 'Submitted', value: stats.submitted, color: 'hsl(221, 83%, 53%)' },
    { name: 'Pending', value: stats.pending, color: 'hsl(38, 92%, 50%)' },
    { name: 'Rejected', value: stats.rejected, color: 'hsl(0, 84%, 60%)' },
  ].filter(d => d.value > 0);

  const COLORS = ['hsl(142, 76%, 36%)', 'hsl(221, 83%, 53%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

  // Compliance by category
  const categoryData = documentRequests.reduce((acc: any[], req) => {
    const existing = acc.find(item => item.category === req.category);
    if (existing) {
      existing.total += 1;
      if (req.status === 'approved') existing.approved += 1;
    } else {
      acc.push({
        category: req.category,
        total: 1,
        approved: req.status === 'approved' ? 1 : 0,
      });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Compliance Dashboard
          <Badge variant="outline" className="text-xs">Demo Data</Badge>
        </h1>
        <p className="text-muted-foreground">Monitor your compliance status across all buyers</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Compliance Rate</p>
                  <p className="text-3xl font-bold text-green-600">{stats.complianceRate}%</p>
                </div>
                <div className="p-3 rounded-full bg-green-100">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <p className="text-3xl font-bold">{stats.totalRequests}</p>
                </div>
                <div className="p-3 rounded-full bg-blue-100">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
                </div>
                <div className="p-3 rounded-full bg-amber-100">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Connected Buyers</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.connectedBuyers}</p>
                </div>
                <div className="p-3 rounded-full bg-purple-100">
                  <Building2 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
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
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Compliance by Category */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base font-medium">Compliance by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                      <YAxis 
                        type="category" 
                        dataKey="category" 
                        width={100}
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="approved" fill="hsl(142, 76%, 36%)" name="Approved" stackId="a" />
                      <Bar dataKey="total" fill="hsl(var(--muted))" name="Total" stackId="b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detailed Status Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Approved</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-green-600">{stats.approved}</span>
                  <Progress value={(stats.approved / stats.totalRequests) * 100} className="h-2 flex-1" />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Submitted</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-600">{stats.submitted}</span>
                  <Progress value={(stats.submitted / stats.totalRequests) * 100} className="h-2 flex-1" />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-amber-600">{stats.pending}</span>
                  <Progress value={(stats.pending / stats.totalRequests) * 100} className="h-2 flex-1" />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">Rejected</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-red-600">{stats.rejected}</span>
                  <Progress value={(stats.rejected / stats.totalRequests) * 100} className="h-2 flex-1" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
