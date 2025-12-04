-- Comprehensive fix for RLS infinite recursion between suppliers and buyer_supplier_connections tables
-- Creates security definer functions and updates all policies to use them

-- Phase 1: Create the missing security definer function for connected suppliers

-- Function to get supplier IDs from buyer_supplier_connections for the user's buyer access
CREATE OR REPLACE FUNCTION public.get_connected_supplier_ids_for_buyer()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT supplier_id 
  FROM buyer_supplier_connections 
  WHERE supplier_id IS NOT NULL 
    AND status = 'approved'
    AND buyer_id IN (SELECT public.get_user_buyer_ids());
$$;

-- Phase 2: Update buyer_supplier_connections Policies
-- Replace all direct subqueries to suppliers table with get_user_supplier_id()

-- Drop existing policies that have recursion issues
DROP POLICY IF EXISTS "Buyers and team members can view connections" ON buyer_supplier_connections;
DROP POLICY IF EXISTS "Buyers and team members can update connections" ON buyer_supplier_connections;
DROP POLICY IF EXISTS "Suppliers can view connections to them" ON buyer_supplier_connections;
DROP POLICY IF EXISTS "Suppliers can update connection status" ON buyer_supplier_connections;
DROP POLICY IF EXISTS "Buyers and team members can create connections" ON buyer_supplier_connections;

-- Recreate buyer_supplier_connections policies using security definer functions
CREATE POLICY "Buyers and team members can view connections" ON buyer_supplier_connections
FOR SELECT USING (
  buyer_id IN (SELECT public.get_user_buyer_ids())
  OR supplier_id = public.get_user_supplier_id()
);

CREATE POLICY "Buyers and team members can create connections" ON buyer_supplier_connections
FOR INSERT WITH CHECK (
  buyer_id IN (SELECT public.get_user_buyer_ids())
);

CREATE POLICY "Buyers and team members can update connections" ON buyer_supplier_connections
FOR UPDATE USING (
  buyer_id IN (SELECT public.get_user_buyer_ids())
  OR supplier_id = public.get_user_supplier_id()
);

CREATE POLICY "Suppliers can view connections to them" ON buyer_supplier_connections
FOR SELECT USING (
  supplier_id = public.get_user_supplier_id()
);

CREATE POLICY "Suppliers can update connection status" ON buyer_supplier_connections
FOR UPDATE USING (
  supplier_id = public.get_user_supplier_id()
);

-- Phase 3: Update suppliers Table Policies
-- Replace all direct subqueries to buyer_supplier_connections with get_connected_supplier_ids_for_buyer()

-- Drop existing policies that have recursion issues
DROP POLICY IF EXISTS "Buyers can view connected suppliers" ON suppliers;
DROP POLICY IF EXISTS "Buyer team members can view connected suppliers" ON suppliers;

-- Recreate suppliers policies using security definer function
CREATE POLICY "Buyers can view connected suppliers" ON suppliers
FOR SELECT TO authenticated USING (
  id IN (SELECT public.get_connected_supplier_ids_for_buyer())
);

-- Note: Buyer team members are now covered by get_connected_supplier_ids_for_buyer() 
-- which already includes team member access via get_user_buyer_ids()