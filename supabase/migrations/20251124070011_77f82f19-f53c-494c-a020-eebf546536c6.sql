-- Fix handle_new_user() trigger to create records in BOTH profiles.roles AND user_roles table
-- Critical: Without records in user_roles table, dashboard enters infinite loading loop

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  user_roles_array user_role[];
  invitation_data RECORD;
  role_value user_role;
BEGIN
  -- First, try to find invitation by user_id (most reliable)
  SELECT company_type, role INTO invitation_data
  FROM user_invitations 
  WHERE user_id = NEW.id
  LIMIT 1;
  
  -- If found invitation, set role based on company type
  IF FOUND THEN
    IF invitation_data.company_type = 'buyer' THEN
      user_roles_array := ARRAY['buyer']::user_role[];
    ELSIF invitation_data.company_type = 'supplier' THEN
      user_roles_array := ARRAY['supplier']::user_role[];
    ELSE
      -- Fallback if company_type is not recognized
      user_roles_array := ARRAY['supplier']::user_role[];
    END IF;
  ELSE
    -- Not an invited user, check metadata for roles
    IF NEW.raw_user_meta_data ? 'roles' AND NEW.raw_user_meta_data->'roles' IS NOT NULL THEN
      SELECT ARRAY(
        SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')::user_role
      ) INTO user_roles_array;
    ELSE
      -- Default to supplier for regular signups
      user_roles_array := ARRAY['supplier']::user_role[];
    END IF;
  END IF;

  -- CRITICAL: Create profile record with roles array (for backward compatibility)
  INSERT INTO profiles (id, email, full_name, roles, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    user_roles_array,
    NEW.raw_user_meta_data->>'company_name'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    roles = EXCLUDED.roles,
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  
  -- CRITICAL: Also insert into user_roles table (required for useUserRoles hook)
  -- Without this, dashboard enters infinite loading loop
  FOREACH role_value IN ARRAY user_roles_array
  LOOP
    INSERT INTO user_roles (user_id, role, granted_by, granted_at)
    VALUES (NEW.id, role_value::app_role, NEW.id, now())
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates profile and user_roles records for new users. MUST create records in BOTH profiles.roles (legacy) and user_roles table (authoritative) to prevent infinite dashboard loading. Invited users get role matching their company type, regular signups default to supplier.';