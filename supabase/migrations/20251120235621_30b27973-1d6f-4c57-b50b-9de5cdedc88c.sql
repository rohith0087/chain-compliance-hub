-- Phase 1: Create Secure Database Infrastructure for Role Management

-- Step 1: Create the app_role enum type
CREATE TYPE public.app_role AS ENUM (
  'buyer',
  'supplier', 
  'admin',
  'super_admin',
  'platform_admin',
  'company_admin',
  'branch_manager',
  'document_manager',
  'approver',
  'viewer'
);

-- Step 2: Create the user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Step 3: Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for user_roles table
-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'super_admin', 'platform_admin')
    AND ur.is_active = true
  )
);

-- Only admins can grant roles
CREATE POLICY "Admins can grant roles"
ON public.user_roles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'super_admin', 'platform_admin')
    AND ur.is_active = true
  )
);

-- Only admins can revoke roles
CREATE POLICY "Admins can revoke roles"
ON public.user_roles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'super_admin', 'platform_admin')
    AND ur.is_active = true
  )
);

-- Step 5: Create security definer functions

-- Function 1: Check if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Function 2: Check if a user has any of the specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Function 3: Get all active roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS TABLE(role app_role, granted_at timestamp with time zone, expires_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role, granted_at, expires_at
  FROM public.user_roles
  WHERE user_id = _user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY granted_at DESC
$$;

-- Function 4: Grant a role to a user (with authorization check)
CREATE OR REPLACE FUNCTION public.grant_role(
  _target_user_id uuid,
  _role app_role,
  _expires_at timestamp with time zone DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
  v_granter_id uuid;
BEGIN
  -- Get the current user
  v_granter_id := auth.uid();
  
  -- Check if granter has permission (must be admin, super_admin, or platform_admin)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_granter_id
      AND role IN ('admin', 'super_admin', 'platform_admin')
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only admins can grant roles';
  END IF;
  
  -- Insert or update the role
  INSERT INTO public.user_roles (user_id, role, granted_by, expires_at, metadata)
  VALUES (_target_user_id, _role, v_granter_id, _expires_at, _metadata)
  ON CONFLICT (user_id, role) 
  DO UPDATE SET
    is_active = true,
    granted_by = v_granter_id,
    granted_at = now(),
    expires_at = _expires_at,
    metadata = _metadata,
    updated_at = now()
  RETURNING id INTO v_role_id;
  
  RETURN v_role_id;
END;
$$;

-- Function 5: Revoke a role from a user (with authorization check)
CREATE OR REPLACE FUNCTION public.revoke_role(
  _target_user_id uuid,
  _role app_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revoker_id uuid;
BEGIN
  -- Get the current user
  v_revoker_id := auth.uid();
  
  -- Check if revoker has permission
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_revoker_id
      AND role IN ('admin', 'super_admin', 'platform_admin')
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only admins can revoke roles';
  END IF;
  
  -- Mark the role as inactive instead of deleting for audit trail
  UPDATE public.user_roles
  SET is_active = false, updated_at = now()
  WHERE user_id = _target_user_id AND role = _role;
  
  RETURN FOUND;
END;
$$;

-- Step 6: Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_roles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_roles_timestamp
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_roles_updated_at();

-- Step 7: Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_user_roles_active ON public.user_roles(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_roles_expires ON public.user_roles(expires_at) WHERE expires_at IS NOT NULL;