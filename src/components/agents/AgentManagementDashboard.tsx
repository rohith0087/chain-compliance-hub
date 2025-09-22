import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bot, Activity, Settings, TrendingUp, AlertTriangle } from 'lucide-react';
import AgentTestPanel from './AgentTestPanel';

interface AgentConfig {
  id: string;
  agent_type: string;
  enabled: boolean;
  settings: any;
  created_at: string;
  updated_at: string;
}

interface AgentActivity {
  id: string;
  agent_type: string;
  action_type: string;
  entity_type: string;
  details: any;
  confidence_score?: number;
  success: boolean;
  created_at: string;
  error_message?: string;
}

const AgentManagementDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<{id: string, type: 'buyer' | 'supplier'} | null>(null);

  const loadAgentData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // First, determine company info
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      const { data: buyerData } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      let companyId = '';
      let companyType: 'buyer' | 'supplier' = 'supplier';
      
      if (supplierData) {
        companyId = supplierData.id;
        companyType = 'supplier';
      } else if (buyerData) {
        companyId = buyerData.id;
        companyType = 'buyer';
      }

      setCompanyInfo({ id: companyId, type: companyType });

      // Load agent configurations
      const { data: configData, error: configError } = await supabase
        .from('agent_configurations')
        .select('*')
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .order('created_at', { ascending: false });

      if (configError) throw configError;

      // Load recent agent activities
      const { data: activityData, error: activityError } = await supabase
        .from('agent_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (activityError) throw activityError;

      setConfigs(configData || []);
      setActivities(activityData || []);

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

  useEffect(() => {
    loadAgentData();
  }, [user]);

  const toggleAgent = async (agentType: 'supplier' | 'buyer', enabled: boolean) => {
    if (!companyInfo) {
      toast({
        title: "Error",
        description: "Company information not loaded",
        variant: "destructive",
      });
      return;
    }

    try {
      const existingConfig = configs.find(c => c.agent_type === agentType);

      if (existingConfig) {
        const { error } = await supabase
          .from('agent_configurations')
          .update({ enabled })
          .eq('id', existingConfig.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
      } else {
        // Create new configuration using proper company ID
        const { error } = await supabase
          .from('agent_configurations')
          .insert({
            company_id: companyInfo.id,
            company_type: companyInfo.type,
            agent_type: agentType,
            enabled,
            settings: {}
          });

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
      }

      await loadAgentData();
      
      toast({
        title: "Success",
        description: `${agentType} agent ${enabled ? 'enabled' : 'disabled'}`,
      });

    } catch (error) {
      console.error('Error toggling agent:', error);
      toast({
        title: "Error",
        description: `Failed to update agent configuration: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const triggerAgent = async (agentType: 'supplier' | 'buyer') => {
    if (!companyInfo) {
      toast({
        title: "Error",
        description: "Company information not loaded",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('agent-coordinator', {
        body: { 
          action: `trigger_${agentType}`,
          company_id: companyInfo.id,
          company_type: companyInfo.type
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data?.result?.data?.message || `${agentType} agent triggered successfully`,
      });

      // Reload activities after a brief delay
      setTimeout(loadAgentData, 2000);

    } catch (error: any) {
      console.error('Error triggering agent:', error);
      toast({
        title: "Error",
        description: `Failed to trigger ${agentType} agent: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const runFullCycle = async () => {
    if (!companyInfo) {
      toast({
        title: "Error",
        description: "Company information not loaded",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('agent-coordinator', {
        body: { 
          action: 'run_cycle',
          company_id: companyInfo.id,
          company_type: companyInfo.type
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data?.result?.success ? "Agent coordination cycle completed" : (data?.result?.error || "Cycle started"),
      });

      setTimeout(loadAgentData, 3000);

    } catch (error: any) {
      console.error('Error running agent cycle:', error);
      toast({
        title: "Error",
        description: `Failed to run agent coordination cycle: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const getAgentConfig = (type: 'supplier' | 'buyer') => {
    return configs.find(c => c.agent_type === type);
  };

  const getActivityStats = () => {
    const last24Hours = activities.filter(a => 
      new Date(a.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    return {
      total: activities.length,
      last24h: last24Hours.length,
      successful: activities.filter(a => a.success).length,
      failed: activities.filter(a => !a.success).length,
      avgConfidence: activities.filter(a => a.confidence_score)
        .reduce((sum, a) => sum + (a.confidence_score || 0), 0) / 
        Math.max(1, activities.filter(a => a.confidence_score).length)
    };
  };

  const stats = getActivityStats();
  const supplierConfig = getAgentConfig('supplier');
  const buyerConfig = getAgentConfig('buyer');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Agent Management</h2>
          <p className="text-muted-foreground">
            Monitor and control your intelligent automation agents
          </p>
        </div>
        <Button onClick={runFullCycle} className="gap-2">
          <Bot className="h-4 w-4" />
          Run Full Cycle
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.last24h} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.successful} successful, {stats.failed} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.avgConfidence * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              AI decision confidence
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {configs.filter(c => c.enabled).length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {configs.length} configured
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="configuration" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="activities">Recent Activities</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="settings">Advanced Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Supplier Agent */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Supplier Agent
                </CardTitle>
                <CardDescription>
                  Automatically processes document requests and manages expirations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Agent Status</p>
                    <p className="text-sm text-muted-foreground">
                      {supplierConfig?.enabled ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <Switch
                    checked={supplierConfig?.enabled || false}
                    onCheckedChange={(enabled) => toggleAgent('supplier', enabled)}
                  />
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Capabilities</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Auto-submit matching documents</li>
                    <li>• Send expiry notifications</li>
                    <li>• Track response times</li>
                    <li>• Document analysis</li>
                  </ul>
                </div>

                <Button 
                  onClick={() => triggerAgent('supplier')} 
                  variant="outline" 
                  className="w-full"
                  disabled={!supplierConfig?.enabled}
                >
                  Trigger Now
                </Button>
              </CardContent>
            </Card>

            {/* Buyer Agent */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Buyer Agent
                </CardTitle>
                <CardDescription>
                  Automatically reviews and validates document submissions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Agent Status</p>
                    <p className="text-sm text-muted-foreground">
                      {buyerConfig?.enabled ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <Switch
                    checked={buyerConfig?.enabled || false}
                    onCheckedChange={(enabled) => toggleAgent('buyer', enabled)}
                  />
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Capabilities</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Auto-approve valid documents</li>
                    <li>• Intelligent rejection with feedback</li>
                    <li>• Compliance validation</li>
                    <li>• Risk assessment</li>
                  </ul>
                </div>

                <Button 
                  onClick={() => triggerAgent('buyer')} 
                  variant="outline" 
                  className="w-full"
                  disabled={!buyerConfig?.enabled}
                >
                  Trigger Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Agent Activities</CardTitle>
              <CardDescription>
                Monitor what your AI agents have been doing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No agent activities yet
                  </p>
                ) : (
                  activities.slice(0, 20).map((activity) => (
                    <div key={activity.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={activity.success ? "default" : "destructive"}>
                            {activity.agent_type}
                          </Badge>
                          <span className="font-medium">{activity.action_type}</span>
                          {activity.confidence_score && (
                            <Badge variant="secondary">
                              {(activity.confidence_score * 100).toFixed(0)}% confidence
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {activity.entity_type} • {new Date(activity.created_at).toLocaleString()}
                        </p>
                        {activity.error_message && (
                          <div className="flex items-center gap-1 text-sm text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            {activity.error_message}
                          </div>
                        )}
                      </div>
                      <Badge variant={activity.success ? "default" : "destructive"}>
                        {activity.success ? "Success" : "Failed"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          {companyInfo ? (
            <AgentTestPanel 
              companyType={companyInfo.type} 
              companyId={companyInfo.id}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">Loading company information...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Advanced Settings
              </CardTitle>
              <CardDescription>
                Configure advanced agent behaviors and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Advanced settings panel coming soon</p>
                  <p className="text-sm">Configure validation thresholds, notification timing, and more</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentManagementDashboard;