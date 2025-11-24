-- Phase 1: Drop user_invitations infrastructure

-- Drop triggers first (depends on table)
DROP TRIGGER IF EXISTS match_supplier_invitation ON suppliers;
DROP TRIGGER IF EXISTS create_onboarding_notification ON supplier_onboarding_requests;
DROP TRIGGER IF EXISTS prevent_wrong_profile_type ON suppliers;
DROP TRIGGER IF EXISTS prevent_wrong_buyer_profile_type ON buyers;

-- Drop functions
DROP FUNCTION IF EXISTS match_supplier_invitation() CASCADE;
DROP FUNCTION IF EXISTS create_onboarding_notification() CASCADE;
DROP FUNCTION IF EXISTS check_supplier_profile_type() CASCADE;
DROP FUNCTION IF EXISTS check_buyer_profile_type() CASCADE;

-- Drop foreign key constraint from company_users
ALTER TABLE company_users DROP CONSTRAINT IF EXISTS company_users_invitation_token_fkey;

-- Drop the user_invitations table
DROP TABLE IF EXISTS user_invitations CASCADE;

-- Phase 2: Add password_reset_required column to company_users
ALTER TABLE company_users 
ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT false;

-- Update existing records to not require password reset (they're already set up)
UPDATE company_users SET password_reset_required = false WHERE password_reset_required IS NULL;