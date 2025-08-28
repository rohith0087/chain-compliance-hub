import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  Brain, 
  Clock, 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  Zap,
  Eye,
  MessageSquare,
  TrendingUp,
  Loader2
} from "lucide-react";
import { format } from "date-fns";

interface AgentConfig {
  id: string;
  agent_type: string;
  company_type: string;
  enabled: boolean;
  current_status: string;
  current_operation?: string;
  processing_details: any;
  estimated_completion?: string;
  last_active: string;
  settings: any;
}

interface AgentActivity {
  id: string;
  agent_type: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  details: any;
  confidence_score?: number;
  success: boolean;
  error_message?: string;
  processing_steps: any;
  reasoning?: string;
  intermediate_results: any;
  operation_duration_ms?: number;
  created_at: string;
}

interface AgentTimelineProps {
  companyType: 'buyer' | 'supplier';
  companyId: string;
}

export const AgentTimeline: React.FC<AgentTimelineProps> = ({ companyType, companyId }) => {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  useEffect(() => {
    loadAgentData();
    const cleanup = setupRealtimeSubscriptions();
    return cleanup;
  }, [companyId, companyType]);

  const loadAgentData = async () => {
    try {
      // Load agent configurations
      const { data: agentConfigs, error: configError } = await supabase
        .from('agent_configurations')
        .select('*')
        .eq('company_id', companyId)
        .eq('company_type', companyType);

      if (configError) throw configError;

      // Load recent agent activities
      const { data: agentActivities, error: activityError } = await supabase
        .from('agent_activities')
        .select('*')
        .eq('entity_type', companyType)
        .eq('entity_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (activityError) throw activityError;

      setAgents(agentConfigs || []);
      setActivities(agentActivities || []);
    } catch (error) {
      console.error('Error loading agent data:', error);
      toast({
        title: "Error",
        description: "Failed to load agent data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Check if we're in a secure context before setting up WebSocket connections
    if (!window.isSecureContext) {
      console.warn('AgentTimeline: Skipping realtime subscriptions - not in secure context');
      return () => {}; // Return empty cleanup function
    }

    try {
      // Subscribe to agent configuration changes
      const configChannel = supabase
        .channel(`agent-configs-${companyId}-${companyType}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'agent_configurations',
            filter: `company_id=eq.${companyId}`
          },
          (payload) => {
            console.log('Agent config changed:', payload);
            loadAgentData();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Agent config channel subscribed successfully');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Agent config channel subscription failed');
          }
        });

      // Subscribe to agent activity changes
      const activityChannel = supabase
        .channel(`agent-activities-${companyId}-${companyType}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'agent_activities',
            filter: `entity_id=eq.${companyId}`
          },
          (payload) => {
            console.log('New agent activity:', payload);
            setActivities(prev => [payload.new as any, ...prev.slice(0, 49)]);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Agent activity channel subscribed successfully');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Agent activity channel subscription failed');
          }
        });

      return () => {
        console.log('Cleaning up agent timeline subscriptions');
        try {
          supabase.removeChannel(configChannel);
          supabase.removeChannel(activityChannel);
        } catch (error) {
          console.error('Error cleaning up channels:', error);
        }
      };
    } catch (error) {
      console.error('Error setting up realtime subscriptions:', error);
      // Return empty cleanup function if setup fails
      return () => {};
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'processing': return 'bg-blue-500 animate-pulse';
      case 'idle': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <Activity className="h-4 w-4" />;
      case 'processing': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'idle': return <Clock className="h-4 w-4" />;
      case 'offline': return <Bot className="h-4 w-4" />;
      default: return <Bot className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (score?: number) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const triggerAgent = async (agentType: string) => {
    try {
      const functionName = agentType === 'supplier' ? 'supplier-agent' : 'buyer-agent';
      const { error } = await supabase.functions.invoke(functionName, {
        body: { 
          [companyType === 'supplier' ? 'supplier_id' : 'buyer_id']: companyId,
          action: 'analyze_and_act'
        }
      });

      if (error) throw error;

      toast({
        title: "Agent Triggered",
        description: `${agentType} agent has been activated`,
      });
    } catch (error) {
      console.error('Error triggering agent:', error);
      toast({
        title: "Error",
        description: "Failed to trigger agent",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Agent Status</TabsTrigger>
          <TabsTrigger value="timeline">Live Timeline</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.current_status)}`} />
                    <CardTitle className="text-lg capitalize">
                      {agent.agent_type} Agent
                    </CardTitle>
                    <Badge variant={agent.enabled ? "default" : "secondary"}>
                      {agent.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(agent.current_status)}
                    <span className="text-sm text-muted-foreground capitalize">
                      {agent.current_status}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {agent.current_operation && (
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Current Operation:</span>
                      <span className="font-medium">{agent.current_operation}</span>
                    </div>
                    {agent.processing_details?.progress && (
                      <Progress value={agent.processing_details.progress} className="h-2" />
                    )}
                    {agent.estimated_completion && (
                      <div className="text-xs text-muted-foreground">
                        Est. completion: {format(new Date(agent.estimated_completion), 'HH:mm:ss')}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Last active: {format(new Date(agent.last_active), 'MMM dd, HH:mm:ss')}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => triggerAgent(agent.agent_type)}
                    disabled={agent.current_status === 'processing'}
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    Trigger
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <Card key={activity.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {activity.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium capitalize">
                          {activity.agent_type} Agent
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {activity.action_type}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        {activity.confidence_score && (
                          <span className={getConfidenceColor(activity.confidence_score)}>
                            {(activity.confidence_score * 100).toFixed(0)}% confidence
                          </span>
                        )}
                        {activity.operation_duration_ms && (
                          <span>{activity.operation_duration_ms}ms</span>
                        )}
                        <span>{format(new Date(activity.created_at), 'HH:mm:ss')}</span>
                      </div>
                    </div>
                    
                    {activity.reasoning && (
                      <div className="mb-3">
                        <div className="flex items-center space-x-1 mb-1">
                          <Brain className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-600">AI Reasoning:</span>
                        </div>
                        <p className="text-sm text-muted-foreground pl-5">
                          {activity.reasoning}
                        </p>
                      </div>
                    )}

                    {activity.processing_steps && Array.isArray(activity.processing_steps) && activity.processing_steps.length > 0 && (
                      <div className="mb-3">
                        <div className="text-sm font-medium mb-2 flex items-center space-x-1">
                          <TrendingUp className="h-4 w-4" />
                          <span>Processing Steps:</span>
                        </div>
                        <div className="space-y-1 pl-5">
                          {activity.processing_steps.map((step, stepIndex) => (
                            <div key={stepIndex} className="text-xs text-muted-foreground">
                              {stepIndex + 1}. {typeof step === 'string' ? step : step.description || 'Processing...'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activity.error_message && (
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {activity.error_message}
                      </div>
                    )}

                    {index < activities.length - 1 && <Separator className="mt-4" />}
                  </CardContent>
                </Card>
              ))}
              
              {activities.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No agent activity yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Agents will appear here when they start processing
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <span>Total Activities</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activities.length}</div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>Success Rate</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activities.length > 0 
                    ? Math.round((activities.filter(a => a.success).length / activities.length) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">Agent reliability</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center space-x-2">
                  <Brain className="h-4 w-4" />
                  <span>Avg Confidence</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activities.length > 0 && activities.some(a => a.confidence_score)
                    ? Math.round(
                        activities
                          .filter(a => a.confidence_score)
                          .reduce((sum, a) => sum + (a.confidence_score || 0), 0) /
                        activities.filter(a => a.confidence_score).length * 100
                      )
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">AI decision quality</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Eye className="h-5 w-5" />
                <span>Recent AI Decisions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {activities
                    .filter(a => a.reasoning)
                    .slice(0, 10)
                    .map((activity) => (
                      <div key={activity.id} className="border-l-2 border-muted pl-4 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            {activity.action_type}
                          </span>
                          <div className="flex items-center space-x-2">
                            {activity.confidence_score && (
                              <Badge variant="outline" className="text-xs">
                                {(activity.confidence_score * 100).toFixed(0)}%
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(activity.created_at), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {activity.reasoning}
                        </p>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};