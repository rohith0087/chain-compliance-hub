-- Drop the duplicate/conflicting RLS policy on company_branches
DROP POLICY IF EXISTS "Company admins can manage branches" ON company_branches;

-- Verify the remaining comprehensive policy exists and is correct
-- This policy handles both company admins (via user_has_permission) and owners (via buyers/suppliers checks)
-- Policy: "Company admins or owners can manage branches" should remain active