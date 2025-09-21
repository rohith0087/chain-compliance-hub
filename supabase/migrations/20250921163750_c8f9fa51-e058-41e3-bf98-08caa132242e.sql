-- Add super_admin role to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Create super admin access function
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND 'super_admin' = ANY(roles)
  );
$$;

-- Create comprehensive admin stats function
CREATE OR REPLACE FUNCTION public.get_super_admin_stats()
RETURNS TABLE(
  total_users bigint,
  total_buyers bigint,
  total_suppliers bigint,
  active_connections bigint,
  total_documents bigint,
  pending_requests bigint,
  total_chat_sessions bigint,
  recent_signups bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles) as total_users,
    (SELECT COUNT(*) FROM buyers) as total_buyers,
    (SELECT COUNT(*) FROM suppliers) as total_suppliers,
    (SELECT COUNT(*) FROM buyer_supplier_connections WHERE status = 'approved') as active_connections,
    (SELECT COUNT(*) FROM document_uploads) as total_documents,
    (SELECT COUNT(*) FROM document_requests WHERE status = 'pending') as pending_requests,
    (SELECT COUNT(*) FROM chat_sessions) as total_chat_sessions,
    (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '7 days') as recent_signups;
END;
$$;

-- Create function to get all users with detailed stats
CREATE OR REPLACE FUNCTION public.get_all_users_detailed()
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  roles user_role[],
  company_name text,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  is_buyer boolean,
  is_supplier boolean,
  document_count bigint,
  chat_sessions_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Super admin role required.';
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
    EXISTS(SELECT 1 FROM buyers b WHERE b.profile_id = p.id) as is_buyer,
    EXISTS(SELECT 1 FROM suppliers s WHERE s.profile_id = p.id) as is_supplier,
    COALESCE(doc_count.count, 0) as document_count,
    COALESCE(chat_count.count, 0) as chat_sessions_count
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  LEFT JOIN (
    SELECT uploader_id, COUNT(*) as count
    FROM document_uploads
    WHERE uploader_id IS NOT NULL
    GROUP BY uploader_id
  ) doc_count ON doc_count.uploader_id = p.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) as count
    FROM chat_sessions
    GROUP BY user_id
  ) chat_count ON chat_count.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

-- Create function to reset user password (super admin only)
CREATE OR REPLACE FUNCTION public.super_admin_reset_password(target_user_id uuid, new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Super admin role required.';
  END IF;

  -- This would typically integrate with Supabase Auth admin functions
  -- For now, we'll create an activity log entry
  INSERT INTO user_activity_logs (user_id, activity_type, activity_details)
  VALUES (
    target_user_id,
    'password_reset_by_admin',
    jsonb_build_object(
      'reset_by', auth.uid(),
      'timestamp', now()
    )
  );

  RETURN true;
END;
$$;

-- Create RLS policies for super admin access
CREATE POLICY "Super admins can view all profiles" ON profiles
FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all buyers" ON buyers
FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all suppliers" ON suppliers
FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all connections" ON buyer_supplier_connections
FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all documents" ON document_uploads
FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all requests" ON document_requests
FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all chat sessions" ON chat_sessions
FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all chat messages" ON chat_messages
FOR SELECT USING (is_super_admin(auth.uid()));

-- Create system metrics table for tracking
CREATE TABLE IF NOT EXISTS system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  metadata jsonb DEFAULT '{}',
  recorded_at timestamp with time zone DEFAULT now()
);

ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage system metrics" ON system_metrics
FOR ALL USING (is_super_admin(auth.uid()));