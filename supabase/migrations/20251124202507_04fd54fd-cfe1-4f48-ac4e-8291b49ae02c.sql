-- Clean up duplicate GoPhone company created for invited user thanveshahinav06@gmail.com
-- This user should only have a company_users record linking to the REAL GoPhone, not their own buyer profile

-- Delete the duplicate company_users record (user linked to their own duplicate company)
DELETE FROM company_users 
WHERE id = '17d41d8d-58f1-4d02-a74d-eef1e80aac94'
AND profile_id = 'f9b2c01d-4690-426c-ac73-6768701000f7'
AND company_id = '4cfc00cf-de03-4c98-9b5a-8dda1beb8097';

-- Delete the duplicate Main Office branch
DELETE FROM company_branches 
WHERE id = 'a14eb9ab-78ca-4678-aaee-c539e5808be9'
AND company_id = '4cfc00cf-de03-4c98-9b5a-8dda1beb8097'
AND company_type = 'buyer';

-- Delete the duplicate GoPhone buyer profile
DELETE FROM buyers 
WHERE id = '4cfc00cf-de03-4c98-9b5a-8dda1beb8097' 
AND profile_id = 'f9b2c01d-4690-426c-ac73-6768701000f7';

-- Verify the correct company_users record still exists
-- (This is just a comment for verification - the record should remain intact)
-- SELECT * FROM company_users WHERE profile_id = 'f9b2c01d-4690-426c-ac73-6768701000f7' AND company_id = 'face0186-7da8-4262-9779-0e3b03ff70e8';