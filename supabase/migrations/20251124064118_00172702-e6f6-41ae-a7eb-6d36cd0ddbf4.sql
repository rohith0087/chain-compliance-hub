-- Phase 1: Create missing Main Office branch for gummadirohith80@gmail.com
DO $$
DECLARE
  v_branch_id uuid;
BEGIN
  -- Create Main Office branch for Deb EL Foods (buyer ID: 980810c5-dc4d-4a55-a9df-393a6636fa29)
  INSERT INTO company_branches (
    company_id,
    company_type,
    branch_name,
    status
  ) VALUES (
    '980810c5-dc4d-4a55-a9df-393a6636fa29',
    'buyer',
    'Main Office',
    'active'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_branch_id;
  
  -- If branch was created, update company_users record
  IF v_branch_id IS NOT NULL THEN
    UPDATE company_users
    SET 
      branch_id = v_branch_id,
      role = 'company_admin'::user_role
    WHERE profile_id = '0318d5c1-117d-4e34-b0d8-9cfccf23cb0d'
      AND company_type = 'buyer'
      AND company_id = '980810c5-dc4d-4a55-a9df-393a6636fa29';
  ELSE
    -- Branch already exists, just update the link
    UPDATE company_users
    SET 
      branch_id = (
        SELECT id FROM company_branches 
        WHERE company_id = '980810c5-dc4d-4a55-a9df-393a6636fa29' 
        AND company_type = 'buyer' 
        AND branch_name = 'Main Office'
        LIMIT 1
      ),
      role = 'company_admin'::user_role
    WHERE profile_id = '0318d5c1-117d-4e34-b0d8-9cfccf23cb0d'
      AND company_type = 'buyer'
      AND company_id = '980810c5-dc4d-4a55-a9df-393a6636fa29';
  END IF;
END $$;

-- Phase 3: Create database trigger for automatic branch creation
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  branch_id uuid;
  company_type_val text;
BEGIN
  -- Determine if this is buyer or supplier
  IF TG_TABLE_NAME = 'buyers' THEN
    company_type_val := 'buyer';
  ELSIF TG_TABLE_NAME = 'suppliers' THEN
    company_type_val := 'supplier';
  ELSE
    RETURN NEW;
  END IF;
  
  -- Create default "Main Office" branch
  INSERT INTO company_branches (
    company_id,
    company_type,
    branch_name,
    status
  ) VALUES (
    NEW.id,
    company_type_val,
    'Main Office',
    'active'
  )
  RETURNING id INTO branch_id;
  
  -- Create company_users record for the owner with company_admin role
  INSERT INTO company_users (
    profile_id,
    company_id,
    company_type,
    branch_id,
    role,
    status
  ) VALUES (
    NEW.profile_id,
    NEW.id,
    company_type_val,
    branch_id,
    'company_admin',
    'active'
  )
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS create_default_branch_for_buyer ON buyers;
DROP TRIGGER IF EXISTS create_default_branch_for_supplier ON suppliers;

-- Apply trigger to buyers table
CREATE TRIGGER create_default_branch_for_buyer
  AFTER INSERT ON buyers
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_company();

-- Apply trigger to suppliers table
CREATE TRIGGER create_default_branch_for_supplier
  AFTER INSERT ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_company();