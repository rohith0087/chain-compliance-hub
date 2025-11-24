-- Phase 1: Add missing user_roles record for stuck user
INSERT INTO user_roles (user_id, role)
VALUES ('0318d5c1-117d-4e34-b0d8-9cfccf23cb0d', 'buyer')
ON CONFLICT (user_id, role) DO NOTHING;

-- Phase 2: Update trigger to also create user_roles records
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  user_roles user_role[];
  invitation_data RECORD;
  assigned_role user_role;
BEGIN
  -- Look up invitation by user_id
  SELECT company_type, role INTO invitation_data
  FROM user_invitations 
  WHERE user_id = NEW.id
  LIMIT 1;
  
  -- Determine role
  IF FOUND THEN
    IF invitation_data.company_type = 'buyer' THEN
      assigned_role := 'buyer';
    ELSIF invitation_data.company_type = 'supplier' THEN
      assigned_role := 'supplier';
    ELSE
      assigned_role := 'supplier'; -- fallback
    END IF;
  ELSE
    -- Check metadata for roles, default to supplier
    IF NEW.raw_user_meta_data ? 'roles' AND NEW.raw_user_meta_data->'roles' IS NOT NULL THEN
      SELECT (jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')::user_role) INTO assigned_role LIMIT 1;
    ELSE
      assigned_role := 'supplier';
    END IF;
  END IF;

  user_roles := ARRAY[assigned_role]::user_role[];

  -- Create/update profile
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
  
  -- Also create user_roles record for secure role management
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;