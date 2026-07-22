-- Composio connections: metadata ONLY. No access tokens, no refresh tokens, no
-- webhook URLs. Composio holds every credential; this table records that a
-- connection exists, who owns it, and whether it is usable.
--
-- This is the deliberate contrast with integration_connections, which stored
-- plaintext OAuth tokens readable by any org member (see
-- 20260721140000_lock_down_integration_secrets.sql). There is nothing to leak
-- here because there is nothing secret here.
--
-- Scoping is per-user: the Composio user_id is `user:<profile_id>`, derived
-- server-side from the JWT and never accepted from the client. buyer_id is
-- recorded for org-level visibility and audit, not for access.

CREATE TABLE IF NOT EXISTS public.composio_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES public.buyers(id) ON DELETE SET NULL,
  toolkit text NOT NULL,
  auth_config_id text NOT NULL,
  connected_account_id text,
  status text NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated','active','failed','expired','revoked')),
  connected_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One connection per person per toolkit; re-connecting updates in place.
  UNIQUE (profile_id, toolkit)
);

COMMENT ON TABLE public.composio_connections IS
  'Per-user Composio connection metadata. Contains no credentials by design -- Composio stores and refreshes all tokens.';
COMMENT ON COLUMN public.composio_connections.connected_account_id IS
  'Composio''s connected account id. An opaque handle, not a credential, but only ever used server-side.';

CREATE INDEX IF NOT EXISTS composio_connections_profile_idx
  ON public.composio_connections (profile_id);
CREATE INDEX IF NOT EXISTS composio_connections_buyer_idx
  ON public.composio_connections (buyer_id);

ALTER TABLE public.composio_connections ENABLE ROW LEVEL SECURITY;

-- Explicit column grants rather than a blanket one: the same mistake that
-- exposed integration_connections. Writes happen server-side via the edge
-- functions on service_role, so clients get SELECT only.
REVOKE ALL ON TABLE public.composio_connections FROM anon, authenticated;

GRANT SELECT (
  id, profile_id, buyer_id, toolkit, status,
  connected_at, last_error, created_at, updated_at
) ON public.composio_connections TO authenticated;

GRANT ALL ON public.composio_connections TO service_role;

-- A user sees their own connections. Buyer admins additionally see that their
-- team members have connected (status only -- the grant above already withholds
-- auth_config_id and connected_account_id from every client).
DROP POLICY IF EXISTS "composio_conn_select_own" ON public.composio_connections;
CREATE POLICY "composio_conn_select_own" ON public.composio_connections
  FOR SELECT TO authenticated USING (
    profile_id = auth.uid()
    OR (buyer_id IS NOT NULL AND private.is_buyer_admin(buyer_id))
    OR public.is_admin(auth.uid())
  );

-- Keep updated_at honest.
CREATE OR REPLACE FUNCTION public.touch_composio_connections()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS composio_connections_touch ON public.composio_connections;
CREATE TRIGGER composio_connections_touch
  BEFORE UPDATE ON public.composio_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_composio_connections();
