-- Drop the existing restrictive SELECT policy on document_activity_logs
DROP POLICY IF EXISTS "Users can view logs for documents they can access" ON document_activity_logs;

-- Create a new comprehensive policy that allows both company owners AND team members to view activity logs
CREATE POLICY "Users can view logs for their company documents"
ON document_activity_logs
FOR SELECT
USING (
  document_upload_id IN (
    SELECT du.id
    FROM document_uploads du
    JOIN document_requests dr ON du.request_id = dr.id
    WHERE 
      -- Buyer company owners
      dr.buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
      OR
      -- Buyer team members  
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