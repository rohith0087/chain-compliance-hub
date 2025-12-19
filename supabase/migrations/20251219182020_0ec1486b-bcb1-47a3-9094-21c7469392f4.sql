-- Fix document_sets RLS policies to allow company team members (not just owner)
-- This fixes the issue where company_admin users like Kailyn couldn't create document sets

-- Step 1: Drop existing restrictive policies (including any that may have been partially created)
DROP POLICY IF EXISTS "Buyers can view their document sets" ON document_sets;
DROP POLICY IF EXISTS "Buyers can create document sets" ON document_sets;
DROP POLICY IF EXISTS "Buyers can update their document sets" ON document_sets;
DROP POLICY IF EXISTS "Buyers can delete their document sets" ON document_sets;
DROP POLICY IF EXISTS "Buyers and team can view document sets" ON document_sets;
DROP POLICY IF EXISTS "Buyers and admins can create document sets" ON document_sets;
DROP POLICY IF EXISTS "Buyers and admins can update document sets" ON document_sets;
DROP POLICY IF EXISTS "Buyers and admins can delete document sets" ON document_sets;

-- Step 2: Create new policies that include company team members

-- SELECT: Allow owner OR any active company team member
CREATE POLICY "Buyers and team can view document sets" ON document_sets
  FOR SELECT USING (
    buyer_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
      UNION
      SELECT company_id FROM company_users 
      WHERE profile_id = auth.uid() 
        AND company_type = 'buyer' 
        AND status = 'active'
    )
  );

-- INSERT: Allow owner OR company_admin/document_manager team members
CREATE POLICY "Buyers and admins can create document sets" ON document_sets
  FOR INSERT WITH CHECK (
    buyer_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
      UNION
      SELECT company_id FROM company_users 
      WHERE profile_id = auth.uid() 
        AND company_type = 'buyer' 
        AND status = 'active'
        AND role IN ('company_admin', 'document_manager', 'approver')
    )
    AND created_by = auth.uid()
  );

-- UPDATE: Allow owner OR company_admin/document_manager team members
CREATE POLICY "Buyers and admins can update document sets" ON document_sets
  FOR UPDATE USING (
    buyer_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
      UNION
      SELECT company_id FROM company_users 
      WHERE profile_id = auth.uid() 
        AND company_type = 'buyer' 
        AND status = 'active'
        AND role IN ('company_admin', 'document_manager', 'approver')
    )
  );

-- DELETE: Allow owner OR company_admin/document_manager team members
CREATE POLICY "Buyers and admins can delete document sets" ON document_sets
  FOR DELETE USING (
    buyer_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
      UNION
      SELECT company_id FROM company_users 
      WHERE profile_id = auth.uid() 
        AND company_type = 'buyer' 
        AND status = 'active'
        AND role IN ('company_admin', 'document_manager', 'approver')
    )
  );