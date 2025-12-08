-- Set branch_id to NULL for rohithgummadi3@gmail.com (company admin should have all-branch access)
UPDATE company_users 
SET branch_id = NULL 
WHERE id = 'c8fcd040-4eee-4d66-a9aa-783482371fee';