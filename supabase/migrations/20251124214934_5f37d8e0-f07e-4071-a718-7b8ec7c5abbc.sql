-- NUCLEAR FIX: Clean up duplicate data and strengthen trigger

-- Step 1: Clean up duplicate buyer profile for rohithgummadi892@gmail.com
-- This was auto-created by useDemoData.tsx hook
DELETE FROM buyers 
WHERE id = 'fb96655a-5e04-4107-91dc-944705c8798c';
-- This will cascade delete the auto-created branch too

-- Step 2: Strengthen the handle_new_company() trigger to NEVER auto-create for invited users
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  profile_user_id UUID;
  profile_email TEXT;
  has_invitation BOOLEAN;
  main_branch_id UUID;
BEGIN
  -- Get the profile user_id from the new company record
  profile_user_id := NEW.profile_id;
  
  IF profile_user_id IS NULL THEN
    RAISE LOG 'handle_new_company: No profile_id found for new company record';
    RETURN NEW;
  END IF;

  -- Get the user's email
  SELECT email INTO profile_email 
  FROM auth.users 
  WHERE id = profile_user_id;

  -- Check if this user was EVER invited (not just active invitations)
  -- This prevents auto-creating company infrastructure for invited team members
  SELECT EXISTS (
    SELECT 1 FROM user_invitations 
    WHERE user_id = profile_user_id 
    OR email = profile_email
  ) INTO has_invitation;

  -- If user has ANY invitation record, they're a team member - skip auto-creation
  IF has_invitation THEN
    RAISE LOG 'handle_new_company: User % has invitation record, skipping auto-creation', profile_email;
    RETURN NEW;
  END IF;

  RAISE LOG 'handle_new_company: Creating company infrastructure for company owner %', profile_email;

  -- Create Main Office branch
  INSERT INTO company_branches (
    company_id,
    company_type,
    branch_name,
    location,
    status
  ) VALUES (
    NEW.id,
    TG_ARGV[0]::TEXT, -- 'buyer' or 'supplier'
    'Main Office',
    'Headquarters',
    'active'
  ) RETURNING id INTO main_branch_id;

  RAISE LOG 'handle_new_company: Created Main Office branch % for company %', main_branch_id, NEW.id;

  -- Create company_users record for the company owner
  -- Company admin role gets NULL branch_id for all-branches access
  INSERT INTO company_users (
    profile_id,
    company_id,
    company_type,
    role,
    branch_id,
    status,
    joined_at
  ) VALUES (
    profile_user_id,
    NEW.id,
    TG_ARGV[0]::TEXT,
    'company_admin',
    NULL, -- Company admin sees all branches
    'active',
    NOW()
  );

  RAISE LOG 'handle_new_company: Created company_users record for owner % as company_admin', profile_email;

  RETURN NEW;
END;
$$;