import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateAuthenticationOptions } from 'npm:@simplewebauthn/server@13.1.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';

const RP_ID = 'compliance.tracer2c.com';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const pre = handleCorsPreflightRequest(req);
  if (pre) return pre;

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
      // Resolve user by email via admin API
      const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = userList?.users?.find((u) => (u.email ?? '').toLowerCase() === email);
      if (match) {
        userId = match.id;
        const { data: creds } = await supabase
          .from('user_passkeys')
          .select('credential_id, transports')
          .eq('user_id', match.id);
        allowCredentials = (creds ?? []).map((c) => ({
          id: c.credential_id,
          transports: (c.transports ?? []) as AuthenticatorTransport[],
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'preferred',
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
