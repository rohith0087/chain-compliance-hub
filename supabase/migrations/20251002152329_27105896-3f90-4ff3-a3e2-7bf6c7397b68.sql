-- Fix NULL branch_id in document_requests by assigning to Elizabeth branch
-- Find Elizabeth branch and update NULL branch_id requests
UPDATE document_requests dr
SET branch_id = (
  SELECT cb.id
  FROM company_branches cb
  WHERE cb.company_id = dr.buyer_id
    AND cb.company_type = 'buyer'
    AND cb.branch_name = 'Elizabeth'
    AND cb.status = 'active'
  LIMIT 1
)
WHERE dr.branch_id IS NULL
  AND dr.buyer_id IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM company_branches cb 
    WHERE cb.company_id = dr.buyer_id 
      AND cb.branch_name = 'Elizabeth'
      AND cb.company_type = 'buyer'
  );