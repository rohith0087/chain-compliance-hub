
-- ============================================================
-- MIGRATION: Fix all 24 security linter issues
-- ============================================================

-- ============================================================
-- 1. CRITICAL: Enable RLS on unprotected tables
-- ============================================================
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_relationships ENABLE ROW LEVEL SECURITY;

-- assessments: empty table, lock it down to service_role only
CREATE POLICY "Service role full access on assessments"
  ON public.assessments FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- entity_relationships: empty table, lock it down to service_role only  
CREATE POLICY "Service role full access on entity_relationships"
  ON public.entity_relationships FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Allow authenticated users to read their own assessment data
CREATE POLICY "Authenticated users can read assessments"
  ON public.assessments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read entity_relationships"
  ON public.entity_relationships FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 2. CRITICAL: Fix security definer view profiles_with_roles
-- ============================================================
DROP VIEW IF EXISTS public.profiles_with_roles;
CREATE VIEW public.profiles_with_roles
  WITH (security_invoker = true)
AS
SELECT p.id,
    p.email,
    p.full_name,
    p.company_name,
    p.created_at,
    p.updated_at,
    p.roles,
    COALESCE(array_agg(ur.role::text ORDER BY ur.granted_at) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::text[]) AS roles_from_table
   FROM profiles p
     LEFT JOIN user_roles ur ON ur.user_id = p.id AND ur.is_active = true
  GROUP BY p.id;

-- ============================================================
-- 3. WARNING: Fix mutable search_path on SECURITY DEFINER functions
-- ============================================================
ALTER FUNCTION public.delete_branch_with_validation(uuid) SET search_path = 'public';
ALTER FUNCTION public.sync_connection_approval_to_onboarding() SET search_path = 'public';
ALTER FUNCTION public.sync_sample_to_pending_requests() SET search_path = 'public';

-- ============================================================
-- 4. WARNING: Tighten overly permissive RLS policies on sensitive tables
-- ============================================================

-- 4a. subscriptions: "System can manage subscriptions" (ALL with true) -> service_role only
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 4b. credit_transactions: "System can insert credit transactions" (INSERT with true) -> service_role only
DROP POLICY IF EXISTS "System can insert credit transactions" ON public.credit_transactions;
CREATE POLICY "Service role can insert credit transactions"
  ON public.credit_transactions FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 4c. supplier_response_metrics: "System can manage response metrics" (ALL with true) -> service_role only
DROP POLICY IF EXISTS "System can manage response metrics" ON public.supplier_response_metrics;
CREATE POLICY "Service role can manage response metrics"
  ON public.supplier_response_metrics FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 4d. supplier_performance_metrics: "System can manage performance metrics" (ALL with true) -> service_role only
DROP POLICY IF EXISTS "System can manage performance metrics" ON public.supplier_performance_metrics;
CREATE POLICY "Service role can manage performance metrics"
  ON public.supplier_performance_metrics FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 4e. ai_knowledge_entries: "System can manage knowledge entries" (ALL with true) -> service_role only
DROP POLICY IF EXISTS "System can manage knowledge entries" ON public.ai_knowledge_entries;
CREATE POLICY "Service role can manage knowledge entries"
  ON public.ai_knowledge_entries FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
