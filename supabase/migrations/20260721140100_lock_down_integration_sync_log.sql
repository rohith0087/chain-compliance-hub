-- SECURITY: integration_sync_log is the audit trail for integrations, but
-- anon/authenticated held DELETE, INSERT, UPDATE and TRUNCATE on it, and the
-- INSERT policy `isl_insert_service` had `with check (true)` for role `public`.
--
-- Consequences:
--   * any authenticated user could forge audit entries;
--   * TRUNCATE is a table-level privilege that RLS does NOT govern, so any
--     authenticated user could wipe the audit log entirely.
--
-- An audit log the audited party can write or erase is not an audit log. All
-- writes come from edge functions running as service_role, which bypasses RLS,
-- so no client-side write grant or INSERT policy is needed.
--
-- Found by Supabase's security advisor (rls_policy_always_true) while closing
-- the token exposure in the sibling integration_connections table.

DROP POLICY IF EXISTS "isl_insert_service" ON public.integration_sync_log;

REVOKE ALL ON TABLE public.integration_sync_log FROM anon, authenticated;

-- Read-only for clients; the existing isl_select policy still scopes rows to
-- the caller's own organisation.
GRANT SELECT ON public.integration_sync_log TO authenticated;

GRANT ALL ON public.integration_sync_log TO service_role;
