-- Clean up duplicate buyer profile and company_users record for invited team member
-- This user was incorrectly given a buyer profile when they should only have company_users record

-- Step 1: Delete the duplicate company_users record pointing to the auto-created buyer profile
DELETE FROM company_users 
WHERE profile_id = 'f9b2c01d-4690-426c-ac73-6768701000f7'
AND company_id = '633fa4a1-81b8-48cf-a7e6-a4d20c76eef8'
AND company_type = 'buyer';

-- Step 2: Delete the associated company_branches record (auto-created Main Office)
DELETE FROM company_branches
WHERE company_id = '633fa4a1-81b8-48cf-a7e6-a4d20c76eef8'
AND company_type = 'buyer';

-- Step 3: Delete the duplicate buyer profile that was incorrectly auto-created
DELETE FROM buyers 
WHERE id = '633fa4a1-81b8-48cf-a7e6-a4d20c76eef8'
AND profile_id = 'f9b2c01d-4690-426c-ac73-6768701000f7';

-- Verification: User should now only have one company_users record linking to GoPhone
-- SELECT * FROM company_users WHERE profile_id = 'f9b2c01d-4690-426c-ac73-6768701000f7';
-- Should return only: company_id = 'face0186-7da8-4262-9779-0e3b03ff70e8' (GoPhone)