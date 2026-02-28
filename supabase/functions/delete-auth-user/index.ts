import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const { profile_id } = await req.json();

    if (!profile_id) {
      throw new Error('Missing profile_id');
    }

    // Input validation: UUID format
    if (!UUID_REGEX.test(profile_id)) {
      throw new Error('Invalid profile_id format');
    }

    // Prevent self-deletion
    if (profile_id === user.id) {
      throw new Error('Cannot delete your own account');
    }

    // ============================================
    // AUTHORIZATION: Only platform admins or company admins can delete users
    // ============================================

    // Check 1: Is the caller a platform admin?
    const { data: platformAdmin } = await supabase
      .from('platform_administrators')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!platformAdmin) {
      // Check 2: Is the caller a company admin of the SAME company as the target user?
      // Get all companies the target user belongs to
      const { data: targetCompanies } = await supabase
        .from('company_users')
        .select('company_id, company_type')
        .eq('profile_id', profile_id)
        .eq('status', 'active');

      if (!targetCompanies || targetCompanies.length === 0) {
        throw new Error('Target user not found in any company');
      }

      // Check if the caller is a company_admin of at least one of the target's companies
      let isAuthorized = false;
      for (const tc of targetCompanies) {
        const { data: callerAdmin } = await supabase
          .from('company_users')
          .select('id')
          .eq('profile_id', user.id)
          .eq('company_id', tc.company_id)
          .eq('company_type', tc.company_type)
          .eq('role', 'company_admin')
          .eq('status', 'active')
          .maybeSingle();

        if (callerAdmin) {
          isAuthorized = true;
          break;
        }
      }

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unauthorized: Only platform admins or company admins can delete users',
          }),
          { 
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    console.log('Deleting auth user');

    // Delete the auth user using admin API
    const { error: deleteError } = await supabase.auth.admin.deleteUser(profile_id);

    if (deleteError) {
      if (deleteError.message?.includes('User not found') || deleteError.status === 404) {
        console.log('Auth user already deleted or not found');
        return new Response(
          JSON.stringify({ success: true, message: 'Auth user already deleted or not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('Error deleting auth user:', deleteError);
      throw new Error(`Failed to delete auth user: ${deleteError.message}`);
    }

    console.log('Successfully deleted auth user');

    return new Response(
      JSON.stringify({ success: true, message: 'Auth user deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-auth-user function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
