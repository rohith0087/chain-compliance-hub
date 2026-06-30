import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateRegistrationOptions } from 'npm:@simplewebauthn/server@13.1.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';

const RP_ID = 'compliance.tracer2c.com';
const RP_NAME = 'tracer2c';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const pre = handleCorsPreflightRequest(req);
  if (pre) return pre;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Existing credentials to exclude
    const { data: existing } = await supabase
      .from('user_passkeys')
      .select('credential_id, transports')
      .eq('user_id', user.id);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email ?? user.id,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: (existing ?? []).map((c) => ({
        id: c.credential_id,
        transports: (c.transports ?? []) as AuthenticatorTransport[],
      })),
    });

    // Store challenge
    await supabase.from('passkey_challenges').insert({
      user_id: user.id,
      challenge: options.challenge,
      ceremony_type: 'registration',
    });

    return new Response(JSON.stringify(options), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('passkey-register-begin error', err);
    return new Response(JSON.stringify({ error: 'Failed to start registration' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
