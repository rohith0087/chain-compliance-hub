-- Fix RLS infinite recursion between suppliers and supplier_onboarding_requests tables
-- by using security definer functions instead of cross-table subqueries

-- Phase 1: Create Security Definer Functions

-- Function to get the current user's supplier ID (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_supplier_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM suppliers WHERE profile_id = auth.uid() LIMIT 1;
$$;

-- Function to get all buyer IDs the current user has access to (owner or team member)
CREATE OR REPLACE FUNCTION public.get_user_buyer_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM buyers WHERE profile_id = auth.uid()
  UNION
  SELECT company_id FROM company_users 
  WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active';
$$;

-- Function to get supplier IDs from onboarding requests for the user's buyer access
CREATE OR REPLACE FUNCTION public.get_onboarding_supplier_ids_for_buyer()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT supplier_id 
  FROM supplier_onboarding_requests 
  WHERE supplier_id IS NOT NULL 
    AND buyer_id IN (SELECT public.get_user_buyer_ids());
$$;

-- Phase 2: Update supplier_onboarding_requests Policies

-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Suppliers can view requests for them" ON supplier_onboarding_requests;
DROP POLICY IF EXISTS "Suppliers can update their onboarding status" ON supplier_onboarding_requests;

-- Recreate policies using security definer functions instead of subqueries
CREATE POLICY "Suppliers can view requests for them" ON supplier_onboarding_requests
FOR SELECT USING (
  supplier_id = public.get_user_supplier_id() 
  OR supplier_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Suppliers can update their onboarding status" ON supplier_onboarding_requests
FOR UPDATE USING (
  supplier_id = public.get_user_supplier_id() 
  OR supplier_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Phase 3: Update suppliers Table Policies

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Buyers can view suppliers in onboarding" ON suppliers;

-- Recreate using security definer function
CREATE POLICY "Buyers can view suppliers in onboarding" ON suppliers
FOR SELECT TO authenticated USING (
  id IN (SELECT public.get_onboarding_supplier_ids_for_buyer())
);