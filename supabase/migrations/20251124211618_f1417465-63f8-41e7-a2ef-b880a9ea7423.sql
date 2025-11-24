-- Clean up duplicate buyer profile for rohithgummadi3@gmail.com
DELETE FROM buyers 
WHERE profile_id = '62f2cb86-298e-48d0-b863-9e69851fc175' 
AND id = '7077af3a-e87b-4119-b0fd-26944b250da1';

-- Delete the auto-created Main Office branch for that duplicate profile
DELETE FROM company_branches 
WHERE company_id = '7077af3a-e87b-4119-b0fd-26944b250da1' 
AND company_type = 'buyer';

-- Delete the duplicate company_users record created by the trigger
DELETE FROM company_users 
WHERE profile_id = '62f2cb86-298e-48d0-b863-9e69851fc175' 
AND company_id = '7077af3a-e87b-4119-b0fd-26944b250da1' 
AND company_type = 'buyer';

-- Update handle_new_company trigger to NOT create infrastructure for invited users
-- This prevents duplicate company_users records when invited users accidentally create profiles
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_branch_id uuid;
  company_type text;
  profile_user_id uuid;
  has_invitation boolean;
BEGIN
  -- Determine company type based on which table triggered this
  IF TG_TABLE_NAME = 'buyers' THEN
    company_type := 'buyer';
  ELSIF TG_TABLE_NAME = 'suppliers' THEN
    company_type := 'supplier';
  ELSE
    RAISE EXCEPTION 'Unexpected table: %', TG_TABLE_NAME;
  END IF;

  profile_user_id := NEW.profile_id;

  -- Check if this user has an active invitation
  -- If they do, they're a team member and should NOT get auto-created infrastructure
  SELECT EXISTS (
    SELECT 1 FROM user_invitations 
    WHERE user_id = profile_user_id
  ) INTO has_invitation;

  -- Only create infrastructure for company owners (no invitation)
  IF NOT has_invitation THEN
    -- Create Main Office branch
    INSERT INTO company_branches (
      company_id,
      company_type,
      branch_name,
      status
    ) VALUES (
      NEW.id,
      company_type,
      'Main Office',
      'active'
    ) RETURNING id INTO new_branch_id;

    -- Create company_users record for the owner
    INSERT INTO company_users (
      profile_id,
      company_id,
      company_type,
      branch_id,
      role,
      status,
      joined_at
    ) VALUES (
      profile_user_id,
      NEW.id,
      company_type,
      NULL,  -- Company admins have NULL branch_id for all-branch access
      'company_admin',
      'active',
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;