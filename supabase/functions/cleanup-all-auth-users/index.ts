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
    // DANGER ZONE: This deletes ALL auth users
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
    
    for (const user of users) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        console.error(`Failed to delete user ${user.id} (${user.email}):`, error);
        failCount++;
        errors.push(`${user.email}: ${error.message}`);
      } else {
        console.log(`Deleted auth user: ${user.id} (${user.email})`);
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
