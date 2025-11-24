-- Cleanup migration for rohithgummadi3@gmail.com who was incorrectly assigned supplier role
-- This user was invited to a buyer company but got supplier role due to the trigger bug

-- 1. Fix profiles.roles array
UPDATE profiles
SET roles = ARRAY['buyer']::user_role[]
WHERE email = 'rohithgummadi3@gmail.com';

-- 2. Fix user_roles table - remove incorrect supplier role
DELETE FROM user_roles
WHERE user_id = (SELECT id FROM profiles WHERE email = 'rohithgummadi3@gmail.com')
  AND role = 'supplier';

-- 3. Add correct buyer role to user_roles table
INSERT INTO user_roles (user_id, role, granted_by, granted_at)
SELECT 
  p.id,
  'buyer'::app_role,
  p.id,
  now()
FROM profiles p
WHERE p.email = 'rohithgummadi3@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Delete the incorrectly created supplier profile (if exists)
-- This will CASCADE delete related records
DELETE FROM suppliers
WHERE profile_id = (SELECT id FROM profiles WHERE email = 'rohithgummadi3@gmail.com');