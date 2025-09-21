-- Add platform admin functions to get users and stats
CREATE OR REPLACE FUNCTION get_platform_admin_stats()
RETURNS TABLE(
  total_users bigint,
  total_buyers bigint,
  total_suppliers bigint,
  active_connections bigint,
  total_documents bigint,
  total_chat_sessions bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is platform admin
  IF NOT EXISTS (
    SELECT 1 FROM platform_administrators pa
    WHERE pa.auth_user_id = auth.uid() 
    AND pa.is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM auth.users) as total_users,
    (SELECT COUNT(*) FROM buyers) as total_buyers,
    (SELECT COUNT(*) FROM suppliers) as total_suppliers,
    (SELECT COUNT(*) FROM buyer_supplier_connections WHERE status = 'approved') as active_connections,
    (SELECT COUNT(*) FROM document_uploads) as total_documents,
    (SELECT COUNT(*) FROM chat_sessions) as total_chat_sessions;
END;
$$;

-- Function to get users for platform admin
CREATE OR REPLACE FUNCTION get_platform_admin_users()
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_buyer boolean,
  is_supplier boolean,
  roles user_role[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is platform admin
  IF NOT EXISTS (
    SELECT 1 FROM platform_administrators pa
    WHERE pa.auth_user_id = auth.uid() 
    AND pa.is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(p.full_name, u.email) as full_name,
    u.created_at,
    u.last_sign_in_at,
    EXISTS(SELECT 1 FROM buyers b WHERE b.profile_id = u.id) as is_buyer,
    EXISTS(SELECT 1 FROM suppliers s WHERE s.profile_id = u.id) as is_supplier,
    COALESCE(p.roles, ARRAY[]::user_role[]) as roles
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- Function to update user roles
CREATE OR REPLACE FUNCTION platform_admin_update_user_role(user_id_param uuid, new_roles user_role[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is platform admin
  IF NOT EXISTS (
    SELECT 1 FROM platform_administrators pa
    WHERE pa.auth_user_id = auth.uid() 
    AND pa.is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Update the user's roles in profiles table
  UPDATE profiles 
  SET roles = new_roles, updated_at = now()
  WHERE id = user_id_param;

  -- If no profile exists, create one
  IF NOT FOUND THEN
    INSERT INTO profiles (id, email, roles)
    SELECT user_id_param, email, new_roles
    FROM auth.users
    WHERE id = user_id_param;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;