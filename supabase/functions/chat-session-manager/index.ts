import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ============================================
    // Auth validation
    // ============================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Invalid authentication:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, user_id, company_id, company_type, title, session_id } = await req.json();

    console.log('chat-session-manager:', { action, company_type });

    // ============================================
    // Validate user_id matches authenticated user
    // ============================================
    if (user_id && user_id !== user.id) {
      console.error('User ID mismatch');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Cannot access other users sessions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use authenticated user's ID
    const validatedUserId = user.id;

    // ============================================
    // Validate company access
    // ============================================
    if (company_id && company_type) {
      let hasAccess = false;

      // Check company owner
      if (company_type === 'buyer') {
        const { data: buyer } = await supabase
          .from('buyers')
          .select('id')
          .eq('profile_id', user.id)
          .eq('id', company_id)
          .single();
        if (buyer) hasAccess = true;
      } else if (company_type === 'supplier') {
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('id')
          .eq('profile_id', user.id)
          .eq('id', company_id)
          .single();
        if (supplier) hasAccess = true;
      }

      // Check team member
      if (!hasAccess) {
        const { data: companyUser } = await supabase
          .from('company_users')
          .select('id')
          .eq('profile_id', user.id)
          .eq('company_id', company_id)
          .eq('company_type', company_type)
          .eq('status', 'active')
          .single();
        if (companyUser) hasAccess = true;
      }

      if (!hasAccess) {
        console.error('User does not have access to company:', company_id);
        return new Response(
          JSON.stringify({ error: 'Unauthorized: No access to this company' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    switch (action) {
      case 'create': {
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({
            user_id: validatedUserId,
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
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('id, session_title, created_at, updated_at')
          .eq('user_id', validatedUserId)
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
        // Verify session belongs to user
        const { data: existingSession, error: sessionError } = await supabase
          .from('chat_sessions')
          .select('user_id')
          .eq('id', session_id)
          .single();

        if (sessionError || !existingSession) {
          return new Response(
            JSON.stringify({ error: 'Session not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (existingSession.user_id !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Cannot update other users sessions' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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
        // Verify session belongs to user
        const { data: existingSession, error: sessionError } = await supabase
          .from('chat_sessions')
          .select('user_id')
          .eq('id', session_id)
          .single();

        if (sessionError || !existingSession) {
          return new Response(
            JSON.stringify({ error: 'Session not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (existingSession.user_id !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Cannot update other users sessions' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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
