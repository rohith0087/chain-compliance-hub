-- Update get_user_supplier_id to support team members (not just owners)
CREATE OR REPLACE FUNCTION public.get_user_supplier_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    -- First check if user is a supplier owner
    (SELECT id FROM suppliers WHERE profile_id = auth.uid() LIMIT 1),
    -- Then check if user is a team member
    (SELECT company_id FROM company_users 
     WHERE profile_id = auth.uid() 
     AND company_type = 'supplier' 
     AND status = 'active' 
     LIMIT 1)
  );
$$;