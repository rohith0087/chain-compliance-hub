import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hash a code using SHA-256 (must match generate-mfa-recovery-codes normalization)
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toUpperCase().replace(/[^A-Z0-9]/g, '')); // Normalize
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
    
    // Verify user from JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('User verification failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { recoveryCode, newPassword } = await req.json();

    // Validate inputs
    if (!recoveryCode || typeof recoveryCode !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Recovery code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return new Response(
        JSON.stringify({ error: 'New password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side password validation
    if (newPassword.length < 8 || newPassword.length > 128) {
      return new Response(
        JSON.stringify({ error: 'Password must be between 8 and 128 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || 
        !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'Password must contain uppercase, lowercase, number, and special character' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RESET-PASSWORD-RECOVERY] Verifying recovery code for user: ${user.id}`);

    // Normalize and hash the provided code
    const normalizedCode = recoveryCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const codeHash = await hashCode(normalizedCode);

    // Check if this hash exists and is unused
    const { data: existingCode, error: fetchError } = await supabase
      .from('mfa_recovery_codes')
      .select('id, used_at')
      .eq('user_id', user.id)
      .eq('code_hash', codeHash)
      .single();

    if (fetchError || !existingCode) {
      console.log('[RESET-PASSWORD-RECOVERY] Recovery code not found or invalid');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid recovery code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingCode.used_at) {
      console.log('[RESET-PASSWORD-RECOVERY] Recovery code already used');
      return new Response(
        JSON.stringify({ success: false, error: 'This recovery code has already been used' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update password using Admin API (bypasses AAL2 requirement)
    const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updatePasswordError) {
      console.error('[RESET-PASSWORD-RECOVERY] Failed to update password:', updatePasswordError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark the recovery code as used
    const { error: markUsedError } = await supabase
      .from('mfa_recovery_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', existingCode.id);

    if (markUsedError) {
      console.error('[RESET-PASSWORD-RECOVERY] Error marking code as used:', markUsedError);
      // Password already updated, so just log this error
    }

    // Clear password_reset_required flag
    await supabase
      .from('company_users')
      .update({ password_reset_required: false })
      .eq('profile_id', user.id);

    // Count remaining unused codes
    const { count } = await supabase
      .from('mfa_recovery_codes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('used_at', null);

    console.log(`[RESET-PASSWORD-RECOVERY] Password reset successful. ${count} recovery codes remaining.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        remainingCodes: count || 0,
        message: 'Password updated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RESET-PASSWORD-RECOVERY] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
