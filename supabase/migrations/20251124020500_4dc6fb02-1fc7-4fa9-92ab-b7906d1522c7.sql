-- Clean up orphaned company_users records before adding constraint
DELETE FROM company_users 
WHERE invitation_token IS NOT NULL 
AND invitation_token NOT IN (SELECT token FROM user_invitations);

-- Now add the foreign key constraint
ALTER TABLE company_users
DROP CONSTRAINT IF EXISTS company_users_invitation_token_fkey;

ALTER TABLE company_users
ADD CONSTRAINT company_users_invitation_token_fkey
FOREIGN KEY (invitation_token) 
REFERENCES user_invitations(token)
ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_company_users_invitation_token ON company_users(invitation_token);