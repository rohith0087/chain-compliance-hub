-- Add supplier_branch_id column to document_requests table
-- This allows buyers to target specific supplier branches when sending document requests

ALTER TABLE document_requests 
ADD COLUMN supplier_branch_id UUID REFERENCES company_branches(id);

-- Create index for efficient querying
CREATE INDEX idx_document_requests_supplier_branch 
ON document_requests(supplier_branch_id);

-- Add comment for clarity
COMMENT ON COLUMN document_requests.supplier_branch_id IS 'Target supplier branch for this document request. NULL means all branches or supplier has no branches.';