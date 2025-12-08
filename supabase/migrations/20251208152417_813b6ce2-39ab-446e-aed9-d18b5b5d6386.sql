-- Add buyer role to user_roles table for pfontano@debelfoods.com
INSERT INTO user_roles (user_id, role)
VALUES ('a9e7e7c2-dcf7-430c-a187-a6d708dd2866', 'buyer')
ON CONFLICT (user_id, role) DO NOTHING;

-- Update profiles.roles array to include buyer
UPDATE profiles 
SET roles = array_append(roles, 'buyer')
WHERE id = 'a9e7e7c2-dcf7-430c-a187-a6d708dd2866'
AND NOT ('buyer' = ANY(roles));