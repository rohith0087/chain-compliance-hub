import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@13.1.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';

const RP_ID = 'compliance.tracer2c.com';
const ALLOWED_ORIGINS = [
  'https://compliance.tracer2c.com',
  'https://chain-compliance-hub.lovable.app',
  'https://id-preview--d13fec6e-29ed-4735-a9d4-57941fe886cc.lovable.app',
];

function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    'unknown'
  );
}

/** The challenge the authenticator actually signed, read from clientDataJSON (base64url). */
function challengeFromAssertion(assertion: { response?: { clientDataJSON?: unknown } }): string | null {
  try {
    const raw = String(assertion?.response?.clientDataJSON ?? '');
    if (!raw) return null;
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = JSON.parse(atob(padded));
    return typeof json?.challenge === 'string' && json.challenge.length > 0 ? json.challenge : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const pre = handleCorsPreflightRequest(req);
  if (pre) return pre;

  const rl = checkRateLimit(`passkey-auth-finish:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) return rateLimitResponse(corsHeaders, rl.retryAfterMs);

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

    // Security audit 2026-09-02 (F-14): bind the ceremony to the challenge we issued.
    // The row is looked up by the exact challenge the authenticator signed, must be an
    // authentication challenge, unexpired, and — when it was issued for a specific
    // account — that account must own this passkey. It is consumed on first use.
    const signedChallenge = challengeFromAssertion(assertion);
    if (!signedChallenge) {
      return new Response(JSON.stringify({ error: 'Malformed response' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: challengeRow } = await supabase
      .from('passkey_challenges')
      .select('id, challenge, expires_at, user_id')
      .eq('ceremony_type', 'authentication')
      .eq('challenge', signedChallenge)
      .maybeSingle();

    if (!challengeRow || new Date(challengeRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Challenge expired' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Single use, whatever happens next.
    await supabase.from('passkey_challenges').delete().eq('id', challengeRow.id);

    if (challengeRow.user_id && challengeRow.user_id !== passkey.user_id) {
      return new Response(JSON.stringify({ error: 'Verification failed' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    // requireUserVerification: passkey sign-in skips the TOTP step, so possession of the
    // authenticator alone is not enough — it must have verified the person (PIN/biometric).
    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: ALLOWED_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: true,
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

    // Fetch user to get email
    const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(passkey.user_id);
    if (userErr || !userRes?.user?.email) {
      return new Response(JSON.stringify({ error: 'Account has no email' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Disabled-account gate: refuse to mint a sign-in token for disabled accounts
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_disabled')
      .eq('id', passkey.user_id)
      .maybeSingle();

    if (profile?.account_disabled === true) {
      return new Response(JSON.stringify({
        error: "There's a problem with your account and you can't sign in right now. Please contact support@tracer2c.com for help.",
        code: 'account_disabled',
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
