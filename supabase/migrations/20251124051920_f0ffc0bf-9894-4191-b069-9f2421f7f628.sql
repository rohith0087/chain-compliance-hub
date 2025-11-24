-- Add company_name column to user_invitations table for easier access without RLS issues
ALTER TABLE user_invitations
ADD COLUMN company_name TEXT;

-- Add comment explaining the denormalization
COMMENT ON COLUMN user_invitations.company_name IS 'Denormalized company name for display on invitation pages without requiring authenticated access to buyers/suppliers tables';