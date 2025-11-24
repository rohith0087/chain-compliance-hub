-- Phase 1: Fix handle_new_user() trigger to set correct roles based on invitation
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
  -- Check if this user was invited (has invitation metadata)
  IF NEW.raw_user_meta_data ? 'invite_token' THEN
    -- This is an invited user, get company_type from invitation to set correct role
    SELECT company_type, role INTO invitation_data
    FROM user_invitations 
    WHERE token = NEW.raw_user_meta_data->>'invite_token' 
    AND user_id = NEW.id;
    
    -- Set role based on the company type they're joining
    IF invitation_data.company_type = 'buyer' THEN
      user_roles := ARRAY['buyer']::user_role[];
    ELSIF invitation_data.company_type = 'supplier' THEN
      user_roles := ARRAY['supplier']::user_role[];
    ELSE
      -- Fallback if company_type is not found
      user_roles := ARRAY['supplier']::user_role[];
    END IF;
  ELSE
    -- Regular signup, use provided roles or default to supplier
    IF NEW.raw_user_meta_data ? 'roles' AND NEW.raw_user_meta_data->'roles' IS NOT NULL THEN
      SELECT ARRAY(
        SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')::user_role
      ) INTO user_roles;
    ELSE
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

-- Phase 4: Clean up incorrectly created supplier profiles for invited buyer team members
-- Delete supplier profiles that were created for users who are actually buyer team members
DELETE FROM suppliers 
WHERE profile_id IN (
  SELECT DISTINCT cu.profile_id 
  FROM company_users cu
  JOIN suppliers s ON s.profile_id = cu.profile_id
  WHERE cu.company_type = 'buyer' 
  AND cu.status = 'active'
  AND s.company_name LIKE '%Deb EL Foods%' -- Safety check: only clean up related to the buyer company
);

-- Add helpful comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates profile for new users with correct role based on invitation context. Invited users get role matching their company type (buyer/supplier), while regular signups default to supplier.';
