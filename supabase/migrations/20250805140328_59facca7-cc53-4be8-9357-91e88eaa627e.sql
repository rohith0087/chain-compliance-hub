-- Add security functions and RLS policies for multi-branch companies

-- Create security definer functions for permission checks
CREATE OR REPLACE FUNCTION public.user_has_company_access(p_user_id UUID, p_company_id UUID, p_company_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.profile_id = p_user_id 
      AND cu.company_id = p_company_id 
      AND cu.company_type = p_company_type
      AND cu.status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_user_id UUID, p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.profile_id = p_user_id 
      AND (cu.branch_id = p_branch_id OR cu.role IN ('company_admin'))
      AND cu.status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id UUID, p_company_id UUID, p_company_type TEXT, p_permission public.permission_type)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check explicit permissions
  IF EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = p_user_id 
      AND up.company_id = p_company_id 
      AND up.company_type = p_company_type
      AND up.permission_type = p_permission
      AND (up.expires_at IS NULL OR up.expires_at > now())
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check role-based permissions
  RETURN EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.profile_id = p_user_id 
      AND cu.company_id = p_company_id 
      AND cu.company_type = p_company_type
      AND cu.status = 'active'
      AND (
        (cu.role = 'company_admin') OR
        (cu.role = 'branch_manager' AND p_permission IN ('read', 'write', 'approve')) OR
        (cu.role = 'document_manager' AND p_permission IN ('read', 'write')) OR
        (cu.role = 'approver' AND p_permission IN ('read', 'approve')) OR
        (cu.role = 'viewer' AND p_permission = 'read')
      )
  );
END;
$$;

-- RLS Policies for company_branches
CREATE POLICY "Users can view branches they have access to"
ON public.company_branches FOR SELECT
USING (public.user_has_company_access(auth.uid(), company_id, company_type));

CREATE POLICY "Company admins can manage branches"
ON public.company_branches FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.profile_id = auth.uid() 
      AND cu.company_id = company_branches.company_id 
      AND cu.company_type = company_branches.company_type
      AND cu.role = 'company_admin'
      AND cu.status = 'active'
  )
);

-- RLS Policies for company_users
CREATE POLICY "Users can view company users they have access to"
ON public.company_users FOR SELECT
USING (
  profile_id = auth.uid() OR 
  public.user_has_company_access(auth.uid(), company_id, company_type)
);

CREATE POLICY "Company admins can manage company users"
ON public.company_users FOR ALL
USING (
  profile_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.profile_id = auth.uid() 
      AND cu.company_id = company_users.company_id 
      AND cu.company_type = company_users.company_type
      AND cu.role IN ('company_admin', 'branch_manager')
      AND cu.status = 'active'
  )
);

-- RLS Policies for user_permissions
CREATE POLICY "Users can view their own permissions"
ON public.user_permissions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Company admins can manage permissions"
ON public.user_permissions FOR ALL
USING (
  user_id = auth.uid() OR
  public.user_has_permission(auth.uid(), company_id, company_type, 'manage_branches')
);

-- Create default main branch for existing companies and migrate users
-- Insert main branches for existing buyers
INSERT INTO public.company_branches (company_id, company_type, branch_name, location)
SELECT id, 'buyer', 'Main Office', address
FROM public.buyers
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_branches cb 
  WHERE cb.company_id = buyers.id AND cb.company_type = 'buyer'
);

-- Insert main branches for existing suppliers  
INSERT INTO public.company_branches (company_id, company_type, branch_name, location)
SELECT id, 'supplier', 'Main Office', address
FROM public.suppliers
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_branches cb 
  WHERE cb.company_id = suppliers.id AND cb.company_type = 'supplier'
);

-- Create company_users entries for existing buyer profiles
INSERT INTO public.company_users (profile_id, company_id, company_type, branch_id, role)
SELECT 
  b.profile_id, 
  b.id, 
  'buyer',
  cb.id,
  'company_admin'
FROM public.buyers b
JOIN public.company_branches cb ON cb.company_id = b.id AND cb.company_type = 'buyer'
WHERE b.profile_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.company_users cu 
    WHERE cu.profile_id = b.profile_id AND cu.company_id = b.id AND cu.company_type = 'buyer'
  );

-- Create company_users entries for existing supplier profiles
INSERT INTO public.company_users (profile_id, company_id, company_type, branch_id, role)
SELECT 
  s.profile_id, 
  s.id, 
  'supplier',
  cb.id,
  'company_admin'
FROM public.suppliers s
JOIN public.company_branches cb ON cb.company_id = s.id AND cb.company_type = 'supplier'
WHERE s.profile_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.company_users cu 
    WHERE cu.profile_id = s.profile_id AND cu.company_id = s.id AND cu.company_type = 'supplier'
  );