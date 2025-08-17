import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AgentStatus {
  agent_type: string;
  current_status: string;
  last_active: string;
  current_operation?: string;
  processing_details?: any;
  estimated_completion?: string;
}

export const useAgentStatus = (companyId: string, companyType: 'buyer' | 'supplier') => {
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgentStatuses();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('agent-status-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_configurations',
          filter: `company_id=eq.${companyId}`
        },
        () => {
          loadAgentStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, companyType]);

  const loadAgentStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_configurations')
        .select('agent_type, current_status, last_active, current_operation, processing_details, estimated_completion')
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .eq('enabled', true);

      if (error) throw error;
      setAgentStatuses(data || []);
    } catch (error) {
      console.error('Error loading agent statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAgentStatus = async (agentType: string, status: string, operation?: string, details?: any) => {
    try {
      const { error } = await supabase
        .from('agent_configurations')
        .update({
          current_status: status,
          current_operation: operation,
          processing_details: details || {},
          last_active: new Date().toISOString(),
          estimated_completion: details?.estimated_completion
        })
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .eq('agent_type', agentType);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating agent status:', error);
    }
  };

  const ensureAgentConfiguration = async (agentType: string) => {
    try {
      // Check if configuration exists
      const { data: existing } = await supabase
        .from('agent_configurations')
        .select('id')
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .eq('agent_type', agentType)
        .single();

      if (!existing) {
        // Create default configuration
        const { error } = await supabase
          .from('agent_configurations')
          .insert({
            company_id: companyId,
            company_type: companyType,
            agent_type: agentType,
            enabled: true,
            current_status: 'offline',
            settings: {
              auto_approve_threshold: 0.85,
              notification_enabled: true,
              analysis_frequency: 'on_request'
            }
          });

        if (error) throw error;
        await loadAgentStatuses();
      }
    } catch (error) {
      console.error('Error ensuring agent configuration:', error);
    }
  };

  return {
    agentStatuses,
    loading,
    updateAgentStatus,
    ensureAgentConfiguration,
    refetch: loadAgentStatuses
  };
};