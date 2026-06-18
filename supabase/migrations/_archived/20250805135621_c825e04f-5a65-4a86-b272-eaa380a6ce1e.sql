-- Step 2: Create tables and functions for multi-branch companies with RBAC

-- Create company_branches table
CREATE TABLE public.company_branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  company_type TEXT NOT NULL CHECK (company_type IN ('buyer', 'supplier')),
  branch_name TEXT NOT NULL,
  location TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  manager_id UUID,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, company_type, branch_name)
);

-- Create company_users table for many-to-many relationship
CREATE TABLE public.company_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  company_id UUID NOT NULL,
  company_type TEXT NOT NULL CHECK (company_type IN ('buyer', 'supplier')),
  branch_id UUID,
  role public.user_role NOT NULL DEFAULT 'viewer',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  invited_by UUID,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, company_id, company_type, branch_id)
);

-- Create user_permissions table for granular permissions
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  company_type TEXT NOT NULL CHECK (company_type IN ('buyer', 'supplier')),
  branch_id UUID,
  permission_type public.permission_type NOT NULL,
  resource_access TEXT, -- JSON for specific resource permissions
  granted_by UUID,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id, company_type, branch_id, permission_type)
);

-- Enable RLS on new tables
ALTER TABLE public.company_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

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

-- Create triggers for updated_at
CREATE TRIGGER update_company_branches_updated_at
  BEFORE UPDATE ON public.company_branches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_users_updated_at
  BEFORE UPDATE ON public.company_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_company_branches_company ON public.company_branches(company_id, company_type);
CREATE INDEX idx_company_users_profile ON public.company_users(profile_id);
CREATE INDEX idx_company_users_company ON public.company_users(company_id, company_type);
CREATE INDEX idx_company_users_branch ON public.company_users(branch_id);
CREATE INDEX idx_user_permissions_user ON public.user_permissions(user_id);
CREATE INDEX idx_user_permissions_company ON public.user_permissions(company_id, company_type);

-- Create default main branch for existing companies
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