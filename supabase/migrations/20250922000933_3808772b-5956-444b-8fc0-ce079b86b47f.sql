-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.get_all_users_detailed();

-- Create the corrected get_all_users_detailed function
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
  chat_sessions_count bigint,
  subscription_status text,
  subscription_plan_type text,
  subscription_end_date timestamp with time zone,
  available_credits integer,
  total_purchased_credits integer,
  total_consumed_credits integer,
  stripe_customer_id text,
  stripe_subscription_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.roles,
    p.company_name,
    p.created_at,
    NULL::timestamp with time zone as last_sign_in_at, -- Placeholder since auth.users access is restricted
    (EXISTS(SELECT 1 FROM buyers b WHERE b.profile_id = p.id)) as is_buyer,
    (EXISTS(SELECT 1 FROM suppliers s WHERE s.profile_id = p.id)) as is_supplier,
    COALESCE(doc_count.total, 0) as document_count,
    COALESCE(chat_count.total, 0) as chat_sessions_count,
    COALESCE(s.status, 'none') as subscription_status,
    COALESCE(s.plan_type::text, 'free') as subscription_plan_type,
    s.current_period_end as subscription_end_date,
    COALESCE(uc.available_credits, 0) as available_credits,
    COALESCE(uc.total_purchased_credits, 0) as total_purchased_credits,
    COALESCE(uc.total_consumed_credits, 0) as total_consumed_credits,
    s.stripe_customer_id,
    s.stripe_subscription_id
  FROM profiles p
  LEFT JOIN subscriptions s ON s.user_id = p.id
  LEFT JOIN user_credits uc ON uc.user_id = p.id
  LEFT JOIN (
    SELECT 
      du.uploader_id as user_id,
      COUNT(*) as total
    FROM document_uploads du
    WHERE du.uploader_id IS NOT NULL
    GROUP BY du.uploader_id
  ) doc_count ON doc_count.user_id = p.id
  LEFT JOIN (
    SELECT 
      cs.user_id,
      COUNT(*) as total
    FROM chat_sessions cs
    GROUP BY cs.user_id
  ) chat_count ON chat_count.user_id = p.id
  WHERE is_super_admin(auth.uid())
  ORDER BY p.created_at DESC;
END;
$$;