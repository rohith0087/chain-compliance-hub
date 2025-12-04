-- =====================================================
-- CRITICAL SECURITY FIX: RLS Policy Gaps
-- Fix dangerous open policies on user_credits and suppliers
-- =====================================================

-- =====================================================
-- PHASE 1: Fix user_credits table RLS
-- =====================================================

-- Drop the dangerous "System can manage user credits" policy that allows ANY authenticated user full access
DROP POLICY IF EXISTS "System can manage user credits" ON user_credits;

-- Create restrictive policy: Users can ONLY view their own credits
CREATE POLICY "Users can view own credits only"
ON user_credits FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies for regular users
-- All credit modifications MUST go through edge functions using service_role_key
-- This is the correct pattern - credit operations are privileged

-- =====================================================
-- PHASE 2: Fix suppliers table RLS
-- =====================================================

-- Drop the dangerous open policy that exposes ALL supplier data to ANY authenticated user
DROP POLICY IF EXISTS "Users can view suppliers" ON suppliers;

-- Policy 1: Supplier owners can view/manage their own profile (keep existing if present, or create)
DROP POLICY IF EXISTS "Suppliers can view own profile" ON suppliers;
CREATE POLICY "Suppliers can view own profile"
ON suppliers FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Policy 2: Connected buyers (owners) can view suppliers they're connected to
DROP POLICY IF EXISTS "Buyers can view connected suppliers" ON suppliers;
CREATE POLICY "Buyers can view connected suppliers"
ON suppliers FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT bsc.supplier_id 
    FROM buyer_supplier_connections bsc
    WHERE bsc.buyer_id IN (
      SELECT b.id FROM buyers b WHERE b.profile_id = auth.uid()
    )
  )
);

-- Policy 3: Buyer team members can view suppliers connected to their company
DROP POLICY IF EXISTS "Buyer team members can view connected suppliers" ON suppliers;
CREATE POLICY "Buyer team members can view connected suppliers"
ON suppliers FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT bsc.supplier_id 
    FROM buyer_supplier_connections bsc
    WHERE bsc.buyer_id IN (
      SELECT cu.company_id 
      FROM company_users cu 
      WHERE cu.profile_id = auth.uid() 
      AND cu.company_type = 'buyer' 
      AND cu.status = 'active'
    )
  )
);

-- Policy 4: Buyers can view suppliers in their onboarding requests
DROP POLICY IF EXISTS "Buyers can view suppliers in onboarding" ON suppliers;
CREATE POLICY "Buyers can view suppliers in onboarding"
ON suppliers FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT sor.supplier_id 
    FROM supplier_onboarding_requests sor
    WHERE sor.supplier_id IS NOT NULL
    AND sor.buyer_id IN (
      SELECT b.id FROM buyers b WHERE b.profile_id = auth.uid()
      UNION
      SELECT cu.company_id 
      FROM company_users cu 
      WHERE cu.profile_id = auth.uid() 
      AND cu.company_type = 'buyer' 
      AND cu.status = 'active'
    )
  )
);

-- =====================================================
-- PHASE 3: Create Security Definer Function for Safe Supplier Discovery
-- Returns only non-sensitive fields for discovery purposes
-- =====================================================

CREATE OR REPLACE FUNCTION public.search_suppliers_for_discovery(
  p_search_query TEXT DEFAULT '',
  p_industry_filter TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  company_name TEXT,
  industry TEXT,
  company_logo_url TEXT
  -- Deliberately excludes: contact_email, phone, address (PII)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return suppliers not already connected to the requesting buyer
  RETURN QUERY
  SELECT 
    s.id,
    s.company_name,
    s.industry,
    s.company_logo_url
  FROM suppliers s
  WHERE (
    p_search_query = '' 
    OR s.company_name ILIKE '%' || p_search_query || '%'
    OR s.industry ILIKE '%' || p_search_query || '%'
  )
  AND (p_industry_filter IS NULL OR s.industry = p_industry_filter)
  -- Exclude suppliers already connected to requesting user's buyer company
  AND s.id NOT IN (
    SELECT bsc.supplier_id 
    FROM buyer_supplier_connections bsc
    WHERE bsc.buyer_id IN (
      SELECT b.id FROM buyers b WHERE b.profile_id = auth.uid()
      UNION
      SELECT cu.company_id 
      FROM company_users cu 
      WHERE cu.profile_id = auth.uid() 
      AND cu.company_type = 'buyer' 
      AND cu.status = 'active'
    )
    AND bsc.status IN ('approved', 'pending')
  )
  ORDER BY s.company_name
  LIMIT p_limit;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.search_suppliers_for_discovery TO authenticated;