import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Zap,
  BarChart3,
  GitBranch,
  Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  steps: any;
  is_active: boolean;
  created_at: string;
}

interface WorkflowState {
  id: string;
  template_id: string;
  current_step: string;
  context: any;
  status: string;
  ai_responses: any;
  created_at: string;
  updated_at: string;
}

interface WorkflowExecutionLog {
  id: string;
  workflow_id: string;
  step_id: string;
  step_type: string;
  ai_response: any;
  execution_time_ms: number;
  status: string;
  error_message?: string;
  created_at: string;
}

export const WorkflowManagementDashboard: React.FC = () => {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [activeWorkflows, setActiveWorkflows] = useState<WorkflowState[]>([]);
  const [executionLogs, setExecutionLogs] = useState<WorkflowExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadWorkflowData();
  }, []);

  const loadWorkflowData = async () => {
    try {
      setLoading(true);

      // Load workflow templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('workflow_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (templatesError) throw templatesError;

      // Load active workflows
      const { data: workflowsData, error: workflowsError } = await supabase
        .from('workflow_states')
        .select('*')
        .in('status', ['running', 'paused'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (workflowsError) throw workflowsError;

      // Load recent execution logs
      const { data: logsData, error: logsError } = await supabase
        .from('workflow_execution_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsError) throw logsError;

      setTemplates(templatesData || []);
      setActiveWorkflows(workflowsData || []);
      setExecutionLogs(logsData || []);

    } catch (error) {
      console.error('Error loading workflow data:', error);
      toast({
        title: "Error",
        description: "Failed to load workflow data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerWorkflow = async (templateId: string, context: any = {}) => {
    try {
      const { data, error } = await supabase.functions.invoke('workflow-engine', {
        body: {
          action: 'start_workflow',
          template_id: templateId,
          context: {
            ...context,
            user_id: context.user_id || 'manual_trigger',
            triggered_manually: true
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Workflow Started",
        description: `Workflow started successfully`,
      });

      loadWorkflowData();
    } catch (error) {
      console.error('Error triggering workflow:', error);
      toast({
        title: "Error",
        description: "Failed to start workflow",
        variant: "destructive"
      });
    }
  };

  const getWorkflowStats = () => {
    const total = activeWorkflows.length;
    const running = activeWorkflows.filter(w => w.status === 'running').length;
    const paused = activeWorkflows.filter(w => w.status === 'paused').length;
    
    const recentLogs = executionLogs.filter(log => {
      const logDate = new Date(log.created_at);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return logDate > yesterday;
    });

    const successRate = recentLogs.length > 0 
      ? (recentLogs.filter(log => log.status === 'success').length / recentLogs.length) * 100
      : 0;

    const avgExecutionTime = recentLogs.length > 0
      ? recentLogs.reduce((sum, log) => sum + (log.execution_time_ms || 0), 0) / recentLogs.length
      : 0;

    return { total, running, paused, successRate, avgExecutionTime, recentExecutions: recentLogs.length };
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'running': return 'default';
      case 'completed': return 'secondary';
      case 'failed': return 'destructive';
      case 'paused': return 'outline';
      default: return 'secondary';
    }
  };

  const stats = getWorkflowStats();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.running}</div>
            <p className="text-xs text-muted-foreground">
              {stats.paused} paused, {stats.total} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
            <Progress value={stats.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.avgExecutionTime)}ms</div>
            <p className="text-xs text-muted-foreground">
              {stats.recentExecutions} executions today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Templates</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
            <p className="text-xs text-muted-foreground">
              {templates.filter(t => t.is_active).length} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Workflow Templates</TabsTrigger>
          <TabsTrigger value="active">Active Workflows</TabsTrigger>
          <TabsTrigger value="logs">Execution Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                    </div>
                    <Badge variant={template.is_active ? 'default' : 'secondary'}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{template.steps.length} steps</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm capitalize">{template.trigger_type.replace('_', ' ')}</span>
                    </div>
                    
                    <Button 
                      onClick={() => triggerWorkflow(template.id, { template_name: template.name })}
                      disabled={!template.is_active}
                      size="sm" 
                      className="w-full"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Trigger Workflow
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Workflows</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {activeWorkflows.map((workflow) => {
                    const template = templates.find(t => t.id === workflow.template_id);
                    return (
                      <div key={workflow.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{template?.name || 'Unknown Template'}</h4>
                          <Badge variant={getStatusBadgeVariant(workflow.status)}>
                            {workflow.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>Current Step: {workflow.current_step}</p>
                          <p>Started: {new Date(workflow.created_at).toLocaleString()}</p>
                          <p>Updated: {new Date(workflow.updated_at).toLocaleString()}</p>
                        </div>
                        {workflow.context && (
                          <div className="mt-2">
                            <details>
                              <summary className="text-xs cursor-pointer">View Context</summary>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                                {JSON.stringify(workflow.context, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {activeWorkflows.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No active workflows
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Execution Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {executionLogs.map((log) => (
                    <div key={log.id} className="border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                            {log.status}
                          </Badge>
                          <span className="text-sm font-medium">{log.step_id}</span>
                          <span className="text-xs text-muted-foreground">({log.step_type})</span>
                        </div>
                        {log.execution_time_ms && (
                          <span className="text-xs text-muted-foreground">
                            {log.execution_time_ms}ms
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </div>

                      {log.error_message && (
                        <div className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                          {log.error_message}
                        </div>
                      )}

                      {log.ai_response && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer">AI Response</summary>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                            {JSON.stringify(log.ai_response, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                  {executionLogs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No execution logs available
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};