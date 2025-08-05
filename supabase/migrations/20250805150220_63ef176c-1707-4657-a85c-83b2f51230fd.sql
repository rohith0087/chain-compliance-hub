-- Fix the security definer view issue by converting to a regular view with proper RLS
DROP VIEW IF EXISTS public.user_company_access;

-- Instead, create security definer functions that directly query without recursion
CREATE OR REPLACE FUNCTION public.can_manage_company_users(p_user_id uuid, p_company_id uuid, p_company_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.profile_id = p_user_id 
      AND cu.company_id = p_company_id 
      AND cu.company_type = p_company_type
      AND cu.role = 'company_admin'
      AND cu.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_company_users(p_user_id uuid, p_company_id uuid, p_company_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.profile_id = p_user_id 
      AND cu.company_id = p_company_id 
      AND cu.company_type = p_company_type
      AND cu.status = 'active'
  );
$$;

-- Fix the existing functions that had missing search_path
CREATE OR REPLACE FUNCTION public.user_has_company_access(p_user_id uuid, p_company_id uuid, p_company_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.profile_id = p_user_id 
      AND cu.company_id = p_company_id 
      AND cu.company_type = p_company_type
      AND cu.status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_user_id uuid, p_branch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.profile_id = p_user_id 
      AND (cu.branch_id = p_branch_id OR cu.role IN ('company_admin'))
      AND cu.status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id uuid, p_company_id uuid, p_company_type text, p_permission permission_type)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check explicit permissions
  IF EXISTS (
    SELECT 1 FROM user_permissions up
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
    SELECT 1 FROM company_users cu
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