-- Update has_role function to also check platform_administrators table
-- This allows platform admins with super_admin or platform_admin roles to pass authorization checks

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check user_roles table (original behavior)
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
  OR (
    -- Also check platform_administrators for super_admin/platform_admin roles
    _role IN ('super_admin', 'platform_admin')
    AND EXISTS (
      SELECT 1
      FROM public.platform_administrators
      WHERE auth_user_id = _user_id
        AND is_active = true
        AND _role::text = ANY(platform_roles::text[])
    )
  )
$$;