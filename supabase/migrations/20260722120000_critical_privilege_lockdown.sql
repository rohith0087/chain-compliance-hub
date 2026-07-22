-- ============================================================
-- MIGRATION: Critical RLS / privilege lockdown (audit findings 1-6)
--
-- 1. handle_new_user: whitelist signup-metadata roles (buyer/supplier only)
-- 2. profiles: BEFORE UPDATE trigger reverting privileged-column changes
--    unless executed as service_role / privileged SECURITY DEFINER owner
-- 3. user_credits: "System can manage user credits" FOR ALL USING(true)
--    -> service_role only (mirrors 20260306031740 pattern)
-- 4. subscriptions: drop "Users can update their own subscription"
--    (verified: no client code updates subscriptions directly; all writes
--     go through service-role edge functions)
-- 5. user_invitations: "System can manage invitations" FOR ALL USING(true)
--    -> service_role only
-- 6. company_users: drop self FOR ALL policy (no WITH CHECK hole),
--    recreate self SELECT + self UPDATE guarded by a privileged-column
--    protection trigger; no authenticated INSERT/DELETE (no legit client
--    flow exists; inserts happen via service-role edge functions/RPCs)
--
-- Privileged execution contexts allowed by the protection triggers:
--   - current_setting('role') = 'service_role'  (edge functions, service key)
--   - current_user IN ('postgres','supabase_admin','supabase_auth_admin')
--     (migrations, SECURITY DEFINER functions owned by postgres such as
--      public.remove_company_user, auth-admin sync)
-- ============================================================

-- ------------------------------------------------------------
-- Finding 1: handle_new_user role whitelist
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_roles_array user_role[] := ARRAY[]::user_role[];
  role_text text;
  i int;
BEGIN
  -- SECURITY: only 'buyer'/'supplier' may be self-assigned via signup metadata.
  -- Anything else in raw_user_meta_data->'roles' (e.g. 'admin') is discarded.
  IF NEW.raw_user_meta_data->'roles' IS NOT NULL AND jsonb_array_length(NEW.raw_user_meta_data->'roles') > 0 THEN
    FOR i IN 0..jsonb_array_length(NEW.raw_user_meta_data->'roles') - 1 LOOP
      role_text := NEW.raw_user_meta_data->'roles'->>i;
      IF role_text IN ('buyer', 'supplier') THEN
        user_roles_array := array_append(user_roles_array, role_text::user_role);
      END IF;
    END LOOP;
  ELSIF NEW.raw_user_meta_data->>'company_type' IS NOT NULL
        AND NEW.raw_user_meta_data->>'company_type' IN ('buyer', 'supplier') THEN
    user_roles_array := ARRAY[(NEW.raw_user_meta_data->>'company_type')::user_role];
  END IF;

  -- Preserve original default: a user with no valid self-service role is a supplier.
  IF coalesce(array_length(user_roles_array, 1), 0) = 0 THEN
    user_roles_array := ARRAY['supplier'::user_role];
  END IF;

  -- Insert profile with whitelisted roles
  INSERT INTO public.profiles (id, email, full_name, roles, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    user_roles_array,
    NOW()
  );

  -- Insert into user_roles ONLY safe self-service app_roles (buyer/supplier).
  -- Privileged app_roles (admin, super_admin, platform_admin, company_admin,
  -- branch_manager, document_manager, approver, viewer) must go through
  -- public.grant_role(), which enforces admin authorization.
  FOREACH role_text IN ARRAY user_roles_array LOOP
    IF role_text IN ('buyer', 'supplier') THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, role_text::text::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- Finding 2: protect privileged profiles columns from self-UPDATE
-- (the "Users can update their own profile" policy stays in place so the
--  account settings form can keep updating full_name/avatar_url and the MFA
--  hook can keep updating mfa_enabled/first_login_at/mfa_grace_period_expires_at)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'supabase_auth_admin') THEN
    -- Silently revert privilege-escalating column changes.
    NEW.roles := OLD.roles;
    NEW.account_disabled := OLD.account_disabled;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- ------------------------------------------------------------
-- Finding 3: user_credits - scope system policy to service_role
-- (mirrors the 20260306031740 fix pattern for sibling tables)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "System can manage user credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service role can manage user credits" ON public.user_credits;
CREATE POLICY "Service role can manage user credits"
  ON public.user_credits FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- Finding 4: subscriptions - drop user self-UPDATE policy entirely.
-- Verified: no client code performs supabase.from('subscriptions').update/
-- upsert/insert/delete; all subscription writes go through service-role edge
-- functions (check-subscription-status, create-subscription-checkout,
-- manage-subscription, Stripe webhooks). The self-SELECT policy remains.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;

