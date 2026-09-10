-- ============================================================
-- ROLLBACK SNAPSHOT for 20260902171632_close_anonymous_rpc_surface.sql
-- Restores the pre-migration state captured on 2026-09-02. Run manually only.
-- ============================================================

set search_path = public;

-- 1/2. Restore default privileges and the anon/PUBLIC grants
alter default privileges for role postgres in schema public grant execute on functions to anon;
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
      and p.proowner = 'postgres'::regrole
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('grant execute on function %s to anon', r.fn);
  end loop;
end $$;

-- 3. Server-only functions were also callable by authenticated
grant execute on function
  public.get_latest_expiring_documents(),
  public.search_knowledge_entries(text, uuid, text, double precision, integer),
  public.search_relevant_documents(text, uuid, text, integer),
  public.get_companies_for_knowledge_refresh(),
  public.cleanup_expired_knowledge_entries(),
  public.detect_compliance_gaps_v1(),
  public.get_branch_suppliers(uuid)
to authenticated;

CREATE OR REPLACE FUNCTION public.grant_pg_net_access()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  GRANT USAGE ON SCHEMA net TO authenticated, service_role;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO authenticated, service_role;
  GRANT EXECUTE ON FUNCTION net.http_post TO authenticated, service_role;
  GRANT EXECUTE ON FUNCTION net.http_get TO authenticated, service_role;
END;
$function$;

-- 4. Original function bodies (no authorization checks)
CREATE OR REPLACE FUNCTION public.handle_unified_connection_approval(p_connection_id uuid, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_connection RECORD;
  v_onboarding_request_id UUID;
BEGIN
  SELECT * INTO v_connection FROM buyer_supplier_connections WHERE id = p_connection_id;
  IF v_connection IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Connection not found');
  END IF;
  IF p_action NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Must be approved or rejected');
  END IF;
  UPDATE buyer_supplier_connections SET status = p_action, notes = p_notes, responded_at = now() WHERE id = p_connection_id;
  IF p_action = 'approved' AND v_connection.onboarding_request_id IS NOT NULL THEN
    UPDATE supplier_onboarding_requests SET status = 'approved', updated_at = now() WHERE id = v_connection.onboarding_request_id;
  END IF;
  IF p_action = 'rejected' AND v_connection.onboarding_request_id IS NOT NULL THEN
    UPDATE supplier_onboarding_requests SET status = 'rejected', updated_at = now() WHERE id = v_connection.onboarding_request_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'message', 'Connection ' || p_action || ' successfully', 'connection_id', p_connection_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_onboarding_approval(p_onboarding_request_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_request supplier_onboarding_requests%ROWTYPE;
  v_supplier_profile_id uuid;
  v_temp_selection_count integer;
BEGIN
  SELECT * INTO v_request FROM supplier_onboarding_requests WHERE id = p_onboarding_request_id;
  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Onboarding request not found');
  END IF;
  SELECT profile_id INTO v_supplier_profile_id FROM suppliers WHERE id = v_request.supplier_id;
  UPDATE supplier_onboarding_requests SET status = 'approved', approved_at = now(), approved_by = auth.uid(), updated_at = now() WHERE id = p_onboarding_request_id;
  INSERT INTO branch_supplier_connections (branch_id, supplier_id, buyer_id, assigned_by, notes)
  SELECT tbs.branch_id, v_request.supplier_id, v_request.buyer_id, auth.uid(), 'Auto-assigned from approved onboarding'
  FROM temporary_branch_selections tbs WHERE tbs.onboarding_request_id = p_onboarding_request_id
  ON CONFLICT (branch_id, supplier_id) DO NOTHING;
  SELECT COUNT(*) INTO v_temp_selection_count FROM temporary_branch_selections WHERE onboarding_request_id = p_onboarding_request_id;
  DELETE FROM temporary_branch_selections WHERE onboarding_request_id = p_onboarding_request_id;
  IF v_supplier_profile_id IS NOT NULL THEN
    PERFORM create_notification(v_supplier_profile_id, 'Onboarding Approved', 'Your onboarding has been approved! You can now receive document requests.', 'onboarding_approved', p_onboarding_request_id);
  END IF;
  RETURN jsonb_build_object('success', true, 'message', 'Onboarding approved successfully', 'branch_assignments', v_temp_selection_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_supplier_to_branch(p_branch_id uuid, p_supplier_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_buyer_id UUID;
  v_connection_id UUID;
BEGIN
  SELECT cb.company_id INTO v_buyer_id FROM company_branches cb WHERE cb.id = p_branch_id AND cb.company_type = 'buyer';
  IF v_buyer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Branch not found or not a buyer branch');
  END IF;
  SELECT id INTO v_connection_id FROM branch_supplier_connections WHERE branch_id = p_branch_id AND supplier_id = p_supplier_id;
  IF v_connection_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Supplier already assigned to this branch');
  END IF;
  INSERT INTO branch_supplier_connections (branch_id, supplier_id, buyer_id, assigned_by, notes)
  VALUES (p_branch_id, p_supplier_id, v_buyer_id, auth.uid(), p_notes) RETURNING id INTO v_connection_id;
  RETURN json_build_object('success', true, 'connection_id', v_connection_id, 'message', 'Supplier successfully assigned to branch');
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_title text, p_message text, p_type text, p_reference_id uuid DEFAULT NULL::uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, reference_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_reference_id)
  RETURNING id INTO notification_id;
  RETURN notification_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_document_activity(p_document_upload_id uuid, p_user_id uuid, p_action_type text, p_metadata jsonb DEFAULT NULL::jsonb, p_notes text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO document_activity_logs (document_upload_id, user_id, action_type, metadata, notes)
  VALUES (p_document_upload_id, p_user_id, p_action_type, p_metadata, p_notes)
  RETURNING id INTO activity_id;
  RETURN activity_id;
END;
$function$;

-- approve_connection_with_onboarding and search_suppliers_for_discovery: re-apply
-- the definitions from the migration file with the SECURITY guard block removed.
-- (Bodies are otherwise identical; see 20260902171632_close_anonymous_rpc_surface.sql.)

drop function if exists private.users_are_related(uuid, uuid);
drop function if exists private.is_privileged_caller();

-- 5. Original (recursive) user_roles policies
drop policy if exists "Admins can view all roles" on public.user_roles;
create policy "Admins can view all roles" on public.user_roles for select
  using (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::app_role, 'super_admin'::app_role, 'platform_admin'::app_role]) AND ur.is_active = true));
drop policy if exists "Admins can grant roles" on public.user_roles;
create policy "Admins can grant roles" on public.user_roles for insert
  with check (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::app_role, 'super_admin'::app_role, 'platform_admin'::app_role]) AND ur.is_active = true));
drop policy if exists "Admins can revoke roles" on public.user_roles;
create policy "Admins can revoke roles" on public.user_roles for delete
  using (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::app_role, 'super_admin'::app_role, 'platform_admin'::app_role]) AND ur.is_active = true));

-- 6. cron job 4 original command (anon JWT, no system secret) — intentionally not restored.
