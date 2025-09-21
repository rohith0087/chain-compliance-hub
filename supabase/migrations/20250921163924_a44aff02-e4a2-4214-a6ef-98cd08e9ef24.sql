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