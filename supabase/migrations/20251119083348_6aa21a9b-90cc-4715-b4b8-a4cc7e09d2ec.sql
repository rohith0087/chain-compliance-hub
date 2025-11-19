-- Add performance indexes for supplier onboarding lookups

-- Index for faster lookups of active onboarding requests by supplier and buyer
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_supplier_buyer_status 
ON supplier_onboarding_requests(supplier_id, buyer_id, status)
WHERE status IN ('pending', 'requested', 'onboarding_initiated', 'under_review');

-- Index for faster lookups of approved buyer-supplier connections
CREATE INDEX IF NOT EXISTS idx_buyer_supplier_connections_buyer_status 
ON buyer_supplier_connections(buyer_id, status)
WHERE status = 'approved';

-- Index for faster lookups of onboarding requests by buyer and status
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_buyer_status 
ON supplier_onboarding_requests(buyer_id, status);