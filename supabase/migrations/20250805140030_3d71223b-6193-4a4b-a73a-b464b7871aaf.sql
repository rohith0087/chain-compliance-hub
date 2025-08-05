-- Create the update_updated_at_column function and tables for multi-branch companies with RBAC

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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