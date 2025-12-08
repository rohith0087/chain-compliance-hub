-- Step 1: Create Main Office branch for Deb El Food Products buyer company
INSERT INTO company_branches (
  company_id,
  company_type,
  branch_name,
  location,
  status
) VALUES (
  '5d162b97-0a03-4439-9eaf-9fb7c1fbe4b1',
  'buyer',
  'Main Office',
  'Headquarters',
  'active'
);

-- Step 2: Create company_users record for Patricia as buyer company owner
INSERT INTO company_users (
  profile_id,
  company_id,
  company_type,
  role,
  branch_id,
  status,
  joined_at
) VALUES (
  'a9e7e7c2-dcf7-430c-a187-a6d708dd2866',
  '5d162b97-0a03-4439-9eaf-9fb7c1fbe4b1',
  'buyer',
  'company_admin',
  NULL,
  'active',
  NOW()
);

-- Step 3: Fix handle_new_company trigger to support dual-role users
-- The bug was checking for ANY company_users record, not same company_type
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER AS $$
DECLARE
  new_branch_id UUID;
  profile_user_id UUID;
  has_existing_membership BOOLEAN;
  company_type_arg TEXT;
BEGIN
  -- Get company_type from trigger argument
  company_type_arg := TG_ARGV[0]::TEXT;
  
  -- Get the profile_id from the new record
  profile_user_id := NEW.profile_id;
  
  -- Skip if no profile_id (shouldn't happen for company owners)
  IF profile_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if this user already has a company_users record for THIS COMPANY TYPE
  -- This allows dual-role users (both buyer and supplier) to get infrastructure for both
  SELECT EXISTS (
    SELECT 1 FROM company_users 
    WHERE profile_id = profile_user_id
    AND company_type = company_type_arg
  ) INTO has_existing_membership;
  
  -- Only create infrastructure if user doesn't have membership for this company type
  IF NOT has_existing_membership THEN
    -- Create Main Office branch
    INSERT INTO company_branches (
      company_id,
      company_type,
      branch_name,
      location,
      status
    ) VALUES (
      NEW.id,
      company_type_arg,
      'Main Office',
      'Headquarters',
      'active'
    )
    RETURNING id INTO new_branch_id;
    
    -- Create company_users record for owner with company_admin role
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
      company_type_arg,
      'company_admin',
      NULL,  -- NULL branch_id = access to all branches
      'active',
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;