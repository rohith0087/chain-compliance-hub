-- Drop all existing platform admin functions first
DROP FUNCTION IF EXISTS public.get_platform_admin_stats();
DROP FUNCTION IF EXISTS public.get_platform_admin_invitations();
DROP FUNCTION IF EXISTS public.get_platform_admin_users();
DROP FUNCTION IF EXISTS public.get_all_users_detailed_platform();

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

-- Create function to get platform admin invitations
CREATE OR REPLACE FUNCTION public.get_platform_admin_invitations()
RETURNS TABLE(
  id uuid,
  email text,
  platform_roles platform_role[],
  invited_by uuid,
  inviter_name text,
  expires_at timestamp with time zone,
  is_used boolean,
  created_at timestamp with time zone
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
    pai.id,
    pai.email,
    pai.platform_roles,
    pai.invited_by,
    pa.full_name as inviter_name,
    pai.expires_at,
    pai.is_used,
    pai.created_at
  FROM platform_admin_invitations pai
  LEFT JOIN platform_administrators pa ON pa.auth_user_id = pai.invited_by
  WHERE pai.expires_at > now() OR pai.is_used = true
  ORDER BY pai.created_at DESC;
END;
$function$;