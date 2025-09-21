-- Create function to get all users with detailed stats (accessible to super admin)
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
    p.created_at as last_sign_in_at, -- Simplified since we can't access auth.users directly
    EXISTS(SELECT 1 FROM buyers b WHERE b.profile_id = p.id) as is_buyer,
    EXISTS(SELECT 1 FROM suppliers s WHERE s.profile_id = p.id) as is_supplier,
    COALESCE(doc_count.count, 0) as document_count,
    COALESCE(chat_count.count, 0) as chat_sessions_count
  FROM profiles p
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