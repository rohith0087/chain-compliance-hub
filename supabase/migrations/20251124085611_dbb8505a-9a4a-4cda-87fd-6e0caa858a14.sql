-- Migration: Fix RLS policies for team member access
-- This allows team members to access their company's data through company_users linkage

-- ============================================
-- 1. BUYERS TABLE - Add team member view access
-- ============================================

-- Drop old restrictive policy
DROP POLICY IF EXISTS "Users can view their own buyer profile" ON buyers;

-- Create new policy supporting both owners and team members
CREATE POLICY "Buyers and team members can view company profile"
ON buyers FOR SELECT
TO authenticated
USING (
  -- Company owners can see their own profile
  profile_id = auth.uid()
  OR
  -- Team members can see their company's profile
  id IN (
    SELECT company_id 
    FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
  )
);

-- ============================================
-- 2. BUYER_SUPPLIER_CONNECTIONS TABLE
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Buyers can view their own connections" ON buyer_supplier_connections;
DROP POLICY IF EXISTS "Buyers can create connection requests" ON buyer_supplier_connections;
DROP POLICY IF EXISTS "Buyers can update connection requests sent to them" ON buyer_supplier_connections;

-- SELECT policy: View connections
CREATE POLICY "Buyers and team members can view connections"
ON buyer_supplier_connections FOR SELECT
TO authenticated
USING (
  -- Company owners
  buyer_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  )
  OR
  -- Team members
  buyer_id IN (
    SELECT company_id 
    FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
  )
  OR
  -- Suppliers can view connections to them
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

-- INSERT policy: Create connections
CREATE POLICY "Buyers and team members can create connections"
ON buyer_supplier_connections FOR INSERT
TO authenticated
WITH CHECK (
  buyer_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  )
  OR
  buyer_id IN (
    SELECT company_id 
    FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
  )
);

-- UPDATE policy: Update connections
CREATE POLICY "Buyers and team members can update connections"
ON buyer_supplier_connections FOR UPDATE
TO authenticated
USING (
  buyer_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  )
  OR
  buyer_id IN (
    SELECT company_id 
    FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
  )
  OR
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

-- ============================================
-- 3. DOCUMENT_REQUESTS TABLE - INSERT policy
-- ============================================

-- Drop old policy
DROP POLICY IF EXISTS "Buyers can create document requests" ON document_requests;

-- Create new policy supporting team members
CREATE POLICY "Buyers and team members can create document requests"
ON document_requests FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be owner or team member of the buyer company
  (
    buyer_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
    )
    OR
    buyer_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE profile_id = auth.uid() 
      AND company_type = 'buyer' 
      AND status = 'active'
    )
  )
  AND 
  -- Can only create requests for approved supplier connections
  supplier_id IN (
    SELECT supplier_id
    FROM buyer_supplier_connections
    WHERE buyer_id IN (
      -- Company owners
      SELECT id FROM buyers WHERE profile_id = auth.uid()
      UNION
      -- Team members
      SELECT company_id 
      FROM company_users 
      WHERE profile_id = auth.uid() 
      AND company_type = 'buyer' 
      AND status = 'active'
    )
    AND status = 'approved'
  )
);

-- ============================================
-- 4. BRANCH_SUPPLIER_CONNECTIONS TABLE
-- ============================================

-- Drop old policy
DROP POLICY IF EXISTS "Company admins can manage branch supplier connections" ON branch_supplier_connections;

-- SELECT policy: View branch connections
CREATE POLICY "Users can view accessible branch connections"
ON branch_supplier_connections FOR SELECT
TO authenticated
USING (
  -- Company admins see all branches
  EXISTS (
    SELECT 1 FROM company_users cu
    JOIN company_branches cb ON cb.company_id = cu.company_id AND cb.company_type = cu.company_type
    WHERE cu.profile_id = auth.uid()
    AND cb.id = branch_supplier_connections.branch_id
    AND cu.role = 'company_admin'
    AND cu.status = 'active'
  )
  OR
  -- Branch users see their own branch
  EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.profile_id = auth.uid()
    AND cu.branch_id = branch_supplier_connections.branch_id
    AND cu.status = 'active'
  )
);

-- INSERT/UPDATE/DELETE policy: Manage branch connections
CREATE POLICY "Company admins can manage branch connections"
ON branch_supplier_connections FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_users cu
    JOIN company_branches cb ON cb.company_id = cu.company_id AND cb.company_type = cu.company_type
    WHERE cu.profile_id = auth.uid()
    AND cb.id = branch_supplier_connections.branch_id
    AND cu.role = 'company_admin'
    AND cu.status = 'active'
  )
);