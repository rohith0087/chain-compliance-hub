-- First, update buyer_supplier_connections to point to the most recent onboarding request for each duplicate group
WITH duplicates AS (
  SELECT 
    id,
    buyer_id,
    LOWER(supplier_email) as email_normalized,
    ROW_NUMBER() OVER (
      PARTITION BY buyer_id, LOWER(supplier_email) 
      ORDER BY created_at DESC
    ) as row_num
  FROM supplier_onboarding_requests
  WHERE status IN ('invited', 'pending', 'requested', 'under_review')
),
keep_records AS (
  SELECT id, buyer_id, email_normalized FROM duplicates WHERE row_num = 1
),
delete_records AS (
  SELECT d.id as old_id, k.id as new_id
  FROM duplicates d
  JOIN keep_records k ON d.buyer_id = k.buyer_id AND d.email_normalized = k.email_normalized
  WHERE d.row_num > 1
)
UPDATE buyer_supplier_connections bsc
SET onboarding_request_id = dr.new_id
FROM delete_records dr
WHERE bsc.onboarding_request_id = dr.old_id;

-- Now delete the duplicate onboarding requests
DELETE FROM supplier_onboarding_requests
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY buyer_id, LOWER(supplier_email) 
        ORDER BY created_at DESC
      ) as row_num
    FROM supplier_onboarding_requests
    WHERE status IN ('invited', 'pending', 'requested', 'under_review')
  ) ranked
  WHERE row_num > 1
);