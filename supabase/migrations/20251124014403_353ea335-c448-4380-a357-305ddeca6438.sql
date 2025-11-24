-- Phase 3: Database Schema Migration for User Invitation System

-- 1. Convert invited_by from TEXT to UUID in user_invitations table
-- First add the new UUID column
ALTER TABLE user_invitations 
  ADD COLUMN IF NOT EXISTS invited_by_uuid UUID;

-- 2. Try to match text emails to profile UUIDs (migrate existing data)
UPDATE user_invitations ui
SET invited_by_uuid = p.id
FROM profiles p
WHERE ui.invited_by = p.email
  AND ui.invited_by_uuid IS NULL;

-- 3. Drop old column and rename new one
ALTER TABLE user_invitations 
  DROP COLUMN IF EXISTS invited_by;

ALTER TABLE user_invitations 
  RENAME COLUMN invited_by_uuid TO invited_by;

-- 4. Add foreign key constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_invitations_invited_by_fkey'
  ) THEN
    ALTER TABLE user_invitations
      ADD CONSTRAINT user_invitations_invited_by_fkey 
      FOREIGN KEY (invited_by) 
      REFERENCES profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Backfill company_users.invited_by from user_invitations using invitation_token
UPDATE company_users cu
SET invited_by = ui.invited_by
FROM user_invitations ui
WHERE cu.invitation_token = ui.token
  AND cu.invited_by IS NULL
  AND ui.invited_by IS NOT NULL;

-- 6. Add index on user_invitations.token for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_invitations_token 
  ON user_invitations(token);

-- 7. Add index on company_users.invitation_token for faster joins
CREATE INDEX IF NOT EXISTS idx_company_users_invitation_token 
  ON company_users(invitation_token);

-- 8. Add comment explaining the data model
COMMENT ON COLUMN user_invitations.invited_by IS 'UUID reference to the profile that sent the invitation';
COMMENT ON COLUMN company_users.invited_by IS 'UUID reference to the profile that invited this user to the company';