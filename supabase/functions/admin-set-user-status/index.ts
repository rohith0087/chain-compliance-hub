import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_ORIGINS = ['https://compliance.tracer2c.com', 'https://chain-compliance-hub.lovable.app'];
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') ||
      host.endsWith('.lovableproject.com') || host.endsWith('.lovable.app') || host.endsWith('.lovable.dev');
  } catch { return false; }
}
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// Enable/disable a user account (platform-admin only). Disabling sets the
// profiles.account_disabled flag AND bans the GoTrue user so existing sessions
// are invalidated; the login gate shows a custom "contact support" message.
Deno.serve(async (req) => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Invalid authentication');

    const { data: admin } = await supabase.from('platform_administrators')
      .select('id').eq('auth_user_id', user.id).eq('is_active', true).maybeSingle();
    if (!admin) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 403, headers });

    const { user_id, disabled } = await req.json();
    if (!user_id || !UUID_REGEX.test(user_id)) throw new Error('Invalid or missing user_id');
    if (typeof disabled !== 'boolean') throw new Error('Missing disabled flag');
    if (user_id === user.id) throw new Error('You cannot disable your own account');

    // Flag on the profile (queried by the login gate + shown in the admin UI).
    const { error: profErr } = await supabase.from('profiles')
      .update({ account_disabled: disabled }).eq('id', user_id);
    if (profErr) throw new Error(`Failed to update profile: ${profErr.message}`);

    // Hard enforcement: ban invalidates refresh tokens / existing sessions.
    // If the ban/unban fails, roll back the profile flag so the UI never shows
    // a state that isn't actually enforced, and report an honest failure.
    const { error: banErr } = await supabase.auth.admin.updateUserById(user_id, {
      ban_duration: disabled ? '876000h' : 'none',
    });
    if (banErr) {
      console.error('ban update failed, rolling back profile flag:', banErr.message);
      const { error: rollbackErr } = await supabase.from('profiles')
        .update({ account_disabled: !disabled }).eq('id', user_id);
      if (rollbackErr) {
        console.error('profile flag rollback failed:', rollbackErr.message);
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to ${disabled ? 'ban' : 'unban'} user session: ${banErr.message}. Profile flag was rolled back.`,
        }),
        { status: 500, headers },
      );
    }

    return new Response(
      JSON.stringify({ success: true, disabled, message: disabled ? 'User disabled' : 'User re-enabled' }),
      { headers },
    );
  } catch (error) {
    console.error('admin-set-user-status error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 400, headers },
    );
  }
});
