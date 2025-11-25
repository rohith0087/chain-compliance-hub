-- Drop the existing restrictive SELECT policy on document_uploads
DROP POLICY IF EXISTS "Users can view uploads for their requests" ON document_uploads;

-- Create new comprehensive SELECT policy for company owners AND team members
CREATE POLICY "Users can view uploads for their company requests"
ON document_uploads
FOR SELECT
USING (
  request_id IN (
    SELECT dr.id
    FROM document_requests dr
    WHERE 
      -- Buyer company owners
      dr.buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
      OR
      -- Buyer team members (including company admins)
      dr.buyer_id IN (
        SELECT company_id FROM company_users 
        WHERE profile_id = auth.uid() 
          AND company_type = 'buyer' 
          AND status = 'active'
      )
      OR
      -- Supplier company owners
      dr.supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
      OR
      -- Supplier team members
      dr.supplier_id IN (
        SELECT company_id FROM company_users
        WHERE profile_id = auth.uid()
          AND company_type = 'supplier'
          AND status = 'active'
      )
  )
);

-- Drop the existing UPDATE policy on document_uploads
DROP POLICY IF EXISTS "Buyers can update document uploads for their requests" ON document_uploads;

-- Create new UPDATE policy that allows team members to approve/decline documents
CREATE POLICY "Buyers and team members can update document uploads"
ON document_uploads
FOR UPDATE
USING (
  request_id IN (
    SELECT dr.id
    FROM document_requests dr
    WHERE 
      -- Buyer company owners
      dr.buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
      OR
      -- Buyer team members with appropriate permissions
      dr.buyer_id IN (
        SELECT company_id FROM company_users 
        WHERE profile_id = auth.uid() 
          AND company_type = 'buyer' 
          AND status = 'active'
          AND role IN ('company_admin', 'branch_manager', 'approver', 'document_manager')
      )
  )
);