-- Clean up duplicate GoPhone company (a629e382-4157-495b-bcc6-a19a7ab28859)
-- The real GoPhone company is face0186-7da8-4262-9779-0e3b03ff70e8

-- First, check and migrate any users from duplicate company to the real one
-- (This is defensive - in case there are any users linked to the duplicate)
UPDATE company_users 
SET company_id = 'face0186-7da8-4262-9779-0e3b03ff70e8'
WHERE company_id = 'a629e382-4157-495b-bcc6-a19a7ab28859'
AND profile_id NOT IN (
  SELECT profile_id FROM company_users 
  WHERE company_id = 'face0186-7da8-4262-9779-0e3b03ff70e8'
);

-- Delete any duplicate company_users records that would violate uniqueness
DELETE FROM company_users 
WHERE company_id = 'a629e382-4157-495b-bcc6-a19a7ab28859';

-- Delete branches for the duplicate company
DELETE FROM company_branches 
WHERE company_id = 'a629e382-4157-495b-bcc6-a19a7ab28859'
AND company_type = 'buyer';

-- Delete the duplicate GoPhone buyer profile
DELETE FROM buyers 
WHERE id = 'a629e382-4157-495b-bcc6-a19a7ab28859';

-- Verify the real GoPhone company is intact (this will show in logs)
-- SELECT 
--   b.id, 
--   b.company_name, 
--   COUNT(DISTINCT cb.id) as branch_count,
--   COUNT(DISTINCT cu.id) as user_count
-- FROM buyers b
-- LEFT JOIN company_branches cb ON cb.company_id = b.id AND cb.company_type = 'buyer'
-- LEFT JOIN company_users cu ON cu.company_id = b.id AND cu.company_type = 'buyer'
-- WHERE b.id = 'face0186-7da8-4262-9779-0e3b03ff70e8'
-- GROUP BY b.id, b.company_name;