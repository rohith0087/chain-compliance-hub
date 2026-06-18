-- Fix security definer view by making it a regular view and adding proper RLS policies
DROP VIEW IF EXISTS public.admin_user_stats;

-- Create user statistics view without SECURITY DEFINER
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

-- Enable RLS on the view
ALTER VIEW public.admin_user_stats ENABLE ROW LEVEL SECURITY;

-- Admin can view all user stats
CREATE POLICY "Admins can view user statistics" 
ON public.admin_user_stats 
FOR SELECT 
USING (is_admin(auth.uid()));