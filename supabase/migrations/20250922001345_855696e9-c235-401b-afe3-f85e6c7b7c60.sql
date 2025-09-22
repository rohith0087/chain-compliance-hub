-- Create or replace a platform admin users RPC that includes subscription & credits
CREATE OR REPLACE FUNCTION public.get_platform_admin_users()
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
    NULL::timestamp with time zone as last_sign_in_at,
    (EXISTS(SELECT 1 FROM buyers b WHERE b.profile_id = p.id)) as is_buyer,
    (EXISTS(SELECT 1 FROM suppliers s WHERE s.profile_id = p.id)) as is_supplier,
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
  WHERE is_platform_admin(auth.uid())
  ORDER BY p.created_at DESC;
END;
$$;