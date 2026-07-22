import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@13.1.1';
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => null);
    const assertion = body?.response;
    if (!assertion?.id) {
      return new Response(JSON.stringify({ error: 'Missing response' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the passkey by credential id
    const { data: passkey } = await supabase
      .from('user_passkeys')
      .select('id, user_id, credential_id, public_key, counter, transports')
      .eq('credential_id', assertion.id)
      .maybeSingle();

    if (!passkey) {
      return new Response(JSON.stringify({ error: 'Unknown passkey' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Grab latest authentication challenge that either matches this user OR is discoverable (user_id null)
    const { data: challengeRow } = await supabase
      .from('passkey_challenges')
      .select('id, challenge, expires_at, user_id')
      .eq('ceremony_type', 'authentication')
      .or(`user_id.eq.${passkey.user_id},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challengeRow || new Date(challengeRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Challenge expired' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // publicKey stored as bytea comes back as base64 or hex depending on driver — normalize to Uint8Array
    let publicKeyBytes: Uint8Array;
    const pk = passkey.public_key as unknown;
    if (pk instanceof Uint8Array) {
      publicKeyBytes = pk;
    } else if (typeof pk === 'string') {
      if (pk.startsWith('\\x')) {
        const hex = pk.slice(2);
        publicKeyBytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < publicKeyBytes.length; i++) {
          publicKeyBytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
      } else {
        // base64
        const bin = atob(pk);
        publicKeyBytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) publicKeyBytes[i] = bin.charCodeAt(i);
      }
    } else {
      publicKeyBytes = new Uint8Array(pk as ArrayBufferLike);
    }

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: ALLOWED_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: false,
      credential: {
        id: passkey.credential_id,
        publicKey: publicKeyBytes,
        counter: passkey.counter ?? 0,
        transports: (passkey.transports ?? []) as AuthenticatorTransport[],
      },
    });

    if (!verification.verified) {
      return new Response(JSON.stringify({ error: 'Verification failed' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update counter + last_used_at
    await supabase
      .from('user_passkeys')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', passkey.id);

    // Cleanup used challenge
    await supabase.from('passkey_challenges').delete().eq('id', challengeRow.id);

    // Fetch user to get email
    const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(passkey.user_id);
    if (userErr || !userRes?.user?.email) {
      return new Response(JSON.stringify({ error: 'Account has no email' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mint a magic link and return its token hash — the client verifies it to establish a session
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userRes.user.email,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error('generateLink error', linkErr);
      return new Response(JSON.stringify({ error: 'Could not create session' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      verified: true,
      email: userRes.user.email,
      token_hash: linkData.properties.hashed_token,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('passkey-auth-finish error', err);
    return new Response(JSON.stringify({ error: 'Failed to finish passkey sign-in' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
