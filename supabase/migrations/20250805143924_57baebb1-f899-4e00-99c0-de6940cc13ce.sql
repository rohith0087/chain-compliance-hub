-- Fix infinite recursion in company_users RLS policies

-- Create security definer function to check if user is company admin
CREATE OR REPLACE FUNCTION public.is_company_admin(p_user_id uuid, p_company_id uuid, p_company_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.profile_id = p_user_id 
      AND cu.company_id = p_company_id 
      AND cu.company_type = p_company_type
      AND cu.role = 'company_admin'
      AND cu.status = 'active'
  );
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Company admins can manage company users" ON public.company_users;
DROP POLICY IF EXISTS "Users can view company users they have access to" ON public.company_users;

-- Create new policies using security definer function
CREATE POLICY "Users can manage their own company user record" 
ON public.company_users 
FOR ALL 
USING (profile_id = auth.uid());

CREATE POLICY "Company admins can manage all company users" 
ON public.company_users 
FOR ALL 
USING (public.is_company_admin(auth.uid(), company_id, company_type));

CREATE POLICY "Users can view company users for companies they belong to" 
ON public.company_users 
FOR SELECT 
USING (
  profile_id = auth.uid() OR 
  company_id IN (
    SELECT DISTINCT cu.company_id 
    FROM public.company_users cu 
    WHERE cu.profile_id = auth.uid() 
      AND cu.company_type = company_users.company_type 
      AND cu.status = 'active'
  )
);