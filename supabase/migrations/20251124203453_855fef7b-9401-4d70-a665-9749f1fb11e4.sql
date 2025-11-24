-- Set branch_id to NULL for all company_admin users
-- This gives company admins access to all branches in their company
-- instead of restricting them to a single branch

UPDATE company_users 
SET branch_id = NULL
WHERE role = 'company_admin'
AND branch_id IS NOT NULL;

-- Add comment explaining the logic
COMMENT ON COLUMN company_users.branch_id IS 
'Branch assignment for the user. NULL means user has access to all branches (typically company_admin role). Non-NULL restricts user to specific branch (branch_manager, document_manager, etc.)';