-- ------------------------------------------------------------
-- Finding 5: user_invitations - scope system policy to service_role.
-- Verified: no client code or edge function accesses user_invitations
-- directly with the anon/authenticated role; only the SECURITY DEFINER
-- handle_new_user trigger reads it (bypasses RLS as owner). The
-- "Users can view their own invitations" SELECT policy is untouched.
-- NOTE: the table does not exist in every deployed environment (it is
-- absent from the live Complience DB), so this section is conditional.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'user_invitations'
  ) THEN
    DROP POLICY IF EXISTS "System can manage invitations" ON public.user_invitations;
    DROP POLICY IF EXISTS "Service role can manage invitations" ON public.user_invitations;
    CREATE POLICY "Service role can manage invitations"
      ON public.user_invitations FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- Finding 6: company_users - close the FOR ALL self-policy hole.
-- Verified: the ONLY direct client mutation is
-- src/pages/ResetPassword.tsx:215-216 updating password_reset_required on
-- the caller's own row. All INSERT/DELETE and role/status changes happen via
-- service-role edge functions (create-company-user, reset-password-with-recovery,
-- send-user-invitation, delete-auth-user) or the SECURITY DEFINER
-- public.remove_company_user RPC.
--
-- New shape:
--   SELECT: own row (self-view; broader view policy already exists)
--   UPDATE: own row, WITH CHECK profile_id = auth.uid(), plus a trigger that
--           reverts company_id/company_type/branch_id/role/status/invited_by/
--           invitation_token/last_login_at changes outside privileged contexts
--   INSERT/DELETE: no authenticated policy (service role / SECURITY DEFINER only)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage their own record" ON public.company_users;
DROP POLICY IF EXISTS "Users can view their own record" ON public.company_users;
DROP POLICY IF EXISTS "Users can update their own record" ON public.company_users;

CREATE POLICY "Users can view their own record"
ON public.company_users
FOR SELECT
USING (profile_id = auth.uid());

CREATE POLICY "Users can update their own record"
ON public.company_users
FOR UPDATE
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_company_user_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'supabase_auth_admin') THEN
    -- Block forging of membership, role, status and invitation metadata.
    NEW.company_id := OLD.company_id;
    NEW.company_type := OLD.company_type;
    NEW.branch_id := OLD.branch_id;
    NEW.role := OLD.role;
    NEW.status := OLD.status;
    NEW.invited_by := OLD.invited_by;
    NEW.invitation_token := OLD.invitation_token;
    NEW.last_login_at := OLD.last_login_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_company_user_privileged_columns ON public.company_users;
CREATE TRIGGER protect_company_user_privileged_columns
  BEFORE UPDATE ON public.company_users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_company_user_privileged_columns();

