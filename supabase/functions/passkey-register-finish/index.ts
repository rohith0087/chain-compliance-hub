import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyRegistrationResponse } from 'npm:@simplewebauthn/server@13.1.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';

const RP_ID = 'compliance.tracer2c.com';
const ALLOWED_ORIGINS = [
  'https://compliance.tracer2c.com',
  'https://chain-compliance-hub.lovable.app',
  'https://id-preview--d13fec6e-29ed-4735-a9d4-57941fe886cc.lovable.app',
];

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

    const body = await req.json();
    const { response: attestation, nickname } = body ?? {};
    if (!attestation) {
      return new Response(JSON.stringify({ error: 'Missing response' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Latest challenge for this user
    const { data: challengeRow } = await supabase
      .from('passkey_challenges')
      .select('id, challenge, expires_at')
      .eq('user_id', user.id)
      .eq('ceremony_type', 'registration')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challengeRow || new Date(challengeRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Challenge expired' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: ALLOWED_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return new Response(JSON.stringify({ error: 'Verification failed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const info = verification.registrationInfo;
    const cred = info.credential;

    const { error: insertErr } = await supabase.from('user_passkeys').insert({
      user_id: user.id,
      credential_id: cred.id,
      public_key: cred.publicKey,
      counter: cred.counter ?? 0,
      transports: cred.transports ?? [],
      device_type: info.credentialDeviceType,
      backed_up: info.credentialBackedUp,
      nickname: (typeof nickname === 'string' && nickname.trim()) ? nickname.trim().slice(0, 60) : 'Passkey',
    });

    if (insertErr) {
      console.error('insert passkey error', insertErr);
      return new Response(JSON.stringify({ error: 'Could not save passkey' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cleanup challenge
    await supabase.from('passkey_challenges').delete().eq('id', challengeRow.id);

    return new Response(JSON.stringify({ verified: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('passkey-register-finish error', err);
    return new Response(JSON.stringify({ error: 'Failed to finish registration' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
