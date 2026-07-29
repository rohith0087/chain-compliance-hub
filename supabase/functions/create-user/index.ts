import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COMPANY_ROLES = ['company_admin', 'branch_manager', 'document_manager', 'approver', 'auditor', 'viewer'];
const PARTNER_ROLES = ['partner_admin', 'partner_manager', 'partner_agent'];

const ALLOWED_ORIGINS = [
  'https://compliance.tracer2c.com', 'https://sys.tracer2c.com', 'https://ops.tracer2c.com',
  'https://chain-compliance-hub.lovable.app',
];
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') ||
      host.endsWith('.tracer2c.com') || host.endsWith('.lovableproject.com') || host.endsWith('.lovable.app') || host.endsWith('.lovable.dev');
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isPlatformAdmin(uid: string): Promise<boolean> {
  const { data } = await supabase.from('platform_administrators').select('id').eq('auth_user_id', uid).eq('is_active', true).maybeSingle();
  return !!data;
}
async function isCompanyAdmin(uid: string, companyId: string, companyType: string): Promise<boolean> {
  const { data } = await supabase.from('company_users').select('id')
    .eq('profile_id', uid).eq('company_id', companyId).eq('company_type', companyType).eq('role', 'company_admin').eq('status', 'active').maybeSingle();
  return !!data;
}
async function partnerManagesCompany(uid: string, companyId: string, companyType: string): Promise<string | null> {
  const { data: mem } = await supabase.from('partner_members').select('partner_id').eq('profile_id', uid).eq('status', 'active');
  let ids = (mem ?? []).map((m: { partner_id: string }) => m.partner_id);
  if (!ids.length) return null;
  const { data: ap } = await supabase.from('partners').select('id').in('id', ids).eq('status', 'active');
  ids = (ap ?? []).map((p: { id: string }) => p.id);
  if (!ids.length) return null;
  const { data: links } = await supabase.from('partner_customer_links').select('partner_id')
    .eq('company_id', companyId).eq('company_type', companyType).eq('status', 'active').in('partner_id', ids);
  return links && links.length ? (links[0] as { partner_id: string }).partner_id : null;
}
async function isPartnerAdmin(uid: string, partnerId: string): Promise<boolean> {
  const { data } = await supabase.from('partner_members').select('id')
    .eq('profile_id', uid).eq('partner_id', partnerId).eq('role', 'partner_admin').eq('status', 'active').maybeSingle();
  if (!data) return false;
  const { data: p } = await supabase.from('partners').select('id').eq('id', partnerId).eq('status', 'active').maybeSingle();
  return !!p;
}

Deno.serve(async (req) => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Invalid authentication');

    const body = await req.json();
    const kind: string = body.kind;
    const email: string = (body.email ?? '').trim().toLowerCase();
    const fullName: string | null = body.full_name?.trim() || null;
    const role: string | undefined = body.role;
    const companyId: string | undefined = body.company_id;
    const companyType: string | undefined = body.company_type;
    const partnerId: string | undefined = body.partner_id;

    if (!EMAIL_RE.test(email)) throw new Error('Invalid email');
    if (!['account', 'company_user', 'partner_member'].includes(kind)) throw new Error('Invalid kind');

    // ---- Authorization + validation per kind ----
    const admin = await isPlatformAdmin(user.id);
    let actingPartnerId: string | null = null;

    if (kind === 'account') {
      if (!admin) return new Response(JSON.stringify({ success: false, error: 'Only platform admins can create bare accounts' }), { status: 403, headers });
    } else if (kind === 'company_user') {
      if (!companyId || (companyType !== 'buyer' && companyType !== 'supplier')) throw new Error('company_id/company_type required');
      if (!role || !COMPANY_ROLES.includes(role)) throw new Error('Invalid role for a company user');
      if (!admin) {
        if (await isCompanyAdmin(user.id, companyId, companyType)) { /* ok */ }
        else {
          actingPartnerId = await partnerManagesCompany(user.id, companyId, companyType);
          if (!actingPartnerId) return new Response(JSON.stringify({ success: false, error: 'Not authorized for this company' }), { status: 403, headers });
        }
      }
    } else { // partner_member
      if (!partnerId) throw new Error('partner_id required');
      if (!role || !PARTNER_ROLES.includes(role)) throw new Error('Invalid partner role');
      if (!admin && !(await isPartnerAdmin(user.id, partnerId))) {
        return new Response(JSON.stringify({ success: false, error: 'Not authorized for this partner' }), { status: 403, headers });
      }
    }

    // ---- Resolve or invite the identity ----
    const { data: existingProfile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    let profileId: string;
    let invited = false;
    if (existingProfile) {
      profileId = (existingProfile as { id: string }).id;
    } else {
      const origin = req.headers.get('Origin') || 'https://compliance.tracer2c.com';
      const { data: inv, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: fullName ? { full_name: fullName } : {},
        redirectTo: `${origin}/reset-password`,
      });
      if (invErr || !inv?.user) throw new Error(`Failed to invite user: ${invErr?.message ?? 'unknown'}`);
      profileId = inv.user.id;
      invited = true;
      if (fullName) await supabase.from('profiles').update({ full_name: fullName }).eq('id', profileId);
    }

    // ---- Create the membership ----
    let membership = 'created';
    if (kind === 'company_user') {
      const { data: ex } = await supabase.from('company_users').select('id, status')
        .eq('profile_id', profileId).eq('company_id', companyId).eq('company_type', companyType).maybeSingle();
      if (ex) {
        if ((ex as { status: string }).status === 'active') {
          membership = 'already_member';
        } else {
          await supabase.from('company_users').update({ status: 'active', role, updated_at: new Date().toISOString() }).eq('id', (ex as { id: string }).id);
          membership = 'reactivated';
        }
      } else {
        await supabase.from('company_users').insert({ profile_id: profileId, company_id: companyId, company_type: companyType, role, status: 'active', invited_by: user.id });
      }
      if (actingPartnerId && membership !== 'already_member') {
        await supabase.from('partner_action_audit').insert({
          partner_id: actingPartnerId, actor_profile_id: user.id, company_id: companyId, company_type: companyType,
          target_profile_id: profileId, action: 'add_user', detail: { role, invited },
        });
      }
    } else if (kind === 'partner_member') {
      await supabase.from('partner_members').upsert(
        { partner_id: partnerId, profile_id: profileId, role, status: 'active', invited_by: user.id },
        { onConflict: 'partner_id,profile_id' },
      );
    }

    return new Response(JSON.stringify({ success: true, invited, membership, profile_id: profileId }), { headers });
  } catch (error) {
    console.error('create-user error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }), { status: 400, headers });
  }
});
