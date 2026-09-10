import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { generateAuthenticationOptions } from 'npm:@simplewebauthn/server@13.1.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';

const RP_ID = 'compliance.tracer2c.com';

function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    'unknown'
  );
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const pre = handleCorsPreflightRequest(req);
  if (pre) return pre;

  // Security audit 2026-09-02 (F-14): this endpoint is reachable before sign-in and
  // writes a challenge row per call, so it is rate limited per client address.
  const rl = checkRateLimit(`passkey-auth-begin:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) return rateLimitResponse(corsHeaders, rl.retryAfterMs);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let email: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.email === 'string' && body.email.trim()) {
        email = body.email.trim().toLowerCase();
      }
    } catch {
      // no body is fine — fully discoverable flow
    }

    let userId: string | null = null;
    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = [];

    if (email) {
      // Exact lookup. The previous listUsers({ perPage: 200 }) scan silently stopped
      // working for any user beyond the first 200 accounts.
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (profile?.id) {
        userId = profile.id;
        const { data: creds } = await supabase
          .from('user_passkeys')
          .select('credential_id, transports')
          .eq('user_id', profile.id);
        allowCredentials = (creds ?? []).map((c) => ({
          id: c.credential_id,
          transports: (c.transports ?? []) as AuthenticatorTransport[],
        }));
      }
    }

    // userVerification 'required': a passkey sign-in bypasses the TOTP step, so the
    // authenticator itself must prove presence AND a PIN/biometric (F-14).
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'required',
    });

    await supabase.from('passkey_challenges').insert({
      user_id: userId,
      challenge: options.challenge,
      ceremony_type: 'authentication',
    });

    return new Response(JSON.stringify(options), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('passkey-auth-begin error', err);
    return new Response(JSON.stringify({ error: 'Failed to start passkey sign-in' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
