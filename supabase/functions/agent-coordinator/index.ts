import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function runAgentCycle() {
  try {
    console.log('Starting agent coordination cycle...');

    // Check if agents are enabled
    const { data: configs, error: configError } = await supabase
      .from('agent_configurations')
      .select('*')
      .eq('enabled', true);

    if (configError) {
      console.error('Error fetching agent configurations:', configError);
      return;
    }

    const enabledAgents = new Set(configs?.map(config => config.agent_type) || []);

    // Run supplier agent if enabled
    if (enabledAgents.has('supplier')) {
      console.log('Running supplier agent...');
      
      // Process new document requests
      await supabase.functions.invoke('supplier-agent', {
        body: { action: 'process_requests' }
      });

      // Check for expiring documents
      await supabase.functions.invoke('supplier-agent', {
        body: { action: 'check_expiring' }
      });
    }

    // Run buyer agent if enabled
    if (enabledAgents.has('buyer')) {
      console.log('Running buyer agent...');
      
      // Process new document uploads
      await supabase.functions.invoke('buyer-agent', {
        body: { action: 'process_uploads' }
      });
    }

    console.log('Agent coordination cycle completed');

    // Log coordination activity
    await supabase
      .from('agent_activities')
      .insert({
        agent_type: 'coordinator',
        action_type: 'coordination_cycle',
        entity_id: crypto.randomUUID(),
        entity_type: 'system',
        details: {
          enabled_agents: Array.from(enabledAgents),
          timestamp: new Date().toISOString()
        },
        success: true
      });

  } catch (error) {
    console.error('Error in agent coordination:', error);
    
    await supabase
      .from('agent_activities')
      .insert({
        agent_type: 'coordinator',
        action_type: 'coordination_error',
        entity_id: crypto.randomUUID(),
        entity_type: 'system',
        details: { error: error.message },
        success: false,
        error_message: error.message
      });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();

    switch (action) {
      case 'run_cycle':
        await runAgentCycle();
        break;

      case 'trigger_supplier':
        await supabase.functions.invoke('supplier-agent', {
          body: { action: 'process_requests' }
        });
        break;

      case 'trigger_buyer':
        await supabase.functions.invoke('buyer-agent', {
          body: { action: 'process_uploads' }
        });
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Agent coordinator error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});