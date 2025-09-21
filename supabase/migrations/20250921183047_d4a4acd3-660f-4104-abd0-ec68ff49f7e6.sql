-- Drop and recreate the platform admin functions
DROP FUNCTION IF EXISTS public.get_platform_admin_stats();

-- Fix the is_platform_admin function to work properly with auth context
CREATE OR REPLACE FUNCTION public.is_platform_admin(user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  check_user_id uuid;
BEGIN
  -- Use provided user_id or fall back to auth.uid()
  check_user_id := COALESCE(user_id, auth.uid());
  
  -- Return false if no user ID available
  IF check_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user exists in platform_administrators table and is active
  RETURN EXISTS (
    SELECT 1 FROM platform_administrators 
    WHERE auth_user_id = check_user_id 
      AND is_active = true
      AND array_length(platform_roles, 1) > 0
  );
END;
$function$;

-- Create a new function to get platform admin stats that works with frontend auth
CREATE OR REPLACE FUNCTION public.get_platform_admin_stats()
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
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if current user is platform admin
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Platform admin privileges required.';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles)::bigint as total_users,
    (SELECT COUNT(*) FROM buyers)::bigint as total_buyers,
    (SELECT COUNT(*) FROM suppliers)::bigint as total_suppliers,
    (SELECT COUNT(*) FROM buyer_supplier_connections WHERE status = 'approved')::bigint as active_connections,
    (SELECT COUNT(*) FROM document_uploads)::bigint as total_documents,
    (SELECT COUNT(*) FROM chat_sessions)::bigint as total_chat_sessions;
END;
$function$;

-- Create a function to get all users with proper authentication
CREATE OR REPLACE FUNCTION public.get_platform_admin_users()
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  roles user_role[],
  company_name text,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  email_confirmed_at timestamp with time zone,
  phone text,
  is_buyer boolean,
  is_supplier boolean,
  buyer_company text,
  supplier_company text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if current user is platform admin
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Platform admin privileges required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.roles,
    p.company_name,
    p.created_at,
    au.last_sign_in_at,
    au.email_confirmed_at,
    au.phone,
    (EXISTS(SELECT 1 FROM buyers b WHERE b.profile_id = p.id))::boolean as is_buyer,
    (EXISTS(SELECT 1 FROM suppliers s WHERE s.profile_id = p.id))::boolean as is_supplier,
    b.company_name as buyer_company,
    s.company_name as supplier_company
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  LEFT JOIN buyers b ON b.profile_id = p.id
  LEFT JOIN suppliers s ON s.profile_id = p.id
  ORDER BY p.created_at DESC;
END;
$function$;