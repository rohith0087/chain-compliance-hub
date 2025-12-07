import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a random alphanumeric code
function generateCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (I, O, 0, 1)
  let code = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  return code;
}

// Hash a code using SHA-256
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating recovery codes for user: ${user.id}`);

    // Delete any existing recovery codes for this user
    const { error: deleteError } = await supabase
      .from('mfa_recovery_codes')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting existing codes:', deleteError);
    }

    // Generate 10 new codes
    const codes: string[] = [];
    const hashedCodes: { user_id: string; code_hash: string }[] = [];

    for (let i = 0; i < 10; i++) {
      const code = `${generateCode(4)}-${generateCode(4)}`; // Format: XXXX-XXXX
      codes.push(code);
      const hash = await hashCode(code);
      hashedCodes.push({ user_id: user.id, code_hash: hash });
    }

    // Insert hashed codes
    const { error: insertError } = await supabase
      .from('mfa_recovery_codes')
      .insert(hashedCodes);

    if (insertError) {
      console.error('Error inserting codes:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate recovery codes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully generated ${codes.length} recovery codes`);

    // Return plain-text codes (only time user sees them)
    return new Response(
      JSON.stringify({ codes }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-mfa-recovery-codes:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
