-- Enable pgcrypto extension for password functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update the bootstrap function to use a simpler approach
CREATE OR REPLACE FUNCTION create_bootstrap_super_admin(
  p_email text,
  p_full_name text DEFAULT 'Bootstrap Admin',
  p_temp_password text DEFAULT 'ChangeMe2024!'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_exists boolean;
BEGIN
  -- Check if any super admin already exists
  SELECT EXISTS (
    SELECT 1 FROM platform_administrators 
    WHERE 'super_admin' = ANY(platform_roles) AND is_active = true
  ) INTO admin_exists;
  
  IF admin_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Super admin already exists');
  END IF;
  
  -- Return instructions for manual setup instead of trying to create auth user directly
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Please create a user account with email: ' || p_email || ' using Supabase Auth, then call accept_bootstrap_admin function',
    'email', p_email,
    'full_name', p_full_name,
    'next_step', 'manual_auth_creation'
  );
END;
$$;

-- Create a function to accept bootstrap admin after manual user creation
CREATE OR REPLACE FUNCTION accept_bootstrap_admin(
  p_full_name text DEFAULT 'Bootstrap Admin'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
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
  
  -- Create platform admin record
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
    current_user_id,
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