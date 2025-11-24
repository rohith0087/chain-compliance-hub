-- Phase 1: Data Cleanup - Fix the stuck invited user
-- Fix the invited user's incorrect role
UPDATE profiles 
SET roles = ARRAY['buyer']::user_role[]
WHERE id = '0318d5c1-117d-4e34-b0d8-9cfccf23cb0d';

-- Delete the incorrectly created supplier profile
DELETE FROM suppliers 
WHERE profile_id = '0318d5c1-117d-4e34-b0d8-9cfccf23cb0d';

-- Phase 2: Fix Database Trigger - Look up invitation by user_id instead of token
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  user_roles user_role[];
  invitation_data RECORD;
BEGIN
  -- First, try to find invitation by user_id (most reliable)
  SELECT company_type, role INTO invitation_data
  FROM user_invitations 
  WHERE user_id = NEW.id
  LIMIT 1;
  
  -- If found invitation, set role based on company type
  IF FOUND THEN
    IF invitation_data.company_type = 'buyer' THEN
      user_roles := ARRAY['buyer']::user_role[];
    ELSIF invitation_data.company_type = 'supplier' THEN
      user_roles := ARRAY['supplier']::user_role[];
    ELSE
      -- Fallback if company_type is not recognized
      user_roles := ARRAY['supplier']::user_role[];
    END IF;
  ELSE
    -- Not an invited user, check metadata for roles
    IF NEW.raw_user_meta_data ? 'roles' AND NEW.raw_user_meta_data->'roles' IS NOT NULL THEN
      SELECT ARRAY(
        SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')::user_role
      ) INTO user_roles;
    ELSE
      -- Default to supplier for regular signups
      user_roles := ARRAY['supplier']::user_role[];
    END IF;
  END IF;

  -- Create or update the profile with correct roles
  INSERT INTO profiles (id, email, full_name, roles, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    user_roles,
    NEW.raw_user_meta_data->>'company_name'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    roles = EXCLUDED.roles,
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates profile for new users with correct role based on user_invitations table lookup. Invited users get role matching their company type, regular signups default to supplier.';