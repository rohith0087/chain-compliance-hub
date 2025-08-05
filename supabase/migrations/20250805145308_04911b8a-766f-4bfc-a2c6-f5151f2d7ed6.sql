-- Completely disable RLS temporarily to break the recursion
ALTER TABLE public.company_users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can manage own company user record" ON public.company_users;
DROP POLICY IF EXISTS "Users can view company users in their companies" ON public.company_users;
DROP POLICY IF EXISTS "Company admins can manage company users" ON public.company_users;

-- Create a materialized view for user company access (refreshed by trigger)
CREATE OR REPLACE VIEW public.user_company_access AS
SELECT DISTINCT 
  cu.profile_id as user_id,
  cu.company_id,
  cu.company_type,
  CASE WHEN cu.role = 'company_admin' THEN true ELSE false END as is_admin
FROM public.company_users cu
WHERE cu.status = 'active';

-- Create security definer functions that use the view (no recursion)
CREATE OR REPLACE FUNCTION public.can_manage_company_users(p_user_id uuid, p_company_id uuid, p_company_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_access uca
    WHERE uca.user_id = p_user_id 
      AND uca.company_id = p_company_id 
      AND uca.company_type = p_company_type
      AND uca.is_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_company_users(p_user_id uuid, p_company_id uuid, p_company_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_access uca
    WHERE uca.user_id = p_user_id 
      AND uca.company_id = p_company_id 
      AND uca.company_type = p_company_type
  );
$$;

-- Re-enable RLS
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- Create new policies using the security definer functions (no recursion)
CREATE POLICY "Users can manage their own record" 
ON public.company_users 
FOR ALL 
USING (profile_id = auth.uid());

CREATE POLICY "Company admins can manage users"
ON public.company_users
FOR ALL
USING (
  profile_id = auth.uid() 
  OR public.can_manage_company_users(auth.uid(), company_id, company_type)
);

CREATE POLICY "Users can view company users they have access to"
ON public.company_users
FOR SELECT
USING (
  profile_id = auth.uid() 
  OR public.can_view_company_users(auth.uid(), company_id, company_type)
);