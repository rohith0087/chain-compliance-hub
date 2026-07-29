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

// Enable/disable a user account. Authorized for platform admins OR a partner
// (reseller) member whose partner manages a company the target user belongs to.
// Disabling sets profiles.account_disabled AND bans the GoTrue user so existing
// sessions are invalidated; the login gate shows a custom "contact support" message.
Deno.serve(async (req) => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Invalid authentication');

    const { user_id, disabled } = await req.json();
    if (!user_id || !UUID_REGEX.test(user_id)) throw new Error('Invalid or missing user_id');
    if (typeof disabled !== 'boolean') throw new Error('Missing disabled flag');
    if (user_id === user.id) throw new Error('You cannot disable your own account');

    // ---- Authorization: platform admin OR partner managing the target's company ----
    const { data: admin } = await supabase.from('platform_administrators')
      .select('id').eq('auth_user_id', user.id).eq('is_active', true).maybeSingle();

    let authorized = !!admin;
    let partnerId: string | null = null;
    let matchCompanyId: string | null = null;
    let matchCompanyType: string | null = null;

    if (!authorized) {
      const { data: mem } = await supabase.from('partner_members')
        .select('partner_id').eq('profile_id', user.id).eq('status', 'active');
      let partnerIds = (mem ?? []).map((m: { partner_id: string }) => m.partner_id);
      if (partnerIds.length) {
        const { data: activeParts } = await supabase.from('partners').select('id').in('id', partnerIds).eq('status', 'active');
        partnerIds = (activeParts ?? []).map((p: { id: string }) => p.id);
      }
      if (partnerIds.length) {
        const { data: targetCos } = await supabase.from('company_users')
          .select('company_id, company_type').eq('profile_id', user_id).eq('status', 'active');
        if (targetCos?.length) {
          const { data: links } = await supabase.from('partner_customer_links')
            .select('partner_id, company_id, company_type').in('partner_id', partnerIds).eq('status', 'active');
          const targetSet = new Set((targetCos as Array<{ company_id: string; company_type: string }>)
            .map((c) => `${c.company_type}:${c.company_id}`));
          const match = (links as Array<{ partner_id: string; company_id: string; company_type: string }> ?? [])
            .find((l) => targetSet.has(`${l.company_type}:${l.company_id}`));
          if (match) { authorized = true; partnerId = match.partner_id; matchCompanyId = match.company_id; matchCompanyType = match.company_type; }
        }
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 403, headers });
    }

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

    // Audit partner-initiated actions (customer-visible + accountable).
    if (partnerId) {
      await supabase.from('partner_action_audit').insert({
        partner_id: partnerId,
        actor_profile_id: user.id,
        company_id: matchCompanyId,
        company_type: matchCompanyType,
        target_profile_id: user_id,
        action: disabled ? 'disable_user' : 'enable_user',
        detail: {},
      });
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