-- ------------------------------------------------------------
-- Finding 7 (bonus): remove_company_user had NO authorization check -
-- any authenticated user could RPC-delete anyone's membership rows,
-- soft-delete members of any tenant, or wipe profiles of users with no
-- remaining memberships.
--
-- Caller contract (verified): the only client caller is the Team
-- management UI (src/hooks/useCompanyBranches.tsx:350) acting as a
-- company admin/owner of the target company; platform admins manage
-- tenants; edge functions call it with the service role.
--
-- New authorization gate (in order):
--   1. service_role                                  -> allow
--   2. caller removes THEIR OWN membership           -> allow
--   3. platform admin (is_platform_admin)            -> allow
--   4. active company_admin of the same company      -> allow
--   5. company owner (buyers/suppliers .profile_id)  -> allow
--   otherwise -> success:false, error:'Not authorized'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_company_user(
  p_company_user_id uuid,
  p_force_delete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_user RECORD;
  v_profile_id uuid;
  v_user_email text;
  v_company_type text;
  v_has_data boolean;
  v_remaining_memberships int;
  v_authorized boolean := false;
BEGIN
  -- Get user details including company_type
  SELECT cu.*, p.email, p.id as profile_id
  INTO v_company_user
  FROM company_users cu
  LEFT JOIN profiles p ON p.id = cu.profile_id
  WHERE cu.id = p_company_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  v_profile_id := v_company_user.profile_id;
  v_user_email := v_company_user.email;
  v_company_type := v_company_user.company_type;

  -- ---- Authorization gate ----
  IF current_setting('role', true) = 'service_role' THEN
    v_authorized := true;
  ELSIF auth.uid() IS NOT NULL AND v_profile_id = auth.uid() THEN
    v_authorized := true; -- self-removal
  ELSIF auth.uid() IS NOT NULL AND public.is_platform_admin(auth.uid()) THEN
    v_authorized := true;
  ELSIF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.profile_id = auth.uid()
      AND cu.company_id = v_company_user.company_id
      AND cu.company_type = v_company_user.company_type
      AND cu.status = 'active'
      AND cu.role = 'company_admin'
  ) THEN
    v_authorized := true; -- active admin of the same company
  ELSIF auth.uid() IS NOT NULL AND (
    (v_company_user.company_type = 'buyer' AND EXISTS (
      SELECT 1 FROM buyers b WHERE b.id = v_company_user.company_id AND b.profile_id = auth.uid()))
    OR (v_company_user.company_type = 'supplier' AND EXISTS (
      SELECT 1 FROM suppliers s WHERE s.id = v_company_user.company_id AND s.profile_id = auth.uid()))
  ) THEN
    v_authorized := true; -- company owner
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to remove this user');
  END IF;
  -- ---- End authorization gate ----

  -- For PENDING invitations: Check if user has other memberships before full cleanup
  IF v_company_user.status = 'pending' THEN
    RAISE LOG 'Processing pending invitation removal for user: % (company_type: %)', v_user_email, v_company_type;
    
    -- Delete from company_users first
    DELETE FROM company_users WHERE id = p_company_user_id;
    
    -- Check remaining memberships AFTER deletion
    SELECT COUNT(*) INTO v_remaining_memberships
    FROM company_users 
    WHERE profile_id = v_profile_id 
      AND status IN ('active', 'pending');
    
    RAISE LOG 'User % has % remaining memberships after deletion', v_user_email, v_remaining_memberships;
    
    -- Only delete user_roles for this specific company_type
    DELETE FROM user_roles 
    WHERE user_id = v_profile_id 
      AND role = v_company_type::app_role;
    
    -- Update profiles.roles array to remove this role
    UPDATE profiles 
    SET roles = array_remove(roles, v_company_type::user_role)
    WHERE id = v_profile_id;
    
    -- Only delete profile and auth user if NO remaining memberships
    IF v_remaining_memberships = 0 THEN
      DELETE FROM profiles WHERE id = v_profile_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'action', 'hard_delete_required',
        'profile_id', v_profile_id,
        'email', v_user_email,
        'message', 'Pending invitation deleted - no other memberships, email can be reused'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', true,
        'action', 'membership_removed',
        'profile_id', v_profile_id,
        'remaining_memberships', v_remaining_memberships,
        'message', 'Membership removed - user still has access to other companies'
      );
    END IF;
  END IF;

  -- For ACTIVE users: Check for historical data
  SELECT EXISTS (
    SELECT 1 FROM document_assignments 
    WHERE assigned_to = v_profile_id OR assigned_by = v_profile_id
  ) INTO v_has_data;

  IF v_has_data AND NOT p_force_delete THEN
    -- SOFT DELETE: Just mark inactive
    UPDATE company_users 
    SET status = 'inactive' 
    WHERE id = p_company_user_id;
    
    RAISE LOG 'Soft deleting active user with data: %', v_user_email;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'soft_deleted',
      'message', 'User deactivated (has historical data)'
    );
  ELSE
    -- HARD DELETE for active users without data or forced
    RAISE LOG 'Processing active user removal for: % (company_type: %)', v_user_email, v_company_type;
    
    -- Delete from company_users first
    DELETE FROM company_users WHERE id = p_company_user_id;
    
    -- Check remaining memberships AFTER deletion
    SELECT COUNT(*) INTO v_remaining_memberships
    FROM company_users 
    WHERE profile_id = v_profile_id 
      AND status IN ('active', 'pending');
    
    RAISE LOG 'User % has % remaining memberships after deletion', v_user_email, v_remaining_memberships;
    
    -- Only delete user_roles for this specific company_type
    DELETE FROM user_roles 
    WHERE user_id = v_profile_id 
      AND role = v_company_type::app_role;
    
    -- Update profiles.roles array to remove this role
    UPDATE profiles 
    SET roles = array_remove(roles, v_company_type::user_role)
    WHERE id = v_profile_id;
    
    -- Only delete profile and auth user if NO remaining memberships
    IF v_remaining_memberships = 0 THEN
      DELETE FROM profiles WHERE id = v_profile_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'action', 'hard_delete_required',
        'profile_id', v_profile_id,
        'email', v_user_email,
        'message', 'User removed completely - email can be reused'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', true,
        'action', 'membership_removed',
        'profile_id', v_profile_id,
        'remaining_memberships', v_remaining_memberships,
        'message', 'Membership removed - user still has access to other companies'
      );
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.remove_company_user IS 'Removes a company user with proper support for dual-role users. Only removes the specific company_users record and associated role. Profile and auth user are only deleted if the user has no remaining company memberships. Authorization: service_role, self-removal, platform admin, active company_admin of the same company, or the company owner.';
