-- Phase 1: Update RLS policy to handle NULL branch_id for backward compatibility
-- Drop the existing policy
DROP POLICY IF EXISTS "Branch users can view branch-specific requests" ON document_requests;

-- Create updated policy that allows branch managers to see:
-- 1. Requests specifically for their branch
-- 2. Requests with NULL branch_id (legacy requests created before branch enforcement)
CREATE POLICY "Branch users can view branch-specific requests" ON document_requests
FOR SELECT USING (
  -- Company admins can see all requests (using the permission function)
  user_has_permission(auth.uid(), buyer_id, 'buyer'::text, 'manage_branches'::permission_type) OR
  
  -- Branch managers can see requests for their branch OR legacy NULL branch_id requests
  (branch_id IN (
    SELECT cu.branch_id
    FROM company_users cu
    WHERE cu.profile_id = auth.uid()
    AND cu.company_id = document_requests.buyer_id
    AND cu.company_type = 'buyer'
    AND cu.status = 'active'
    AND cu.branch_id IS NOT NULL
  )) OR
  
  -- Legacy requests with NULL branch_id are visible to all branch managers of the company
  (branch_id IS NULL AND buyer_id IN (
    SELECT cu.company_id
    FROM company_users cu
    WHERE cu.profile_id = auth.uid()
    AND cu.company_type = 'buyer'
    AND cu.status = 'active'
  )) OR
  
  -- Suppliers can see requests sent to them
  (supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  ))
);

-- Phase 2: Optional data migration - Assign NULL branch_id requests to Main Office
-- This cleans up legacy data by assigning orphaned requests to the Main Office branch
UPDATE document_requests dr
SET branch_id = (
  SELECT cb.id 
  FROM company_branches cb
  WHERE cb.company_id = dr.buyer_id
  AND cb.company_type = 'buyer'
  AND cb.branch_name = 'Main Office'
  ORDER BY cb.created_at ASC
  LIMIT 1
)
WHERE dr.branch_id IS NULL
AND EXISTS (
  SELECT 1 
  FROM company_branches cb 
  WHERE cb.company_id = dr.buyer_id 
  AND cb.company_type = 'buyer'
  AND cb.branch_name = 'Main Office'
);