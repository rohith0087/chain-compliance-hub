-- Fix orphaned onboarding requests by linking them to their buyer_supplier_connections
UPDATE buyer_supplier_connections bsc
SET onboarding_request_id = sor.id
FROM supplier_onboarding_requests sor
WHERE bsc.buyer_id = sor.buyer_id
  AND bsc.supplier_id = sor.supplier_id
  AND bsc.status = 'approved'
  AND bsc.onboarding_request_id IS NULL
  AND sor.status IN ('pending', 'onboarding_initiated', 'under_review');