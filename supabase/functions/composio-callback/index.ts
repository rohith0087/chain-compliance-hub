// Where Composio sends the user's browser after they finish OAuth.
//
// SECURITY: this endpoint is reached by a browser redirect, so it has NO JWT
// and its query string is attacker-controllable. It therefore trusts nothing
// from the URL beyond an identifier to look up:
//
//   * the connection row is found by connected_account_id, which we recorded
//     ourselves when initiating -- an unknown id is ignored;
//   * the real status is fetched from Composio server-side. A crafted
//     ?status=ACTIVE cannot mark anything active.
//
// It always redirects the browser somewhere sensible rather than rendering an
// error page, so a failed connect lands the user back in settings.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3.1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? 'https://compliance.tracer2c.com';

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

/** Composio connection states -> our status vocabulary. */
function mapStatus(raw: string | undefined): 'active' | 'failed' | 'expired' | 'initiated' {
  switch ((raw ?? '').toUpperCase()) {
    case 'ACTIVE': return 'active';
    case 'EXPIRED': return 'expired';
    case 'FAILED':
    case 'INACTIVE': return 'failed';
    default: return 'initiated';
  }
}

function back(params: Record<string, string>): Response {
  // Settings is a tab inside the app shell, not its own route, so we land on the
  // app root with `open=integrations`; the dashboard reads that on mount and
  // switches to the integrations tab. The composio_* params drive the toast.
  const url = new URL(`${APP_URL}/`);
  url.searchParams.set('open', 'integrations');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return Response.redirect(url.toString(), 302);
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const connectedAccountId =
      url.searchParams.get('connected_account_id') ?? url.searchParams.get('connectedAccountId');

    if (!connectedAccountId) {
      console.warn('composio-callback: no connected_account_id in redirect');
      return back({ composio_error: 'missing_connection' });
    }

    // Look up OUR record. If we never initiated this, there is nothing to do --
    // this is what stops a forged callback creating or mutating a connection.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = admin as any;
    const { data: row } = await client
      .from('composio_connections')
      .select('id, toolkit, profile_id')
      .eq('connected_account_id', connectedAccountId)
      .maybeSingle();

    if (!row) {
      console.warn('composio-callback: unknown connected_account_id');
      return back({ composio_error: 'unknown_connection' });
    }

    // Ask Composio what actually happened. The query string does not decide.
    const apiKey = Deno.env.get('COMPOSIO_API_KEY');
    if (!apiKey) return back({ composio_error: 'not_configured' });

    const res = await fetch(`${COMPOSIO_BASE}/connected_accounts/${connectedAccountId}`, {
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    });
    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }

    if (!res.ok) {
      await client.from('composio_connections')
        .update({ status: 'failed', last_error: payload?.error?.message ?? `Composio ${res.status}` })
        .eq('id', row.id);
      return back({ composio_error: 'verification_failed' });
    }

    const status = mapStatus(payload?.status);
    await client.from('composio_connections')
      .update({
        status,
        connected_at: status === 'active' ? new Date().toISOString() : null,
        last_error: status === 'active' ? null : `Connection ended in state ${payload?.status ?? 'unknown'}`,
      })
      .eq('id', row.id);

    console.log('composio-callback resolved', { toolkit: row.toolkit, status });

    return status === 'active'
      ? back({ composio_connected: row.toolkit })
      : back({ composio_error: status });
  } catch (e) {
    console.error('composio-callback fatal', e instanceof Error ? e.message : String(e));
    return back({ composio_error: 'unexpected' });
  }
});
