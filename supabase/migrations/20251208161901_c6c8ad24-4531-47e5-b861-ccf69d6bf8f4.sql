-- Allow connected buyers to view supplier branches for document request targeting
CREATE POLICY "Connected buyers can view supplier branches"
ON company_branches FOR SELECT
USING (
  company_type = 'supplier' 
  AND EXISTS (
    SELECT 1 FROM buyer_supplier_connections bsc
    JOIN buyers b ON b.id = bsc.buyer_id
    WHERE bsc.supplier_id = company_branches.company_id
      AND bsc.status = 'approved'
      AND (
        -- Buyer company owner
        b.profile_id = auth.uid() 
        OR 
        -- Buyer team member
        EXISTS (
          SELECT 1 FROM company_users cu 
          WHERE cu.profile_id = auth.uid() 
            AND cu.company_id = bsc.buyer_id 
            AND cu.company_type = 'buyer' 
            AND cu.status = 'active'
        )
      )
  )
);