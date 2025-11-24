-- Fix handle_new_user trigger to properly detect company_type from metadata
-- This prevents invited users from getting the wrong role (supplier instead of buyer)

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
  app_role_value app_role;
  metadata_company_type text;
BEGIN
  -- CRITICAL FIX: Check user_invitations FIRST (most reliable)
  SELECT company_type, role INTO invitation_data
  FROM user_invitations 
  WHERE user_id = NEW.id
  LIMIT 1;
  
  -- If found invitation, use company_type from invitation
  IF FOUND THEN
    IF invitation_data.company_type = 'buyer' THEN
      user_roles_array := ARRAY['buyer']::user_role[];
    ELSIF invitation_data.company_type = 'supplier' THEN
      user_roles_array := ARRAY['supplier']::user_role[];
    ELSE
      user_roles_array := ARRAY['supplier']::user_role[];
    END IF;
    
    RAISE LOG 'Invited user detected - setting role from invitation: %', user_roles_array;
  ELSE
    -- Not an invited user OR invitation not inserted yet (race condition)
    -- Check metadata for company_type (from edge function)
    metadata_company_type := NEW.raw_user_meta_data->>'company_type';
    
    IF metadata_company_type IS NOT NULL THEN
      -- Edge function set company_type in metadata
      IF metadata_company_type = 'buyer' THEN
        user_roles_array := ARRAY['buyer']::user_role[];
      ELSIF metadata_company_type = 'supplier' THEN
        user_roles_array := ARRAY['supplier']::user_role[];
      ELSE
        user_roles_array := ARRAY['supplier']::user_role[];
      END IF;
      
      RAISE LOG 'Using company_type from metadata: % -> roles: %', metadata_company_type, user_roles_array;
    ELSIF NEW.raw_user_meta_data ? 'roles' AND NEW.raw_user_meta_data->'roles' IS NOT NULL THEN
      -- Fallback: check for explicit roles array
      SELECT ARRAY(
        SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')::user_role
      ) INTO user_roles_array;
      
      RAISE LOG 'Using roles array from metadata: %', user_roles_array;
    ELSE
      -- Final fallback: default to supplier for regular signups
      user_roles_array := ARRAY['supplier']::user_role[];
      
      RAISE LOG 'No invitation or metadata - defaulting to supplier';
    END IF;
  END IF;

  -- Create profile record with roles array (for backward compatibility)
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
  
  -- Also insert into user_roles table (required for useUserRoles hook)
  FOREACH role_value IN ARRAY user_roles_array
  LOOP
    app_role_value := role_value::text::app_role;
    
    INSERT INTO user_roles (user_id, role, granted_by, granted_at)
    VALUES (NEW.id, app_role_value, NEW.id, now())
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$;