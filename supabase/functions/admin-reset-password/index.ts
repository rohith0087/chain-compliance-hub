import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_ORIGINS = [
  'https://compliance.tracer2c.com',
  'https://chain-compliance-hub.lovable.app',
];
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') ||
      host.endsWith('.lovableproject.com') || host.endsWith('.lovable.app') || host.endsWith('.lovable.dev');
  } catch { return false; }
}
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}

// Platform-admin-initiated password reset. Sends the standard Supabase recovery
// email to the target user (no plaintext temporary password is ever created or
// returned). Caller must be an active platform administrator.
Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid authentication');

    // Authorization: caller must be an active platform administrator.
    const { data: platformAdmin } = await supabase
      .from('platform_administrators')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!platformAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: platform admin role required' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const { user_id } = await req.json();
    if (!user_id || !UUID_REGEX.test(user_id)) throw new Error('Invalid or missing user_id');

    // Resolve the target user's email via the admin API.
    const { data: targetData, error: targetErr } = await supabase.auth.admin.getUserById(user_id);
    if (targetErr || !targetData?.user?.email) throw new Error('Target user not found');
    const email = targetData.user.email;

    // Redirect the recovery link back to the app's reset-password page.
    const origin = req.headers.get('Origin') || 'https://compliance.tracer2c.com';
    const redirectTo = `${origin}/reset-password`;

    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (resetErr) throw new Error(`Failed to send reset email: ${resetErr.message}`);

    return new Response(
      JSON.stringify({ success: true, message: `Password reset email sent to ${email}` }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in admin-reset-password:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
