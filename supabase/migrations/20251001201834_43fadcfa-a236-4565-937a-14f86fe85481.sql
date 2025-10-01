-- Migration to fix NULL branch_id values in document_requests
-- This will assign document requests to the first available branch for their buyer

-- Update document_requests with NULL branch_id to use the first branch of the buyer
UPDATE document_requests dr
SET branch_id = (
  SELECT cb.id
  FROM company_branches cb
  WHERE cb.company_id = dr.buyer_id
    AND cb.company_type = 'buyer'
    AND cb.status = 'active'
  ORDER BY cb.created_at ASC
  LIMIT 1
)
WHERE dr.branch_id IS NULL
  AND dr.buyer_id IS NOT NULL;

-- Add a comment to track this migration
COMMENT ON COLUMN document_requests.branch_id IS 'References the branch this request belongs to. Updated to assign NULL values to first available branch.';