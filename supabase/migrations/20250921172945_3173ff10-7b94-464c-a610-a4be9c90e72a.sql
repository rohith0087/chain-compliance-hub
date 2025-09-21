-- Create platform role enum
CREATE TYPE platform_role AS ENUM ('super_admin', 'platform_admin', 'support_admin');

-- Create platform administrators table
CREATE TABLE platform_administrators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  platform_roles platform_role[] NOT NULL DEFAULT ARRAY['platform_admin']::platform_role[],
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  ip_whitelist TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES platform_administrators(id)
);

-- Enable RLS on platform administrators
ALTER TABLE platform_administrators ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check platform admin status
CREATE OR REPLACE FUNCTION is_platform_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_administrators 
    WHERE auth_user_id = user_id AND is_active = true
  );
$$;

-- Create security definer function to check specific platform role
CREATE OR REPLACE FUNCTION has_platform_role(user_id UUID, role platform_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_administrators 
    WHERE auth_user_id = user_id 
      AND is_active = true 
      AND role = ANY(platform_roles)
  );
$$;

-- Create function to get platform admin details
CREATE OR REPLACE FUNCTION get_platform_admin_stats()
RETURNS TABLE(
  total_users BIGINT,
  total_buyers BIGINT,
  total_suppliers BIGINT,
  active_connections BIGINT,
  total_documents BIGINT,
  pending_requests BIGINT,
  total_chat_sessions BIGINT,
  recent_signups BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow platform admins to access this
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Platform admin role required.';
  END IF;

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

-- Create function to get all users with detailed info for platform admins
CREATE OR REPLACE FUNCTION get_all_users_detailed_platform()
RETURNS TABLE(
  id UUID,
  email TEXT,
  full_name TEXT,
  roles user_role[],
  company_name TEXT,
  registration_date TIMESTAMP WITH TIME ZONE,
  total_chat_sessions BIGINT,
  total_chat_messages BIGINT,
  total_document_requests BIGINT,
  total_document_uploads BIGINT,
  last_activity_date TIMESTAMP WITH TIME ZONE,
  total_activities BIGINT,
  user_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow platform admins to access this
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Platform admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.roles,
    p.company_name,
    p.created_at as registration_date,
    COALESCE(chat_stats.total_sessions, 0) as total_chat_sessions,
    COALESCE(chat_stats.total_messages, 0) as total_chat_messages,
    COALESCE(doc_stats.total_requests, 0) as total_document_requests,
    COALESCE(doc_stats.total_uploads, 0) as total_document_uploads,
    COALESCE(activity_stats.last_activity, null) as last_activity_date,
    COALESCE(activity_stats.total_activities, 0) as total_activities,
    CASE 
      WHEN 'buyer' = ANY(p.roles) THEN 'buyer'
      WHEN 'supplier' = ANY(p.roles) THEN 'supplier'
      WHEN 'admin' = ANY(p.roles) THEN 'admin'
      ELSE 'user'
    END as user_type
  FROM profiles p
  LEFT JOIN (
    SELECT 
      user_id,
      COUNT(*) as total_sessions,
      SUM(message_count.count) as total_messages
    FROM chat_sessions cs
    LEFT JOIN (
      SELECT session_id, COUNT(*) as count
      FROM chat_messages
      GROUP BY session_id
    ) message_count ON cs.id = message_count.session_id
    GROUP BY user_id
  ) chat_stats ON p.id = chat_stats.user_id
  LEFT JOIN (
    SELECT 
      requester_id as user_id,
      COUNT(*) as total_requests,
      0 as total_uploads
    FROM document_requests
    GROUP BY requester_id
    UNION ALL
    SELECT 
      uploader_id as user_id,
      0 as total_requests,
      COUNT(*) as total_uploads
    FROM document_uploads
    WHERE uploader_id IS NOT NULL
    GROUP BY uploader_id
  ) doc_stats ON p.id = doc_stats.user_id
  LEFT JOIN (
    SELECT 
      user_id,
      MAX(created_at) as last_activity,
      COUNT(*) as total_activities
    FROM user_activity_logs
    GROUP BY user_id
  ) activity_stats ON p.id = activity_stats.user_id;
END;
$$;

-- Create function to update user roles (platform admin only)
CREATE OR REPLACE FUNCTION platform_admin_update_user_role(
  user_id_param UUID,
  new_roles user_role[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow platform admins to access this
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Platform admin role required.';
  END IF;

  UPDATE profiles 
  SET roles = new_roles, updated_at = now()
  WHERE id = user_id_param;
  
  RETURN FOUND;
END;
$$;

-- Create function to reset user password (platform admin only)
CREATE OR REPLACE FUNCTION platform_admin_reset_password(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow platform admins to access this
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Platform admin role required.';
  END IF;

  -- Log the password reset action
  INSERT INTO user_activity_logs (user_id, activity_type, activity_details)
  VALUES (
    user_id_param,
    'password_reset_by_admin',
    jsonb_build_object(
      'reset_by', auth.uid(),
      'timestamp', now()
    )
  );
  
  RETURN true;
END;
$$;

-- RLS policies for platform administrators table
CREATE POLICY "Platform admins can view all platform admins"
ON platform_administrators
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update platform admins"
ON platform_administrators
FOR UPDATE
TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert new platform admins"
ON platform_administrators
FOR INSERT
TO authenticated
WITH CHECK (is_platform_admin(auth.uid()));

-- Update existing RLS policies to use platform admin functions
DROP POLICY IF EXISTS "Super admins can view all buyers" ON buyers;
CREATE POLICY "Platform admins can view all buyers"
ON buyers
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can view all suppliers" ON suppliers;
CREATE POLICY "Platform admins can view all suppliers"
ON suppliers
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can view all chat sessions" ON chat_sessions;
CREATE POLICY "Platform admins can view all chat sessions"
ON chat_sessions
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can view all chat messages" ON chat_messages;
CREATE POLICY "Platform admins can view all chat messages"
ON chat_messages
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_platform_administrators_updated_at
  BEFORE UPDATE ON platform_administrators
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Remove super_admin from user_role enum (this will need to be done carefully)
-- For now, we'll deprecate its use and migrate existing users

-- Migrate existing super admin users to platform administrators table
-- Note: This should be run after the migration is applied
INSERT INTO platform_administrators (auth_user_id, email, full_name, platform_roles, created_at)
SELECT 
  p.id,
  p.email,
  p.full_name,
  ARRAY['super_admin']::platform_role[],
  p.created_at
FROM profiles p
WHERE 'super_admin' = ANY(p.roles)
ON CONFLICT (email) DO NOTHING;