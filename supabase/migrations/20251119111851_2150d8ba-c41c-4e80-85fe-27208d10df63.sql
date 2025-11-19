-- Backfill orphaned document_requests with Elizabeth branch
-- This migration assigns all document requests without a branch_id
-- to the Elizabeth branch for Hisshosushi buyer

UPDATE document_requests
SET 
  branch_id = 'e6a8c912-acb7-40a1-a930-6c2e1e86bac9',
  updated_at = now()
WHERE 
  branch_id IS NULL 
  AND buyer_id = 'f4fda06c-82d3-43bb-8b53-7d81a9974d18';

-- Add a comment for tracking
COMMENT ON TABLE document_requests IS 'Document requests - backfilled orphaned records to Elizabeth branch on 2025-11-19';