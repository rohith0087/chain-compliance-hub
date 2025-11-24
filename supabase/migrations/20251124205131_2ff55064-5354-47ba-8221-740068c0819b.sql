-- Clean up duplicate buyer profile and company_users record for rzg0087@auburn.edu
-- This user was incorrectly given a buyer profile when they should only have company_users record

-- Step 1: Delete the duplicate company_users record pointing to the auto-created buyer profile
DELETE FROM company_users 
WHERE company_id = 'f1283a3e-9576-45b5-8876-f94084284644'
AND company_type = 'buyer';

-- Step 2: Delete the associated company_branches record (auto-created Main Office)
DELETE FROM company_branches
WHERE company_id = 'f1283a3e-9576-45b5-8876-f94084284644'
AND company_type = 'buyer';

-- Step 3: Delete the duplicate buyer profile that was incorrectly auto-created
DELETE FROM buyers 
WHERE id = 'f1283a3e-9576-45b5-8876-f94084284644';

-- Verification: User should now only have one company_users record linking to GoPhone
-- SELECT * FROM company_users WHERE profile_id = (SELECT id FROM profiles WHERE email = 'rzg0087@auburn.edu');
-- Should return only: company_id = 'face0186-7da8-4262-9779-0e3b03ff70e8' (GoPhone)