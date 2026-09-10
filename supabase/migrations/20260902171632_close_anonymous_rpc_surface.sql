-- ============================================================
-- MIGRATION: Close the anonymous RPC surface
-- Security assessment 2026-09-02 — findings F-01, F-02, F-07, F-09
--
-- 1. Default privileges: functions created in public from now on are NOT
--    executable by anon or PUBLIC (Supabase's default grants them EXECUTE).
-- 2. Revoke EXECUTE from anon and PUBLIC on every postgres-owned, non-trigger
--    function in public. Explicit authenticated / service_role grants are
--    left exactly as they are, so signed-in users and edge functions are
--    unaffected. Extension-owned functions (vector, pg_net) are skipped.
-- 3. Server-only functions (only edge functions / cron call them, always with
--    the service role): also revoke from authenticated. grant_pg_net_access
--    was a one-off and is dropped.
-- 4. Ownership checks inside the client-callable functions that had none:
--      handle_unified_connection_approval, approve_connection_with_onboarding,
--      finalize_onboarding_approval, assign_supplier_to_branch,
--      create_notification, log_document_activity, search_suppliers_for_discovery
--    Helpers live in the private schema (not exposed by PostgREST).
-- 5. user_roles policies queried user_roles from inside a user_roles policy
--    (infinite recursion, HTTP 500). Use has_any_role(), which is SECURITY
--    DEFINER and does not re-enter RLS.
-- 6. cron job 4 (check-document-expiry-daily) sent the anon JWT and no system
--    secret and has 401'd every day. Send the vault-backed cron secret like
--    every other job (the function accepts it after this release).
--
-- Rollback: rollback_20260902171632_snapshot.sql
-- ============================================================

set search_path = public;

-- ------------------------------------------------------------
-- 1. Default privileges for new functions
-- ------------------------------------------------------------
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public;

-- ------------------------------------------------------------
-- 2. Revoke anon + PUBLIC on every existing RPC-callable function
-- ------------------------------------------------------------
do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prokind = 'f'
      and p.prorettype <> 'trigger'::regtype
      and p.proowner = 'postgres'::regrole
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', r.fn);
    n := n + 1;
  end loop;
  raise notice 'revoked anon/PUBLIC execute on % functions', n;
end $$;

-- ------------------------------------------------------------
-- 3. Server-only functions: authenticated may not call them either
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname in (
        'get_latest_expiring_documents', 'search_knowledge_entries', 'search_relevant_documents',
        'get_companies_for_knowledge_refresh', 'cleanup_expired_knowledge_entries',
        'detect_compliance_gaps_v1', 'get_branch_suppliers')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
  end loop;
end $$;

drop function if exists public.grant_pg_net_access();

-- search_relevant_documents also had a SQL bug (DISTINCT + ORDER BY on a
-- column outside the select list). The joins cannot duplicate an upload row,
-- so DISTINCT is simply dropped.
CREATE OR REPLACE FUNCTION public.search_relevant_documents(query_text text, user_company_id uuid, user_company_type text, match_limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, title text, document_type text, supplier_name text, expiration_date date, status text, file_path text, metadata jsonb, relevance_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    du.id,
    dr.title,
    dr.document_type,
    s.company_name as supplier_name,
    du.expiration_date,
    dr.status,
    du.file_path,
    COALESCE(du.metadata, '{}'::jsonb) as metadata,
    (
      CASE WHEN dr.title ILIKE '%' || query_text || '%' THEN 3.0 ELSE 0.0 END +
      CASE WHEN dr.document_type ILIKE '%' || query_text || '%' THEN 2.5 ELSE 0.0 END +
      CASE WHEN s.company_name ILIKE '%' || query_text || '%' THEN 2.0 ELSE 0.0 END +
      CASE WHEN dr.description ILIKE '%' || query_text || '%' THEN 1.5 ELSE 0.0 END +
      CASE WHEN dr.category ILIKE '%' || query_text || '%' THEN 1.0 ELSE 0.0 END
    )::NUMERIC as relevance_score
  FROM document_uploads du
  JOIN document_requests dr ON du.request_id = dr.id
  LEFT JOIN suppliers s ON dr.supplier_id = s.id
  WHERE
    (
      (user_company_type = 'buyer' AND dr.buyer_id = user_company_id) OR
      (user_company_type = 'supplier' AND dr.supplier_id = user_company_id)
    )
    AND du.file_path IS NOT NULL
    AND (
      query_text = '' OR query_text IS NULL OR
      dr.title ILIKE '%' || query_text || '%' OR
      dr.document_type ILIKE '%' || query_text || '%' OR
      s.company_name ILIKE '%' || query_text || '%' OR
      dr.description ILIKE '%' || query_text || '%' OR
      dr.category ILIKE '%' || query_text || '%'
    )
  ORDER BY relevance_score DESC, dr.created_at DESC
  LIMIT match_limit;
END;
$function$;
revoke execute on function public.search_relevant_documents(text, uuid, text, integer) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. Authorization helpers (private schema: not reachable over the API)
-- ------------------------------------------------------------
create schema if not exists private;

-- True for trusted server-side callers: the service role over the API, or a
-- direct database session (pg_cron, migrations, dashboard). PostgREST always
-- SETs a role, so an API caller is never 'none'. Deliberately does NOT look at
-- session_user, which is postgres inside SECURITY DEFINER functions.
create or replace function private.is_privileged_caller()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('role', true), 'none') in ('none', '', 'service_role')
      or coalesce(auth.role(), '') = 'service_role';
$$;
revoke all on function private.is_privileged_caller() from public, anon, authenticated;

-- True when two users belong to the same company, or their companies are
-- linked by a connection, a document request, an onboarding request, or a
-- shared communication thread. Used to decide who may notify whom.
create or replace function private.users_are_related(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with ca as (
    select 'supplier'::text as ct, s.id as cid from public.suppliers s where s.profile_id = p_a
    union select 'buyer', b.id from public.buyers b where b.profile_id = p_a
    union select cu.company_type, cu.company_id from public.company_users cu
      where cu.profile_id = p_a and cu.status = 'active'
  ), cb as (
    select 'supplier'::text as ct, s.id as cid from public.suppliers s where s.profile_id = p_b
    union select 'buyer', b.id from public.buyers b where b.profile_id = p_b
    union select cu.company_type, cu.company_id from public.company_users cu
      where cu.profile_id = p_b and cu.status = 'active'
  )
  select p_a is not null and p_b is not null and (
       exists (select 1 from ca join cb on cb.ct = ca.ct and cb.cid = ca.cid)
    or exists (select 1 from public.buyer_supplier_connections x
               where (x.buyer_id in (select cid from ca where ct = 'buyer') and x.supplier_id in (select cid from cb where ct = 'supplier'))
                  or (x.buyer_id in (select cid from cb where ct = 'buyer') and x.supplier_id in (select cid from ca where ct = 'supplier')))
    or exists (select 1 from public.document_requests x
               where (x.buyer_id in (select cid from ca where ct = 'buyer') and x.supplier_id in (select cid from cb where ct = 'supplier'))
                  or (x.buyer_id in (select cid from cb where ct = 'buyer') and x.supplier_id in (select cid from ca where ct = 'supplier')))
    or exists (select 1 from public.supplier_onboarding_requests x
               where (x.buyer_id in (select cid from ca where ct = 'buyer') and x.supplier_id in (select cid from cb where ct = 'supplier'))
                  or (x.buyer_id in (select cid from cb where ct = 'buyer') and x.supplier_id in (select cid from ca where ct = 'supplier')))
    or exists (select 1 from public.thread_participants ta
               join public.thread_participants tb on tb.thread_id = ta.thread_id
               where ta.profile_id = p_a and tb.profile_id = p_b)
  );
$$;
revoke all on function private.users_are_related(uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4a. handle_unified_connection_approval — buyer side only
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_unified_connection_approval(p_connection_id uuid, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_connection RECORD;
  v_onboarding_request_id UUID;
BEGIN
  -- Get connection details
  SELECT * INTO v_connection
  FROM buyer_supplier_connections
  WHERE id = p_connection_id;

  IF v_connection IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Connection not found');
  END IF;

  -- SECURITY (audit 2026-09-02, F-02): only the buyer side of the connection
  -- (owner or active member), a platform admin, or a trusted server caller may
  -- respond here. Suppliers respond through RLS on buyer_supplier_connections.
  IF NOT (private.is_privileged_caller()
          OR public.user_can_act_for_buyer(v_connection.buyer_id)
          OR public.is_platform_admin(auth.uid())) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to respond to this connection');
  END IF;

  -- Validate action
  IF p_action NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Must be approved or rejected');
  END IF;

  -- Update the connection status
  UPDATE buyer_supplier_connections
  SET status = p_action,
      notes = p_notes,
      responded_at = now()
  WHERE id = p_connection_id;

  -- If approved, update the onboarding request if exists
  IF p_action = 'approved' AND v_connection.onboarding_request_id IS NOT NULL THEN
    UPDATE supplier_onboarding_requests
    SET status = 'approved',
        updated_at = now()
    WHERE id = v_connection.onboarding_request_id;
  END IF;

  -- If rejected, update the onboarding request if exists
  IF p_action = 'rejected' AND v_connection.onboarding_request_id IS NOT NULL THEN
    UPDATE supplier_onboarding_requests
    SET status = 'rejected',
        updated_at = now()
    WHERE id = v_connection.onboarding_request_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Connection ' || p_action || ' successfully',
    'connection_id', p_connection_id
  );
END;
$function$;

-- ------------------------------------------------------------
-- 4b. approve_connection_with_onboarding — buyer side only
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_connection_with_onboarding(p_connection_id uuid, p_onboarding_type text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_connection RECORD;
  v_buyer RECORD;
  v_supplier RECORD;
  v_onboarding_request_id UUID;
  v_default_settings RECORD;
BEGIN
  -- Validate onboarding type
  IF p_onboarding_type NOT IN ('default', 'custom', 'none') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid onboarding type. Must be default, custom, or none');
  END IF;

  -- Get connection details
  SELECT * INTO v_connection
  FROM buyer_supplier_connections
  WHERE id = p_connection_id;

  IF v_connection IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Connection not found');
  END IF;

  -- SECURITY (audit 2026-09-02, F-02): buyer side, platform admin, or server only.
  IF NOT (private.is_privileged_caller()
          OR public.user_can_act_for_buyer(v_connection.buyer_id)
          OR public.is_platform_admin(auth.uid())) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to approve this connection');
  END IF;

  IF v_connection.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Connection is not pending');
  END IF;

  -- Get buyer details
  SELECT * INTO v_buyer
  FROM buyers
  WHERE id = v_connection.buyer_id;

  IF v_buyer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Buyer not found');
  END IF;

  -- Get supplier details
  SELECT * INTO v_supplier
  FROM suppliers
  WHERE id = v_connection.supplier_id;

  IF v_supplier IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Supplier not found');
  END IF;

  -- Handle based on onboarding type
  IF p_onboarding_type = 'none' THEN
    -- Just approve the connection without creating onboarding
    UPDATE buyer_supplier_connections
    SET status = 'approved',
        notes = p_notes,
        responded_at = now()
    WHERE id = p_connection_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Connection approved without onboarding',
      'connection_id', p_connection_id
    );

  ELSIF p_onboarding_type IN ('default', 'custom') THEN
    -- Create onboarding request
    INSERT INTO supplier_onboarding_requests (
      buyer_id,
      supplier_id,
      supplier_email,
      supplier_company_name,
      status,
      can_choose_branches,
      created_by
    ) VALUES (
      v_connection.buyer_id,
      v_connection.supplier_id,
      v_supplier.contact_email,
      v_supplier.company_name,
      CASE WHEN p_onboarding_type = 'custom' THEN 'draft' ELSE 'pending' END,
      true,
      auth.uid()
    )
    RETURNING id INTO v_onboarding_request_id;

    -- If default onboarding, copy default documents and form fields
    IF p_onboarding_type = 'default' THEN
      -- Get default settings
      SELECT * INTO v_default_settings
      FROM buyer_default_onboarding_settings
      WHERE buyer_id = v_connection.buyer_id;

      -- Copy default document requirements
      INSERT INTO onboarding_document_requirements (
        onboarding_request_id,
        document_name,
        document_type,
        is_required,
        description,
        display_order,
        template_file_path,
        template_file_name
      )
      SELECT
        v_onboarding_request_id,
        document_name,
        document_type,
        is_required,
        description,
        display_order,
        template_file_path,
        template_file_name
      FROM default_document_requirements
      WHERE buyer_id = v_connection.buyer_id
      ORDER BY display_order;

      -- Copy default form fields
      INSERT INTO onboarding_form_fields (
        onboarding_request_id,
        field_label,
        field_type,
        is_required,
        field_order,
        field_options,
        field_category,
        field_description
      )
      SELECT
        v_onboarding_request_id,
        field_label,
        field_type,
        is_required,
        field_order,
        field_options,
        field_category,
        field_description
      FROM default_form_fields
      WHERE buyer_id = v_connection.buyer_id
      ORDER BY field_order;
    END IF;

    -- Update connection with onboarding request ID and approve
    UPDATE buyer_supplier_connections
    SET status = 'approved',
        notes = p_notes,
        responded_at = now(),
        onboarding_request_id = v_onboarding_request_id
    WHERE id = p_connection_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', CASE
        WHEN p_onboarding_type = 'default' THEN 'Connection approved with default onboarding'
        ELSE 'Connection approved with custom onboarding draft created'
      END,
      'connection_id', p_connection_id,
      'onboarding_request_id', v_onboarding_request_id
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Unknown error occurred');
END;
$function$;

-- ------------------------------------------------------------
-- 4c. finalize_onboarding_approval — buyer side only
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_onboarding_approval(p_onboarding_request_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request supplier_onboarding_requests%ROWTYPE;
  v_supplier_profile_id uuid;
  v_temp_selection_count integer;
BEGIN
  -- Get onboarding request details
  SELECT * INTO v_request
  FROM supplier_onboarding_requests
  WHERE id = p_onboarding_request_id;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Onboarding request not found');
  END IF;

  -- SECURITY (audit 2026-09-02, F-02): buyer side, platform admin, or server only.
  IF NOT (private.is_privileged_caller()
          OR public.user_can_act_for_buyer(v_request.buyer_id)
          OR public.is_platform_admin(auth.uid())) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to approve this onboarding request');
  END IF;

  -- Get supplier profile ID
  SELECT profile_id INTO v_supplier_profile_id
  FROM suppliers WHERE id = v_request.supplier_id;

  -- Update onboarding request status
  UPDATE supplier_onboarding_requests
  SET status = 'approved',
      approved_at = now(),
      approved_by = auth.uid(),
      updated_at = now()
  WHERE id = p_onboarding_request_id;

  -- Move temporary branch selections to permanent connections
  INSERT INTO branch_supplier_connections (
    branch_id,
    supplier_id,
    buyer_id,
    assigned_by,
    notes
  )
  SELECT
    tbs.branch_id,
    v_request.supplier_id,
    v_request.buyer_id,
    auth.uid(),
    'Auto-assigned from approved onboarding'
  FROM temporary_branch_selections tbs
  WHERE tbs.onboarding_request_id = p_onboarding_request_id
  ON CONFLICT (branch_id, supplier_id) DO NOTHING;

  -- Get count of assignments made
  SELECT COUNT(*) INTO v_temp_selection_count
  FROM temporary_branch_selections
  WHERE onboarding_request_id = p_onboarding_request_id;

  -- Clean up temporary selections
  DELETE FROM temporary_branch_selections
  WHERE onboarding_request_id = p_onboarding_request_id;

  -- Create notification for supplier
  IF v_supplier_profile_id IS NOT NULL THEN
    PERFORM create_notification(
      v_supplier_profile_id,
      'Onboarding Approved',
      'Your onboarding has been approved! You can now receive document requests.',
      'onboarding_approved',
      p_onboarding_request_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Onboarding approved successfully',
    'branch_assignments', v_temp_selection_count
  );
END;
$function$;

-- ------------------------------------------------------------
-- 4d. assign_supplier_to_branch — buyer side (or branch access) only
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_supplier_to_branch(p_branch_id uuid, p_supplier_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_buyer_id UUID;
  v_connection_id UUID;
BEGIN
  -- Get buyer_id from branch
  SELECT cb.company_id INTO v_buyer_id
  FROM company_branches cb
  WHERE cb.id = p_branch_id AND cb.company_type = 'buyer';

  IF v_buyer_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Branch not found or not a buyer branch'
    );
  END IF;

  -- SECURITY (audit 2026-09-02, F-02): the buyer that owns the branch (owner,
  -- active member, or branch access), a platform admin, or a server caller.
  IF NOT (private.is_privileged_caller()
          OR public.user_can_act_for_buyer(v_buyer_id)
          OR (auth.uid() IS NOT NULL AND public.user_has_branch_access(auth.uid(), p_branch_id))
          OR public.is_platform_admin(auth.uid())) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to assign suppliers to this branch');
  END IF;

  -- Check if assignment already exists
  SELECT id INTO v_connection_id
  FROM branch_supplier_connections
  WHERE branch_id = p_branch_id AND supplier_id = p_supplier_id;

  IF v_connection_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Supplier already assigned to this branch'
    );
  END IF;

  -- Create the assignment
  INSERT INTO branch_supplier_connections (
    branch_id,
    supplier_id,
    buyer_id,
    assigned_by,
    notes
  ) VALUES (
    p_branch_id,
    p_supplier_id,
    v_buyer_id,
    auth.uid(),
    p_notes
  ) RETURNING id INTO v_connection_id;

  RETURN json_build_object(
    'success', true,
    'connection_id', v_connection_id,
    'message', 'Supplier successfully assigned to branch'
  );
END;
$function$;

-- ------------------------------------------------------------
-- 4e. create_notification — only related users (or the server) may notify
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_title text, p_message text, p_type text, p_reference_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  notification_id UUID;
  v_caller uuid := auth.uid();
BEGIN
  IF p_user_id IS NULL OR coalesce(p_title, '') = '' THEN
    RETURN NULL;
  END IF;

  -- SECURITY (audit 2026-09-02, F-02): a server caller, the target themselves,
  -- a platform admin, or a user related to the target through a company,
  -- connection, request or thread. Anything else is dropped (not raised, so a
  -- notification never aborts the business action that triggered it).
  IF NOT (
    private.is_privileged_caller()
    OR (v_caller IS NOT NULL AND (
          v_caller = p_user_id
          OR public.is_platform_admin(v_caller)
          OR private.users_are_related(v_caller, p_user_id)))
  ) THEN
    RAISE WARNING 'create_notification: caller % is not allowed to notify % - dropped', v_caller, p_user_id;
    RETURN NULL;
  END IF;

  INSERT INTO notifications (user_id, title, message, type, reference_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_reference_id)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$function$;

-- ------------------------------------------------------------
-- 4f. log_document_activity — self-attributed, on documents you can see
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_document_activity(p_document_upload_id uuid, p_user_id uuid, p_action_type text, p_metadata jsonb DEFAULT NULL::jsonb, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  activity_id UUID;
  v_caller uuid := auth.uid();
BEGIN
  -- SECURITY (audit 2026-09-02, F-02/F-13): API callers may only log their own
  -- actions, and only on documents they have a relationship with.
  IF NOT private.is_privileged_caller() THEN
    IF v_caller IS NULL OR p_user_id IS DISTINCT FROM v_caller THEN
      RAISE EXCEPTION 'log_document_activity: not authorized';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM document_uploads du
      JOIN document_requests dr ON dr.id = du.request_id
      WHERE du.id = p_document_upload_id
        AND (du.uploader_id = v_caller
             OR public.user_can_act_for_buyer(dr.buyer_id)
             OR dr.supplier_id = public.get_user_supplier_id()
             OR public.is_platform_admin(v_caller))
    ) THEN
      RAISE EXCEPTION 'log_document_activity: not authorized for document %', p_document_upload_id;
    END IF;
  END IF;

  INSERT INTO document_activity_logs (
    document_upload_id,
    user_id,
    action_type,
    metadata,
    notes
  ) VALUES (
    p_document_upload_id,
    p_user_id,
    p_action_type,
    p_metadata,
    p_notes
  ) RETURNING id INTO activity_id;

  RETURN activity_id;
END;
$function$;

-- ------------------------------------------------------------
-- 4g. search_suppliers_for_discovery — signed-in callers only
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_suppliers_for_discovery(p_search_query text DEFAULT ''::text, p_industry_filter text DEFAULT NULL::text, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, company_name text, industry text, company_logo_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY (audit 2026-09-02, F-01): the supplier directory is for signed-in buyers.
  IF auth.uid() IS NULL AND NOT private.is_privileged_caller() THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Only return suppliers not already connected to the requesting buyer
  RETURN QUERY
  SELECT
    s.id,
    s.company_name,
    s.industry,
    s.company_logo_url
  FROM suppliers s
  WHERE (
    p_search_query = ''
    OR s.company_name ILIKE '%' || p_search_query || '%'
    OR s.industry ILIKE '%' || p_search_query || '%'
  )
  AND (p_industry_filter IS NULL OR s.industry = p_industry_filter)
  -- Exclude suppliers already connected to requesting user's buyer company
  AND s.id NOT IN (
    SELECT bsc.supplier_id
    FROM buyer_supplier_connections bsc
    WHERE bsc.buyer_id IN (
      SELECT b.id FROM buyers b WHERE b.profile_id = auth.uid()
      UNION
      SELECT cu.company_id
      FROM company_users cu
      WHERE cu.profile_id = auth.uid()
      AND cu.company_type = 'buyer'
      AND cu.status = 'active'
    )
    AND bsc.status IN ('approved', 'pending')
  )
  ORDER BY s.company_name
  LIMIT p_limit;
END;
$function$;

-- CREATE OR REPLACE keeps existing grants, but be explicit: no anon, no PUBLIC.
revoke execute on function
  public.handle_unified_connection_approval(uuid, text, text),
  public.approve_connection_with_onboarding(uuid, text, text),
  public.finalize_onboarding_approval(uuid, text),
  public.assign_supplier_to_branch(uuid, uuid, text),
  public.create_notification(uuid, text, text, text, uuid),
  public.log_document_activity(uuid, uuid, text, jsonb, text),
  public.search_suppliers_for_discovery(text, text, integer)
from public, anon;

-- ------------------------------------------------------------
-- 5. user_roles: stop the policy recursion
-- ------------------------------------------------------------
drop policy if exists "Admins can view all roles" on public.user_roles;
create policy "Admins can view all roles" on public.user_roles
  for select
  using (public.has_any_role(auth.uid(), array['admin', 'super_admin', 'platform_admin']::app_role[]));

drop policy if exists "Admins can grant roles" on public.user_roles;
create policy "Admins can grant roles" on public.user_roles
  for insert
  with check (public.has_any_role(auth.uid(), array['admin', 'super_admin', 'platform_admin']::app_role[]));

drop policy if exists "Admins can revoke roles" on public.user_roles;
create policy "Admins can revoke roles" on public.user_roles
  for delete
  using (public.has_any_role(auth.uid(), array['admin', 'super_admin', 'platform_admin']::app_role[]));

-- ------------------------------------------------------------
-- 6. cron job 4: authenticate like every other scheduled job
-- ------------------------------------------------------------
select cron.alter_job(
  job_id := 4,
  command := $cmd$
  select net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/check-document-expiry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-System-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'system_cron_invocation')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $cmd$
);
