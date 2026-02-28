import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

// Hash a code using SHA-256
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toUpperCase().replace(/[^A-Z0-9]/g, '')); // Normalize
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

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

    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Recovery code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying recovery code for user: ${user.id}`);

    // Normalize and hash the provided code
    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const codeHash = await hashCode(normalizedCode);

    // Check if this hash exists and is unused
    const { data: existingCode, error: fetchError } = await supabase
      .from('mfa_recovery_codes')
      .select('id, used_at')
      .eq('user_id', user.id)
      .eq('code_hash', codeHash)
      .single();

    if (fetchError || !existingCode) {
      console.log('Recovery code not found or invalid');
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid recovery code' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingCode.used_at) {
      console.log('Recovery code already used');
      return new Response(
        JSON.stringify({ valid: false, error: 'This recovery code has already been used' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark the code as used
    const { error: updateError } = await supabase
      .from('mfa_recovery_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', existingCode.id);

    if (updateError) {
      console.error('Error marking code as used:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify recovery code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count remaining unused codes
    const { count } = await supabase
      .from('mfa_recovery_codes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('used_at', null);

    console.log(`Recovery code verified. ${count} codes remaining.`);

    return new Response(
      JSON.stringify({ valid: true, remainingCodes: count || 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-mfa-recovery-code:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
