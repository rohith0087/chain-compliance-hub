-- ============================================================
-- MIGRATION: Scope user_has_branch_access() to the branch's own company
-- Security assessment 2026-09-02 — follow-up to F-02 (found while testing)
--
-- user_has_branch_access(p_user_id, p_branch_id) returned true for ANY active
-- company_admin of ANY company: it never looked at which company owns the
-- branch. It backs five RLS policies (branch_supplier_connections,
-- branch_compliance_metrics, shared_documents x2, document_libraries) and the
-- assign_supplier_to_branch guard, so a company admin at one tenant could read
-- another tenant's branch data and assign suppliers to its branches.
--
-- Access now requires being an active member of the company that owns the
-- branch (branch-scoped members must match the branch; company_admins see all
-- branches of their own company), or owning that company outright.
--
-- Also: cron job 4 (check-document-expiry-daily) now allows the function 60s
-- instead of pg_net's 5s default, so a full run is not reported as a timeout.
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_user_id uuid, p_branch_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM company_branches cb
    JOIN company_users cu
      ON cu.company_id = cb.company_id
     AND cu.company_type = cb.company_type
    WHERE cb.id = p_branch_id
      AND cu.profile_id = p_user_id
      AND cu.status = 'active'
      AND (cu.branch_id = p_branch_id OR cu.role IN ('company_admin'))
  ) OR EXISTS (
    SELECT 1
    FROM company_branches cb
    JOIN buyers b ON b.id = cb.company_id
    WHERE cb.id = p_branch_id AND cb.company_type = 'buyer' AND b.profile_id = p_user_id
  ) OR EXISTS (
    SELECT 1
    FROM company_branches cb
    JOIN suppliers s ON s.id = cb.company_id
    WHERE cb.id = p_branch_id AND cb.company_type = 'supplier' AND s.profile_id = p_user_id
  );
END;
$function$;

select cron.alter_job(
  job_id := 4,
  command := $cmd$
  select net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/check-document-expiry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-System-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'system_cron_invocation')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $cmd$
);
