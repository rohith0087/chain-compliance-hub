-- Drop and recreate the accept_bootstrap_admin function to fix foreign key constraint
DROP FUNCTION IF EXISTS public.accept_bootstrap_admin(text);

CREATE OR REPLACE FUNCTION public.accept_bootstrap_admin(p_full_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  user_email text;
  admin_exists boolean;
  new_admin_id uuid;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check if any super admin already exists
  SELECT EXISTS (
    SELECT 1 FROM platform_administrators 
    WHERE 'super_admin' = ANY(platform_roles) AND is_active = true
  ) INTO admin_exists;
  
  IF admin_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Super admin already exists');
  END IF;
  
  -- Get user email from auth
  SELECT email INTO user_email FROM auth.users WHERE id = current_user_id;
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User email not found');
  END IF;
  
  -- Create platform admin record (set created_by to NULL for bootstrap admin to avoid foreign key issues)
  INSERT INTO platform_administrators (
    auth_user_id,
    email,
    full_name,
    platform_roles,
    is_active,
    created_by,
    must_change_password,
    metadata
  ) VALUES (
    current_user_id,
    user_email,
    p_full_name,
    ARRAY['super_admin'::platform_role],
    true,
    NULL, -- Set to NULL for bootstrap admin to avoid foreign key constraint
    false,
    jsonb_build_object('bootstrap', true, 'created_at', now())
  ) RETURNING id INTO new_admin_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'admin_id', new_admin_id,
    'email', user_email,
    'message', 'Bootstrap super admin created successfully'
  );
END;
$$;

-- Ensure the is_platform_admin function exists and works correctly
CREATE OR REPLACE FUNCTION public.is_platform_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_administrators 
    WHERE auth_user_id = user_id AND is_active = true
  );
$$;