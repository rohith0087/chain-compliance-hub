-- Clean up duplicate records for rcrohith017@gmail.com
-- This user was incorrectly auto-created a buyer profile despite being an invited team member

-- Delete the duplicate company_users record (keep the invited one)
DELETE FROM company_users 
WHERE id = '485b21c4-fca0-4519-8b9a-0ece25392cf5';

-- Delete the associated auto-created branch
DELETE FROM company_branches
WHERE id = '2d8589c6-f16c-4fed-89bf-df5036c4bbe2';

-- Delete the auto-created buyer profile (keep only the company_users membership)
DELETE FROM buyers 
WHERE id = 'c35ec147-a827-454c-9fe6-60fedade18bc';