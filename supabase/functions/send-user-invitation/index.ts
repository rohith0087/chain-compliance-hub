import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from 'npm:resend@4.0.1';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';

interface ResendInvitationRequest {
  recipientEmail?: unknown;
  companyId?: unknown;
  companyType?: unknown;
  branchId?: unknown;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse(context, { success: false, error: 'Authentication required' }, 401);
    }

    const supabase = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey());
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(
      authHeader.slice('Bearer '.length),
    );
    if (authError || !caller) {
      return jsonResponse(context, { success: false, error: 'Invalid authentication' }, 401);
    }

    const limit = checkRateLimit(`send-user-invitation:${caller.id}`, 10, 60_000);
    if (!limit.allowed) return rateLimitResponse(context.corsHeaders, limit.retryAfterMs);

    const body = await req.json() as ResendInvitationRequest;
    const recipientEmail = typeof body.recipientEmail === 'string'
      ? body.recipientEmail.trim().toLowerCase()
      : '';
    const companyId = typeof body.companyId === 'string' ? body.companyId : '';
    const companyType = body.companyType === 'buyer' || body.companyType === 'supplier'
      ? body.companyType
      : null;
    const branchId = typeof body.branchId === 'string' ? body.branchId : null;

    if (!EMAIL_PATTERN.test(recipientEmail) || !companyId || !companyType) {
      return jsonResponse(context, { success: false, error: 'Invalid invitation request' }, 400);
    }

    const [{ data: platformAdmin }, { data: owner }, { data: companyAdmin }] = await Promise.all([
      supabase
        .from('platform_administrators')
        .select('id')
        .eq('auth_user_id', caller.id)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from(companyType === 'buyer' ? 'buyers' : 'suppliers')
        .select('id')
        .eq('id', companyId)
        .eq('profile_id', caller.id)
        .maybeSingle(),
      supabase
        .from('company_users')
        .select('id')
        .eq('profile_id', caller.id)
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .eq('role', 'company_admin')
        .eq('status', 'active')
        .maybeSingle(),
    ]);

    if (!platformAdmin && !owner && !companyAdmin) {
      logEvent('warn', 'invitation_resend_forbidden', context, { caller_id: caller.id, company_id: companyId });
      return jsonResponse(context, { success: false, error: 'Company administrator access required' }, 403);
    }

    const { data: recipient } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .ilike('email', recipientEmail)
      .maybeSingle();

    if (!recipient) {
      return jsonResponse(
        context,
        { success: false, error: 'No existing account is available to reinvite. Create the user first.' },
        404,
      );
    }

    let membershipQuery = supabase
      .from('company_users')
      .select('id, role, status, branch_id')
      .eq('profile_id', recipient.id)
      .eq('company_id', companyId)
      .eq('company_type', companyType);
    if (branchId) membershipQuery = membershipQuery.eq('branch_id', branchId);
    const { data: membership } = await membershipQuery.maybeSingle();

    if (!membership) {
      return jsonResponse(context, { success: false, error: 'User is not assigned to this company or branch' }, 404);
    }

    const redirectTo = `${requireEnv('APP_BASE_URL').replace(/\/$/, '')}/reset-password`;
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: recipientEmail,
      options: { redirectTo },
    });
    const recoveryUrl = linkData?.properties?.action_link;
    if (linkError || !recoveryUrl) throw new Error('Unable to create a secure sign-in link');

    const companyTable = companyType === 'buyer' ? 'buyers' : 'suppliers';
    const { data: company } = await supabase
      .from(companyTable)
      .select('company_name')
      .eq('id', companyId)
      .single();

    const recipientName = escapeHtml(recipient.full_name || recipientEmail);
    const companyName = escapeHtml(company?.company_name || 'your company');
    const role = escapeHtml(String(membership.role).replace(/_/g, ' '));

    const resend = new Resend(requireEnv('RESEND_API_KEY'));
    const emailResult = await resend.emails.send({
      from: 'TraceR2C Compliance <no-reply@tracer2c.com>',
      to: [recipientEmail],
      subject: `Your access to ${companyName}`,
      html: `
        <h2>Your TraceR2C access is ready</h2>
        <p>Hello ${recipientName},</p>
        <p>You have been assigned access to <strong>${companyName}</strong> as ${role}.</p>
        <p><a href="${escapeHtml(recoveryUrl)}">Set your password and sign in</a></p>
        <p>This is a single-use security link. If you did not expect this message, ignore it and contact your administrator.</p>
      `,
    });
    if (emailResult.error) throw new Error('Unable to send invitation email');

    logEvent('info', 'invitation_resent', context, {
      caller_id: caller.id,
      recipient_id: recipient.id,
      company_id: companyId,
      membership_id: membership.id,
    });
    return jsonResponse(context, {
      success: true,
      userExists: true,
      alreadyInCompany: false,
      message: 'Secure invitation sent',
    });
  } catch (error) {
    logEvent('error', 'invitation_resend_failed', context, {
      error: error instanceof Error ? error.message : 'unknown error',
    });
    return jsonResponse(context, { success: false, error: 'Unable to send invitation' }, 500);
  }
});
