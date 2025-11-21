-- PHASE 2 & 3: Data Migration and Database Function Updates

-- PHASE 2: Migrate existing role data from profiles.roles to user_roles table
DO $$
DECLARE
  profile_record RECORD;
  role_value text;
  migrated_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  -- Loop through all profiles with roles
  FOR profile_record IN 
    SELECT id, roles, email 
    FROM profiles 
    WHERE roles IS NOT NULL AND array_length(roles, 1) > 0
  LOOP
    BEGIN
      -- Insert each role for the user
      FOREACH role_value IN ARRAY profile_record.roles
      LOOP
        -- Map old user_role enum to new app_role enum
        INSERT INTO user_roles (user_id, role, granted_by, granted_at)
        VALUES (
          profile_record.id,
          role_value::app_role,
          profile_record.id,
          now()
        )
        ON CONFLICT (user_id, role) DO NOTHING;
        
        migrated_count := migrated_count + 1;
      END LOOP;
      
      RAISE NOTICE 'Migrated roles for user %: %', profile_record.email, profile_record.roles;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error migrating roles for user % (%): %', 
        profile_record.email, profile_record.id, SQLERRM;
      error_count := error_count + 1;
    END;
  END LOOP;
  
  RAISE NOTICE 'Migration complete: % roles migrated, % errors', migrated_count, error_count;
END $$;

-- Create temporary backward compatibility view
CREATE OR REPLACE VIEW profiles_with_roles AS
SELECT 
  p.*,
  COALESCE(
    array_agg(ur.role::text ORDER BY ur.granted_at) FILTER (WHERE ur.role IS NOT NULL),
    ARRAY[]::text[]
  ) as roles_from_table
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id AND ur.is_active = true
GROUP BY p.id;

GRANT SELECT ON profiles_with_roles TO authenticated;

-- PHASE 3: Update database functions to use new user_roles table

-- Update is_super_admin to use has_role()
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(user_id, 'super_admin'::app_role);
$$;

-- Update Super Admin RLS policies
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
CREATE POLICY "Super admins can view all profiles" 
ON profiles FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can view all buyers" ON buyers;
CREATE POLICY "Super admins can view all buyers" 
ON buyers FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can view all suppliers" ON suppliers;
CREATE POLICY "Super admins can view all suppliers" 
ON suppliers FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can view all connections" ON buyer_supplier_connections;
CREATE POLICY "Super admins can view all connections" 
ON buyer_supplier_connections FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Create helper function to get user roles as array
CREATE OR REPLACE FUNCTION public.get_user_roles_array(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(role::text ORDER BY granted_at),
    ARRAY[]::text[]
  )
  FROM user_roles
  WHERE user_id = _user_id 
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
$$;

-- Drop and recreate get_super_admin_stats with proper authorization
DROP FUNCTION IF EXISTS public.get_super_admin_stats();
CREATE FUNCTION public.get_super_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Only super admins can access this function';
  END IF;

  SELECT json_build_object(
    'totalUsers', (SELECT COUNT(*) FROM profiles),
    'totalBuyers', (SELECT COUNT(*) FROM buyers),
    'totalSuppliers', (SELECT COUNT(*) FROM suppliers),
    'totalConnections', (SELECT COUNT(*) FROM buyer_supplier_connections WHERE status = 'approved'),
    'pendingConnections', (SELECT COUNT(*) FROM buyer_supplier_connections WHERE status = 'pending'),
    'activeSubscriptions', (SELECT COUNT(*) FROM profiles WHERE subscription_status = 'active'),
    'totalRevenue', COALESCE((SELECT SUM(credits_amount) FROM credit_transactions WHERE transaction_type = 'purchase'), 0)
  ) INTO result;

  RETURN result;
END;
$$;

-- Drop and recreate get_all_users_detailed with new role system
DROP FUNCTION IF EXISTS public.get_all_users_detailed();
CREATE FUNCTION public.get_all_users_detailed()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  roles text[],
  company_name text,
  subscription_status text,
  subscription_tier text,
  credits_balance integer,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Only super admins can access this function';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    public.get_user_roles_array(p.id) as roles,
    p.company_name,
    p.subscription_status,
    p.subscription_tier,
    p.credits_balance,
    p.created_at,
    p.last_sign_in_at
  FROM profiles p
  ORDER BY p.created_at DESC;
END;
$$;