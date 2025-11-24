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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify the requesting user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const { profile_id } = await req.json();

    if (!profile_id) {
      throw new Error('Missing profile_id');
    }

    console.log('Deleting auth user:', profile_id);

    // Delete the auth user using admin API
    const { error: deleteError } = await supabase.auth.admin.deleteUser(profile_id);

    if (deleteError) {
      // If user not found, consider it already deleted (success)
      if (deleteError.message?.includes('User not found') || deleteError.status === 404) {
        console.log('Auth user already deleted or not found:', profile_id);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Auth user already deleted or not found',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('Error deleting auth user:', deleteError);
      throw new Error(`Failed to delete auth user: ${deleteError.message}`);
    }

    console.log('Successfully deleted auth user:', profile_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Auth user deleted successfully',
      }),
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
