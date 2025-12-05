-- Remove rzg0087@auburn.edu from suppliers table
DELETE FROM suppliers 
WHERE profile_id = '13ca0d76-f010-4a1c-9194-63ff5f32b1ef';

-- Also remove supplier role from user_roles
DELETE FROM user_roles 
WHERE user_id = '13ca0d76-f010-4a1c-9194-63ff5f32b1ef' 
AND role = 'supplier';

-- Remove any company_users records for this user
DELETE FROM company_users
WHERE profile_id = '13ca0d76-f010-4a1c-9194-63ff5f32b1ef';