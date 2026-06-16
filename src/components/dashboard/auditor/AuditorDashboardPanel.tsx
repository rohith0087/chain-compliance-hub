import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ClipboardCheck, 
  FileText, 
  AlertOctagon, 
  TrendingUp, 
  Calendar,
  Clock,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  ListTodo
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface AuditorDashboardPanelProps {
  buyerId?: string;
  onNavigateToTab: (tab: string) => void;
}

export function AuditorDashboardPanel({ buyerId, onNavigateToTab }: AuditorDashboardPanelProps) {
  // Placeholder data for the auditor dashboard
  const stats = {
    activeAudits: 12,
    pendingReports: 5,
    criticalFindings: 3,
    avgFssaiScore: 88,
  };

  const fssaiCategories = [
    { name: 'Hygiene', score: 92, fill: '#10b981' },
    { name: 'Infrastructure', score: 85, fill: '#3b82f6' },
    { name: 'Documentation', score: 78, fill: '#f59e0b' },
    { name: 'Pest Control', score: 95, fill: '#10b981' },
    { name: 'Water Quality', score: 88, fill: '#3b82f6' },
  ];

  const recentActivity = [
    { id: 1, type: 'finding', title: 'Critical Hygiene Issue logged', target: 'Spice Mills Pvt Ltd', time: '2 hours ago', icon: ShieldAlert, color: 'text-red-500' },
    { id: 2, type: 'report', title: 'Draft Report Submitted', target: 'Organic Farms India', time: '5 hours ago', icon: FileText, color: 'text-blue-500' },
    { id: 3, type: 'audit', title: 'Audit Completed', target: 'Delhi Dairies', time: '1 day ago', icon: CheckCircle2, color: 'text-green-500' },
    { id: 4, type: 'schedule', title: 'Audit Scheduled', target: 'Mumbai Snacks', time: '1 day ago', icon: Calendar, color: 'text-amber-500' },
  ];

  const priorityTasks = [
    { id: 1, title: 'Review FSSAI License Renewal', client: 'Spice Mills Pvt Ltd', due: 'Today' },
    { id: 2, title: 'Follow-up on Critical Non-Conformance', client: 'Fresh Bites Bakery', due: 'Tomorrow' },
    { id: 3, title: 'Finalize Audit Report', client: 'Delhi Dairies', due: 'In 2 days' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <TooltipProvider delayDuration={300}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Active Audits</p>
                        <h3 className="text-3xl font-bold mt-1">{stats.activeAudits}</h3>
                      </div>
                      <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center">
                        <ClipboardCheck className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>The total number of ongoing audits that have not yet been closed.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Pending Reports</p>
                        <h3 className="text-3xl font-bold mt-1">{stats.pendingReports}</h3>
                      </div>
                      <div className="h-12 w-12 bg-amber-50 rounded-full flex items-center justify-center">
                        <FileText className="h-6 w-6 text-amber-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Audit reports that are drafted but awaiting final review and sign-off.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Critical Findings</p>
                        <h3 className="text-3xl font-bold mt-1 text-red-600">{stats.criticalFindings}</h3>
                      </div>
                      <div className="h-12 w-12 bg-red-50 rounded-full flex items-center justify-center">
                        <AlertOctagon className="h-6 w-6 text-red-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Major non-conformances identified across all active clients requiring immediate action.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Avg FSSAI Score</p>
                        <div className="flex items-end gap-2 mt-1">
                          <h3 className="text-3xl font-bold">{stats.avgFssaiScore}%</h3>
                          <span className="flex items-center text-sm text-green-600 mb-1">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            +2%
                          </span>
                        </div>
                      </div>
                      <div className="h-12 w-12 bg-green-50 rounded-full flex items-center justify-center">
                        <ShieldAlert className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>The average Food Safety and Standards Authority of India (FSSAI) compliance score across all facilities.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Analytics - Chart */}
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>FSSAI Compliance by Category</CardTitle>
              <CardDescription>Average scores across all active audited facilities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fssaiCategories} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} domain={[0, 100]} />
                    <RechartsTooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {fssaiCategories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Priority Tasks */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Priority Tasks
                </CardTitle>
                <Badge variant="secondary">{priorityTasks.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <ScrollArea className="h-[340px]">
                <div className="p-5 pb-8 space-y-4">
                  {priorityTasks.map((task) => (
                    <div key={task.id} className="group relative rounded-xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/50 transition-all">
                      <h4 className="text-base font-semibold mb-1.5">{task.title}</h4>
                      <p className="text-sm text-muted-foreground mb-4">{task.client}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <Badge variant={task.due === 'Today' ? 'destructive' : 'secondary'} className="px-2.5 py-0.5 rounded-full font-medium">
                          Due {task.due}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Audit Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div className={`mt-0.5 rounded-full p-1.5 bg-background border shadow-sm`}>
                    <activity.icon className={`h-4 w-4 ${activity.color}`} />
                  </div>
                  <div className="flex-1 min-w-0 border-b pb-4 last:border-0 last:pb-0">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground truncate">{activity.target}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3 ml-2" />
                        {activity.time}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t text-center">
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-primary">
                View All Activity
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
