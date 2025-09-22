-- Drop existing function and recreate with enhanced subscription data
DROP FUNCTION IF EXISTS get_all_users_detailed();

CREATE OR REPLACE FUNCTION get_all_users_detailed()
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
  -- Subscription fields
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
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.roles,
    p.company_name,
    p.created_at,
    p.last_sign_in_at,
    COALESCE(buyer_check.is_buyer, false) as is_buyer,
    COALESCE(supplier_check.is_supplier, false) as is_supplier,
    COALESCE(doc_stats.document_count, 0) as document_count,
    COALESCE(chat_stats.chat_sessions_count, 0) as chat_sessions_count,
    -- Subscription information
    COALESCE(s.status, 'none') as subscription_status,
    COALESCE(s.plan_type::text, 'none') as subscription_plan_type,
    s.current_period_end as subscription_end_date,
    COALESCE(uc.available_credits, 0) as available_credits,
    COALESCE(uc.total_purchased_credits, 0) as total_purchased_credits,
    COALESCE(uc.total_consumed_credits, 0) as total_consumed_credits,
    s.stripe_customer_id,
    s.stripe_subscription_id
  FROM profiles p
  LEFT JOIN (
    SELECT profile_id, true as is_buyer
    FROM buyers
  ) buyer_check ON p.id = buyer_check.profile_id
  LEFT JOIN (
    SELECT profile_id, true as is_supplier
    FROM suppliers
  ) supplier_check ON p.id = supplier_check.profile_id
  LEFT JOIN (
    SELECT 
      requester_id as user_id,
      COUNT(*) as document_count
    FROM document_requests
    GROUP BY requester_id
  ) doc_stats ON p.id = doc_stats.user_id
  LEFT JOIN (
    SELECT 
      user_id,
      COUNT(*) as chat_sessions_count
    FROM chat_sessions
    GROUP BY user_id
  ) chat_stats ON p.id = chat_stats.user_id
  LEFT JOIN subscriptions s ON p.id = s.user_id
  LEFT JOIN user_credits uc ON p.id = uc.user_id
  WHERE is_super_admin(auth.uid())
  ORDER BY p.created_at DESC;
END;
$function$;