-- Add branch-aware RLS policy for document_requests table
-- This ensures branch managers can only see their branch's documents at the database level

CREATE POLICY "Branch users can view branch-specific requests"
ON document_requests
FOR SELECT
USING (
  -- Company admins can see ALL requests for their company
  user_has_permission(auth.uid(), buyer_id, 'buyer', 'manage_branches'::permission_type)
  OR
  -- Branch managers/users can ONLY see their branch's requests
  (
    branch_id IN (
      SELECT cu.branch_id
      FROM company_users cu
      WHERE cu.profile_id = auth.uid()
        AND cu.company_id = document_requests.buyer_id
        AND cu.company_type = 'buyer'
        AND cu.status = 'active'
        AND cu.branch_id IS NOT NULL
    )
  )
  OR
  -- Suppliers can see requests sent to them (unchanged)
  (
    supplier_id IN (
      SELECT s.id
      FROM suppliers s
      WHERE s.profile_id = auth.uid()
    )
  )
);

-- Add helpful comment
COMMENT ON POLICY "Branch users can view branch-specific requests" ON document_requests IS 
'Enforces branch-level access control: company admins see all requests, branch managers see only their branch requests, suppliers see requests sent to them';