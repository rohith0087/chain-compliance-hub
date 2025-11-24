-- Fix handle_new_company() trigger to check company_users instead of deleted user_invitations table
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  profile_user_id UUID;
  profile_email TEXT;
  has_existing_membership BOOLEAN;
  main_branch_id UUID;
BEGIN
  profile_user_id := NEW.profile_id;
  
  IF profile_user_id IS NULL THEN
    RAISE LOG 'handle_new_company: No profile_id found';
    RETURN NEW;
  END IF;

  SELECT email INTO profile_email 
  FROM auth.users 
  WHERE id = profile_user_id;

  -- Check if user already has company_users record (team member)
  -- If they do, skip auto-creation since edge function already created their membership
  SELECT EXISTS (
    SELECT 1 FROM company_users 
    WHERE profile_id = profile_user_id
  ) INTO has_existing_membership;

  IF has_existing_membership THEN
    RAISE LOG 'handle_new_company: User % is team member, skipping auto-creation', profile_email;
    RETURN NEW;
  END IF;

  RAISE LOG 'handle_new_company: Creating infrastructure for company owner %', profile_email;

  -- Create Main Office branch
  INSERT INTO company_branches (
    company_id,
    company_type,
    branch_name,
    location,
    status
  ) VALUES (
    NEW.id,
    TG_ARGV[0]::TEXT,
    'Main Office',
    'Headquarters',
    'active'
  ) RETURNING id INTO main_branch_id;

  RAISE LOG 'handle_new_company: Created Main Office branch % for company %', main_branch_id, NEW.id;

  -- Create company_users record for owner with company_admin role and NULL branch_id (all branches access)
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
    NULL,  -- NULL branch_id gives access to all branches
    'active',
    NOW()
  );

  RAISE LOG 'handle_new_company: Created company_users record for owner %', profile_user_id;

  RETURN NEW;
END;
$$;