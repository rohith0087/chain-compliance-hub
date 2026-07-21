// Revokes a user's Composio connection.
//
// SECURITY: identity comes from the JWT. A user can only disconnect their OWN
// connection -- the row is looked up by (profile_id from token, toolkit), so a
// caller cannot name someone else's connection.
//
// Revocation happens at Composio first. Deleting only our row would leave a
// live grant on the third party that the user believes they revoked, which is
// worse than not offering the button at all.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3.1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const toolkit = String(body?.toolkit ?? '');
    if (!toolkit) return json({ error: 'toolkit is required' }, 400);

    // Scoped to the caller: no way to name another person's connection.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = admin as any;
    const { data: row } = await client
      .from('composio_connections')
      .select('id, connected_account_id')
      .eq('profile_id', user.id)
      .eq('toolkit', toolkit)
      .maybeSingle();

    if (!row) return json({ error: 'No such connection' }, 404);

    // Revoke upstream first.
    let revoked = false;
    let revokeError: string | null = null;
    if (row.connected_account_id) {
      const apiKey = Deno.env.get('COMPOSIO_API_KEY');
      if (!apiKey) return json({ error: 'Composio is not configured' }, 500);

      const res = await fetch(`${COMPOSIO_BASE}/connected_accounts/${row.connected_account_id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      });
      // 404 means it is already gone upstream -- treat as revoked.
      revoked = res.ok || res.status === 404;
      if (!revoked) {
        revokeError = `Composio returned ${res.status}`;
        console.error('composio-disconnect: upstream revoke failed', { toolkit, status: res.status });
      }
    } else {
      // Never completed OAuth, so there is nothing upstream to revoke.
      revoked = true;
    }

    if (!revoked) {
      // Keep the row and surface the failure rather than pretending success --
      // the user's grant is still live on the third party.
      await client.from('composio_connections')
        .update({ last_error: `Disconnect failed: ${revokeError}` })
        .eq('id', row.id);
      return json({ error: 'Could not revoke access at the provider. Please try again.' }, 502);
    }

    await client.from('composio_connections').delete().eq('id', row.id);
    return json({ ok: true, toolkit });
  } catch (e) {
    console.error('composio-disconnect fatal', e instanceof Error ? e.message : String(e));
    return json({ error: 'Something went wrong on our end. Please try again.' }, 500);
  }
});
