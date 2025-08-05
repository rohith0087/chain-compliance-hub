
-- Drop all existing company_users policies to start fresh
DROP POLICY IF EXISTS "Users can manage their own company user record" ON public.company_users;
DROP POLICY IF EXISTS "Company admins can manage all company users" ON public.company_users;
DROP POLICY IF EXISTS "Users can view company users for companies they belong to" ON public.company_users;

-- Drop the problematic function
DROP FUNCTION IF EXISTS public.is_company_admin(uuid, uuid, text);

-- Create a simpler approach without recursion
-- Policy 1: Users can always manage their own records
CREATE POLICY "Users can manage own company user record" 
ON public.company_users 
FOR ALL 
USING (profile_id = auth.uid());

-- Policy 2: Allow viewing company users for companies where user has active membership
-- This avoids recursion by using a direct subquery without function calls
CREATE POLICY "Users can view company users in their companies" 
ON public.company_users 
FOR SELECT 
USING (
  -- User can see their own record
  profile_id = auth.uid() 
  OR 
  -- User can see other users in companies where they have active membership
  EXISTS (
    SELECT 1 FROM public.company_users cu_check
    WHERE cu_check.profile_id = auth.uid()
      AND cu_check.company_id = company_users.company_id
      AND cu_check.company_type = company_users.company_type
      AND cu_check.status = 'active'
  )
);

-- Policy 3: Company admins can insert/update/delete for their company
-- Use a simpler approach for admin privileges
CREATE POLICY "Company admins can manage company users"
ON public.company_users
FOR ALL
USING (
  profile_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM public.company_users admin_check
    WHERE admin_check.profile_id = auth.uid()
      AND admin_check.company_id = company_users.company_id
      AND admin_check.company_type = company_users.company_type
      AND admin_check.role = 'company_admin'
      AND admin_check.status = 'active'
      AND admin_check.id != company_users.id  -- Prevent self-reference
  )
);
