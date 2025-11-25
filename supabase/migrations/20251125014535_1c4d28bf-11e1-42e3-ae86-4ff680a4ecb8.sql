-- Drop the check_buyer_profile_type trigger and function
-- These reference the deleted user_invitations table and are no longer needed
-- since we removed the invitation system

DROP TRIGGER IF EXISTS check_buyer_profile_type ON buyers;
DROP FUNCTION IF EXISTS public.prevent_wrong_buyer_profile_type();