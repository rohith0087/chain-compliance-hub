DROP FUNCTION IF EXISTS public.get_platform_admin_users();

CREATE FUNCTION public.get_platform_admin_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  roles text[],
  company_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_buyer boolean,
  is_supplier boolean,
  subscription_status text,
  subscription_plan_type text,
  subscription_end_date timestamptz,
  available_credits integer,
  total_purchased_credits integer,
  total_consumed_credits integer,
  stripe_customer_id text,
  stripe_subscription_id text,
  buyer_id uuid,
  supplier_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is a platform admin with super_admin role
  IF NOT EXISTS (
    SELECT 1 FROM platform_administrators
    WHERE auth_user_id = auth.uid()
    AND is_active = true
    AND 'super_admin' = ANY(platform_roles)
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    COALESCE(
      (SELECT array_agg(DISTINCT ur.role::text) FROM user_roles ur WHERE ur.user_id = p.id),
      ARRAY[]::text[]
    ) as roles,
    COALESCE(
      (SELECT b.company_name FROM buyers b WHERE b.profile_id = p.id LIMIT 1),
      (SELECT s.company_name FROM suppliers s WHERE s.profile_id = p.id LIMIT 1),
      p.company_name
    ) as company_name,
    p.created_at,
    (SELECT au.last_sign_in_at FROM auth.users au WHERE au.id = p.id) as last_sign_in_at,
    EXISTS(SELECT 1 FROM buyers b WHERE b.profile_id = p.id) as is_buyer,
    EXISTS(SELECT 1 FROM suppliers s WHERE s.profile_id = p.id) as is_supplier,
    sub.status as subscription_status,
    sub.plan_type::text as subscription_plan_type,
    sub.current_period_end as subscription_end_date,
    uc.available_credits,
    uc.total_purchased_credits,
    uc.total_consumed_credits,
    sub.stripe_customer_id,
    sub.stripe_subscription_id,
    (SELECT b.id FROM buyers b WHERE b.profile_id = p.id LIMIT 1) as buyer_id,
    (SELECT s.id FROM suppliers s WHERE s.profile_id = p.id LIMIT 1) as supplier_id
  FROM profiles p
  LEFT JOIN subscriptions sub ON sub.user_id = p.id
  LEFT JOIN user_credits uc ON uc.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;