-- Fix "permission denied for table users" error
-- Replace direct auth.users queries with auth.email() function

-- Drop the problematic policies that query auth.users directly
DROP POLICY IF EXISTS "Suppliers can view requests for them" ON supplier_onboarding_requests;
DROP POLICY IF EXISTS "Suppliers can update their onboarding status" ON supplier_onboarding_requests;

-- Recreate policies using auth.email() instead of querying auth.users table
CREATE POLICY "Suppliers can view requests for them" ON supplier_onboarding_requests
FOR SELECT USING (
  supplier_id = public.get_user_supplier_id() 
  OR supplier_email = auth.email()
);

CREATE POLICY "Suppliers can update their onboarding status" ON supplier_onboarding_requests
FOR UPDATE USING (
  supplier_id = public.get_user_supplier_id() 
  OR supplier_email = auth.email()
);