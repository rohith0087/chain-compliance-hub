import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Play, Activity } from 'lucide-react';

interface AgentTestPanelProps {
  companyType: 'buyer' | 'supplier';
  companyId: string;
}

const AgentTestPanel: React.FC<AgentTestPanelProps> = ({ companyType, companyId }) => {
  const { toast } = useToast();
  const [isTestingSupplier, setIsTestingSupplier] = useState(false);
  const [isTestingBuyer, setIsTestingBuyer] = useState(false);
  const [isRunningCycle, setIsRunningCycle] = useState(false);

  const testSupplierAgent = async () => {
    setIsTestingSupplier(true);
    try {
      console.log('Testing supplier agent...');
      const { data, error } = await supabase.functions.invoke('supplier-agent', {
        body: { 
          action: 'process_requests',
          company_id: companyId,
          company_type: companyType 
        }
      });

      if (error) {
        throw error;
      }

      console.log('Supplier agent response:', data);
      toast({
        title: "Supplier Agent Test",
        description: data?.message || "Agent test completed successfully",
      });
    } catch (error: any) {
      console.error('Supplier agent test error:', error);
      toast({
        title: "Supplier Agent Test Failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsTestingSupplier(false);
    }
  };

  const testBuyerAgent = async () => {
    setIsTestingBuyer(true);
    try {
      console.log('Testing buyer agent...');
      const { data, error } = await supabase.functions.invoke('buyer-agent', {
        body: { 
          action: 'process_uploads',
          company_id: companyId,
          company_type: companyType 
        }
      });

      if (error) {
        throw error;
      }

      console.log('Buyer agent response:', data);
      toast({
        title: "Buyer Agent Test",
        description: data?.message || "Agent test completed successfully",
      });
    } catch (error: any) {
      console.error('Buyer agent test error:', error);
      toast({
        title: "Buyer Agent Test Failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsTestingBuyer(false);
    }
  };

  const runFullCycle = async () => {
    setIsRunningCycle(true);
    try {
      console.log('Running full agent cycle...');
      const { data, error } = await supabase.functions.invoke('agent-coordinator', {
        body: { 
          action: 'run_cycle',
          company_id: companyId,
          company_type: companyType 
        }
      });

      if (error) {
        throw error;
      }

      console.log('Agent coordinator response:', data);
      toast({
        title: "Full Agent Cycle",
        description: data?.message || "Agent cycle completed successfully",
      });
    } catch (error: any) {
      console.error('Agent cycle error:', error);
      toast({
        title: "Agent Cycle Failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRunningCycle(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Agent Testing Panel
        </CardTitle>
        <CardDescription>
          Test and debug AI agents for {companyType} operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">Supplier Agent</h4>
            <p className="text-sm text-muted-foreground">
              Process document requests and match existing documents
            </p>
            <Button
              onClick={testSupplierAgent}
              disabled={isTestingSupplier}
              className="w-full"
              variant="outline"
            >
              {isTestingSupplier ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Test Supplier Agent
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Buyer Agent</h4>
            <p className="text-sm text-muted-foreground">
              Validate uploaded documents and make approval decisions
            </p>
            <Button
              onClick={testBuyerAgent}
              disabled={isTestingBuyer}
              className="w-full"
              variant="outline"
            >
              {isTestingBuyer ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Test Buyer Agent
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="space-y-2">
            <h4 className="font-medium">Full Agent Coordination</h4>
            <p className="text-sm text-muted-foreground">
              Run complete agent cycle with coordination between all agents
            </p>
            <Button
              onClick={runFullCycle}
              disabled={isRunningCycle}
              className="w-full"
            >
              {isRunningCycle ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Run Full Agent Cycle
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t">
          <Badge variant="outline" className="text-xs">
            Company: {companyType} | ID: {companyId.slice(0, 8)}...
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentTestPanel;