-- Drop and recreate the function with correct signature
DROP FUNCTION IF EXISTS get_platform_admin_users();

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