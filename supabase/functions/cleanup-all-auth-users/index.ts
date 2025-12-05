import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============================================
    // CRITICAL: Auth validation - super_admin only
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

    // Check if user has super_admin role
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Failed to fetch user roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const roles = userRoles?.map(r => r.role) || [];
    const isSuperAdmin = roles.includes('super_admin');

    if (!isSuperAdmin) {
      console.error('Unauthorized: User is not super_admin. User:', user.id, 'Roles:', roles);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Super admin authorized:', user.id, user.email);

    // ============================================
    // DANGER ZONE: This deletes ALL auth users
    // ============================================
    console.log('Starting cleanup of all auth users...');
    
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }
    
    console.log(`Found ${users.length} auth users to delete`);
    
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    
    for (const targetUser of users) {
      // Don't delete the current super admin
      if (targetUser.id === user.id) {
        console.log(`Skipping current user: ${targetUser.id} (${targetUser.email})`);
        continue;
      }

      const { error } = await supabase.auth.admin.deleteUser(targetUser.id);
      if (error) {
        console.error(`Failed to delete user ${targetUser.id} (${targetUser.email}):`, error);
        failCount++;
        errors.push(`${targetUser.email}: ${error.message}`);
      } else {
        console.log(`Deleted auth user: ${targetUser.id} (${targetUser.email})`);
        successCount++;
      }
    }
    
    console.log(`Cleanup complete: ${successCount} deleted, ${failCount} failed`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Auth cleanup complete: ${successCount} deleted, ${failCount} failed`,
        total: users.length,
        deleted: successCount,
        failed: failCount,
        errors: errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cleanup-all-auth-users:', error);
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
