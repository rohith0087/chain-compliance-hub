-- ============================================================
-- ROLLBACK SNAPSHOT — captured from LIVE Complience DB
-- (edwerzutsknhuplidhsj) on 2026-07-22, immediately BEFORE applying
-- 20260722120000_critical_privilege_lockdown.sql
--
-- Restores the exact pre-migration state of every affected object.
-- Apply ONLY if the lockdown migration must be reverted.
-- ============================================================

-- ---- 1. Restore vulnerable handle_new_user (verbatim live definition) ----
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_roles_array user_role[] := ARRAY[]::user_role[];
  role_text text;
  i int;
BEGIN
  IF NEW.raw_user_meta_data->'roles' IS NOT NULL AND jsonb_array_length(NEW.raw_user_meta_data->'roles') > 0 THEN
    FOR i IN 0..jsonb_array_length(NEW.raw_user_meta_data->'roles') - 1 LOOP
      role_text := NEW.raw_user_meta_data->'roles'->>i;
      user_roles_array := array_append(user_roles_array, role_text::user_role);
    END LOOP;
  ELSIF NEW.raw_user_meta_data->>'company_type' IS NOT NULL THEN
    user_roles_array := ARRAY[(NEW.raw_user_meta_data->>'company_type')::user_role];
  ELSE
    user_roles_array := ARRAY['supplier'::user_role];
  END IF;

  INSERT INTO public.profiles (id, email, full_name, roles, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    user_roles_array,
    NOW()
  );

  FOREACH role_text IN ARRAY user_roles_array LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, role_text::text::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- ---- 2. Drop the protection triggers added by the lockdown ----
DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_privileged_columns();
DROP TRIGGER IF EXISTS protect_company_user_privileged_columns ON public.company_users;
DROP FUNCTION IF EXISTS public.protect_company_user_privileged_columns();

-- ---- 3. Restore company_users self FOR ALL policy ----
DROP POLICY IF EXISTS "Users can view their own record" ON public.company_users;
DROP POLICY IF EXISTS "Users can update their own record" ON public.company_users;
CREATE POLICY "Users can manage their own record"
  ON public.company_users FOR ALL
  USING (profile_id = auth.uid());

-- ---- 4. Restore subscriptions self-UPDATE policy ----
CREATE POLICY "Users can update their own subscription"
  ON public.subscriptions FOR UPDATE
  USING (user_id = auth.uid());

-- ---- 5. Remove service_role policies added by the lockdown ----
-- (user_credits and user_invitations had NO mutation policies pre-migration)
DROP POLICY IF EXISTS "Service role can manage user credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service role can manage invitations" ON public.user_invitations;

-- ---- 6. Restore remove_company_user WITHOUT the authorization gate ----
-- (verbatim live definition captured pre-migration)
CREATE OR REPLACE FUNCTION public.remove_company_user(p_company_user_id uuid, p_force_delete boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_user RECORD;
  v_profile_id uuid;
  v_user_email text;
  v_company_type text;
  v_has_data boolean;
  v_remaining_memberships int;
BEGIN
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

  IF v_company_user.status = 'pending' THEN
    DELETE FROM company_users WHERE id = p_company_user_id;
    SELECT COUNT(*) INTO v_remaining_memberships
    FROM company_users
    WHERE profile_id = v_profile_id
      AND status IN ('active', 'pending');
    DELETE FROM user_roles
    WHERE user_id = v_profile_id
      AND role = v_company_type::app_role;
    UPDATE profiles
    SET roles = array_remove(roles, v_company_type::user_role)
    WHERE id = v_profile_id;
    IF v_remaining_memberships = 0 THEN
      DELETE FROM profiles WHERE id = v_profile_id;
      RETURN jsonb_build_object('success', true, 'action', 'hard_delete_required', 'profile_id', v_profile_id, 'email', v_user_email, 'message', 'Pending invitation deleted - no other memberships, email can be reused');
    ELSE
      RETURN jsonb_build_object('success', true, 'action', 'membership_removed', 'profile_id', v_profile_id, 'remaining_memberships', v_remaining_memberships, 'message', 'Membership removed - user still has access to other companies');
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM document_assignments
    WHERE assigned_to = v_profile_id OR assigned_by = v_profile_id
  ) INTO v_has_data;

  IF v_has_data AND NOT p_force_delete THEN
    UPDATE company_users SET status = 'inactive' WHERE id = p_company_user_id;
    RETURN jsonb_build_object('success', true, 'action', 'soft_deleted', 'message', 'User deactivated (has historical data)');
  ELSE
    DELETE FROM company_users WHERE id = p_company_user_id;
    SELECT COUNT(*) INTO v_remaining_memberships
    FROM company_users
    WHERE profile_id = v_profile_id
      AND status IN ('active', 'pending');
    DELETE FROM user_roles
    WHERE user_id = v_profile_id
      AND role = v_company_type::app_role;
    UPDATE profiles
    SET roles = array_remove(roles, v_company_type::user_role)
    WHERE id = v_profile_id;
    IF v_remaining_memberships = 0 THEN
      DELETE FROM profiles WHERE id = v_profile_id;
      RETURN jsonb_build_object('success', true, 'action', 'hard_delete_required', 'profile_id', v_profile_id, 'email', v_user_email, 'message', 'User removed completely - email can be reused');
    ELSE
      RETURN jsonb_build_object('success', true, 'action', 'membership_removed', 'profile_id', v_profile_id, 'remaining_memberships', v_remaining_memberships, 'message', 'Membership removed - user still has access to other companies');
    END IF;
  END IF;
END;
$function$;

-- NOTE: the live pg_policies snapshot (all policies on the 5 affected
-- tables) was also captured verbatim in the session transcript if finer
-- restoration is needed. Supabase dashboard automatic backups are the
-- data-level safety net; this file covers the schema/policy level.
