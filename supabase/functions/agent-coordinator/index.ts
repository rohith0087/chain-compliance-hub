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

async function runAgentCycle(companyId?: string, companyType?: 'buyer' | 'supplier') {
  try {
    console.log('Starting agent coordination cycle...', { companyId, companyType });

    // Check if agents are enabled (optionally scoped by company)
    let query = supabase
      .from('agent_configurations')
      .select('*')
      .eq('enabled', true);

    if (companyId && companyType) {
      query = query.eq('company_id', companyId).eq('company_type', companyType);
    }

    const { data: configs, error: configError } = await query;

    if (configError) {
      console.error('Error fetching agent configurations:', configError);
      throw configError;
    }

    const enabledAgents = new Set(configs?.map((config: any) => config.agent_type) || []);

    const results: Array<{ agent: string; action: string; ok: boolean; error?: string }> = [];

    // Run supplier agent if enabled
    if (enabledAgents.has('supplier')) {
      console.log('Running supplier agent...');

      try {
        const { error } = await supabase.functions.invoke('supplier-agent', {
          body: { action: 'process_requests', company_id: companyId, company_type: companyType },
        });
        results.push({ agent: 'supplier', action: 'process_requests', ok: !error, error: (error as any)?.message });
      } catch (e: any) {
        results.push({ agent: 'supplier', action: 'process_requests', ok: false, error: e.message });
      }

      try {
        const { error } = await supabase.functions.invoke('supplier-agent', {
          body: { action: 'check_expiring', company_id: companyId, company_type: companyType },
        });
        results.push({ agent: 'supplier', action: 'check_expiring', ok: !error, error: (error as any)?.message });
      } catch (e: any) {
        results.push({ agent: 'supplier', action: 'check_expiring', ok: false, error: e.message });
      }
    }

    // Run buyer agent if enabled
    if (enabledAgents.has('buyer')) {
      console.log('Running buyer agent...');

      try {
        const { error } = await supabase.functions.invoke('buyer-agent', {
          body: { action: 'process_uploads', company_id: companyId, company_type: companyType },
        });
        results.push({ agent: 'buyer', action: 'process_uploads', ok: !error, error: (error as any)?.message });
      } catch (e: any) {
        results.push({ agent: 'buyer', action: 'process_uploads', ok: false, error: e.message });
      }
    }

    console.log('Agent coordination cycle completed');

    // Log coordination activity with proper entity_id
    await supabase.from('agent_activities').insert({
      agent_type: 'coordinator',
      action_type: 'coordination_cycle',
      entity_id: companyId || crypto.randomUUID(),
      entity_type: companyType || 'system',
      details: {
        enabled_agents: Array.from(enabledAgents),
        company_id: companyId,
        company_type: companyType,
        results,
        timestamp: new Date().toISOString(),
      },
      success: true,
    });

    return { success: true, enabled_agents: Array.from(enabledAgents), results };
  } catch (error: any) {
    console.error('Error in agent coordination:', error);

    await supabase.from('agent_activities').insert({
      agent_type: 'coordinator',
      action_type: 'coordination_error',
      entity_id: companyId || crypto.randomUUID(),
      entity_type: companyType || 'system',
      details: { error: error.message, company_id: companyId, company_type: companyType },
      success: false,
      error_message: error.message,
    });

    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { action, company_id, company_type } = requestBody;

    let result: any = { success: true };

    switch (action) {
      case 'run_cycle': {
        result = await runAgentCycle(company_id, company_type);
        if (!result?.success) {
          return new Response(
            JSON.stringify({ success: false, error: result?.error || 'run_cycle failed', result }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;
      }

      case 'trigger_supplier': {
        const body = { action: 'process_requests', company_id, company_type };
        const invokeRes = await supabase.functions.invoke('supplier-agent', { body });
        if (invokeRes.error) {
          console.error('Supplier agent invoke error:', invokeRes.error);
          await supabase.from('agent_activities').insert({
            agent_type: 'coordinator',
            action_type: 'coordination_error',
            entity_id: company_id || crypto.randomUUID(),
            entity_type: company_type || 'system',
            details: { stage: 'invoke_supplier', body, error: invokeRes.error.message },
            success: false,
            error_message: invokeRes.error.message,
          });
          return new Response(
            JSON.stringify({ success: false, error: invokeRes.error.message, request: body }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = invokeRes;
        break;
      }

      case 'trigger_buyer': {
        const body = { action: 'process_uploads', company_id, company_type };
        const invokeRes = await supabase.functions.invoke('buyer-agent', { body });
        if (invokeRes.error) {
          console.error('Buyer agent invoke error:', invokeRes.error);
          await supabase.from('agent_activities').insert({
            agent_type: 'coordinator',
            action_type: 'coordination_error',
            entity_id: company_id || crypto.randomUUID(),
            entity_type: company_type || 'system',
            details: { stage: 'invoke_buyer', body, error: invokeRes.error.message },
            success: false,
            error_message: invokeRes.error.message,
          });
          return new Response(
            JSON.stringify({ success: false, error: invokeRes.error.message, request: body }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = invokeRes;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action', received: requestBody }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, result }),
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