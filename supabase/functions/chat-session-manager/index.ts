import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, user_id, company_id, company_type, title, session_id } = await req.json();

    console.log('chat-session-manager:', { action, user_id, company_id, company_type });

    switch (action) {
      case 'create': {
        // Create new session
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({
            user_id,
            company_id,
            company_type,
            session_title: title || 'New Chat',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id, session_title, created_at, updated_at')
          .single();

        if (error) throw error;

        console.log('✓ Created new session:', data.id);

        return new Response(
          JSON.stringify({ success: true, session: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list': {
        // List sessions for user
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('id, session_title, created_at, updated_at')
          .eq('user_id', user_id)
          .eq('company_id', company_id)
          .eq('company_type', company_type)
          .order('updated_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, sessions: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_title': {
        // Update session title (after first message)
        const { error } = await supabase
          .from('chat_sessions')
          .update({ 
            session_title: title,
            updated_at: new Date().toISOString()
          })
          .eq('id', session_id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'touch': {
        // Update last_activity_at
        const { error } = await supabase
          .from('chat_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', session_id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in chat-session-manager:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
