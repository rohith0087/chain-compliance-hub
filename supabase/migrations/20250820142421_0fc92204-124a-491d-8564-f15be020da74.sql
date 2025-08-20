-- Add admin role if not exists and create admin access functions
DO $$ 
BEGIN
    -- Add admin role to user_role enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'admin') THEN
        ALTER TYPE user_role ADD VALUE 'admin';
    END IF;
END $$;

-- Create admin check function
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND 'admin' = ANY(roles)
  );
$$;

-- Create user activity tracking table
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  activity_details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on user_activity_logs
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all activity logs
CREATE POLICY "Admins can view all activity logs" 
ON public.user_activity_logs 
FOR SELECT 
USING (is_admin(auth.uid()));

-- System can insert activity logs
CREATE POLICY "System can insert activity logs" 
ON public.user_activity_logs 
FOR INSERT 
WITH CHECK (true);

-- Create user statistics view for admins
CREATE OR REPLACE VIEW public.admin_user_stats AS
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
  COALESCE(activity_stats.total_activities, 0) as total_activities
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