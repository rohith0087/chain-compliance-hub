-- SECURITY: integration_connections exposed live third-party secrets to every
-- member of a buyer org.
--
-- The RLS policy is:
--     create policy "ic_select" ... for select using (private.is_buyer_member(organization_id));
--
-- Member-level SELECT with no column restriction. The app's own UI only reads
-- non-secret columns, but RLS is the actual boundary: any authenticated member
-- could run .select('access_token, refresh_token') from the browser and read
-- the org's live OAuth credentials. config->>'webhook_url' is equally sensitive
-- -- a Slack incoming webhook lets anyone holding it post into the customer's
-- channel -- and the UI does read `config`.
--
-- Fix, in two parts:
--   1. Move the Slack webhook out of `config` into its own column, so `config`
--      holds only display settings and can stay readable.
--   2. Replace the blanket table grant with column-level grants that exclude
--      every secret. service_role (edge functions) is unaffected.
--
-- Writes were already admin-only and are left as they are.

-- ── 1. webhook_url out of config ──────────────────────────────────────────────

ALTER TABLE public.integration_connections
  ADD COLUMN IF NOT EXISTS webhook_url text;

-- Backfill from the jsonb blob, then strip it so the secret has exactly one home.
UPDATE public.integration_connections
   SET webhook_url = config->>'webhook_url'
 WHERE webhook_url IS NULL
   AND config ? 'webhook_url';

UPDATE public.integration_connections
   SET config = config - 'webhook_url'
 WHERE config ? 'webhook_url';

COMMENT ON COLUMN public.integration_connections.webhook_url IS
  'Slack incoming webhook. Secret: readable only by service_role. Never grant to authenticated.';
COMMENT ON COLUMN public.integration_connections.access_token IS
  'Secret: readable only by service_role.';
COMMENT ON COLUMN public.integration_connections.refresh_token IS
  'Secret: readable only by service_role.';

-- ── 2. Column-level grants ────────────────────────────────────────────────────

-- Supabase grants ALL on public tables to anon/authenticated by default, which
-- is what exposed the secrets. Drop that and re-grant only the safe columns.
REVOKE ALL ON TABLE public.integration_connections FROM anon, authenticated;

-- Note: with column-level grants, `select *` is rejected outright. Callers must
-- name columns -- IntegrationsPanel already does.
GRANT SELECT (
  id,
  organization_id,
  provider,
  status,
  token_expires_at,
  config,
  connected_by,
  connected_at,
  last_synced_at,
  last_error
) ON public.integration_connections TO authenticated;

-- Writes stay server-side (the oauth callback function runs as service_role);
-- the admin-only INSERT/UPDATE/DELETE policies remain but now have no
-- accompanying grant, so the client cannot write directly either.

-- Belt and braces: this table has never been for anonymous access.
REVOKE ALL ON TABLE public.integration_oauth_state FROM anon, authenticated;

GRANT ALL ON public.integration_connections TO service_role;
GRANT ALL ON public.integration_oauth_state TO service_role;
