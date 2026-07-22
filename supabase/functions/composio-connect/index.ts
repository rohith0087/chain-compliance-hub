// Starts a Composio OAuth connection for the signed-in user.
//
// SECURITY — the single most important property of this function:
// the Composio user_id is derived from the JWT, never from the request body.
// That id IS the credential boundary: if a caller could influence it, they
// would read another tenant's tokens. This mirrors simple-rag-chat, which
// deliberately discards the client-supplied buyer_id and re-derives it.
//
// We store no credentials. Composio holds them; we keep only metadata.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { TOOLKITS, composioUserId, type ToolkitSlug } from '../_shared/composioToolkits.ts';

const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3.1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? 'https://compliance.tracer2c.com';

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const apiKey = Deno.env.get('COMPOSIO_API_KEY');
    if (!apiKey) return json({ error: 'Composio is not configured' }, 500);

    // ---- identity: from the token, full stop ----
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const toolkit = String(body?.toolkit ?? '') as ToolkitSlug;
    const config = TOOLKITS[toolkit];
    if (!config) {
      return json({ error: `Unsupported toolkit. Allowed: ${Object.keys(TOOLKITS).join(', ')}` }, 400);
    }
    if (!config.authConfigId) {
      return json({ error: `No auth config registered for ${toolkit}` }, 500);
    }

    // Any profile_id in the body is ignored on purpose.
    const profileId = user.id;
    const composioUser = composioUserId(profileId);

    // buyer_id is recorded for org visibility/audit only -- it grants nothing.
    let buyerId: string | null = null;
    const { data: companyUser } = await admin
      .from('company_users')
      .select('company_id, company_type')
      .eq('profile_id', profileId)
      .eq('status', 'active')
      .maybeSingle();
    if (companyUser?.company_type === 'buyer') {
      buyerId = companyUser.company_id;
    } else {
      const { data: buyer } = await admin.from('buyers').select('id').eq('profile_id', profileId).maybeSingle();
      buyerId = buyer?.id ?? null;
    }

    // ---- ask Composio to start the OAuth dance ----
    // Composio-managed OAuth auth configs must use /connected_accounts/link
    // (the plain /connected_accounts POST is deprecated for them and 400s).
    // The link endpoint returns a hosted connect URL + the connected_account_id.
    const callbackUrl = `${SUPABASE_URL}/functions/v1/composio-callback`;
    const res = await fetch(`${COMPOSIO_BASE}/connected_accounts/link`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_config_id: config.authConfigId,
        user_id: composioUser,
        callback_url: callbackUrl,
      }),
    });

    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }

    if (!res.ok) {
      // Provider specifics (status, slug, request_id) go to logs only. The
      // client gets a calm, generic line -- never "Composio 502".
      console.error('composio-connect initiate failed', {
        toolkit, status: res.status, slug: payload?.error?.slug, requestId: payload?.error?.request_id,
        message: payload?.error?.message,
      });
      return json({ error: 'We couldn’t start the connection. Please try again.' }, 502);
    }

    // /link returns connected_account_id (not id) and redirect_url.
    const connectedAccountId: string | null =
      payload?.connected_account_id ?? payload?.id ?? null;
    const redirectUrl: string | null =
      payload?.redirect_url ?? payload?.redirect_uri ?? payload?.connectionData?.val?.redirectUrl ?? null;

    if (!redirectUrl) {
      console.error('composio-connect: no redirect url in response', { toolkit, keys: Object.keys(payload ?? {}) });
      return json({ error: 'We couldn’t start the connection. Please try again.' }, 502);
    }

    // Record the pending connection. Upsert so re-connecting reuses the row.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = admin as any;
    await client.from('composio_connections').upsert(
      {
        profile_id: profileId,
        buyer_id: buyerId,
        toolkit,
        auth_config_id: config.authConfigId,
        connected_account_id: connectedAccountId,
        status: 'initiated',
        last_error: null,
      },
      { onConflict: 'profile_id,toolkit' },
    );

    return json({ ok: true, toolkit, redirectUrl, returnTo: `${APP_URL}/?open=integrations` });
  } catch (e) {
    // Full detail to logs; generic to the user.
    console.error('composio-connect fatal', e instanceof Error ? e.message : String(e));
    return json({ error: 'Something went wrong on our end. Please try again.' }, 500);
  }
});
