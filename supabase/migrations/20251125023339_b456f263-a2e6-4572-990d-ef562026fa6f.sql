-- Drop the trigger that blocks supplier profile creation
DROP TRIGGER IF EXISTS check_supplier_profile_type ON suppliers;

-- Drop the function that references the deleted user_invitations table
DROP FUNCTION IF EXISTS prevent_wrong_profile_type();

-- Also drop the buyer profile type trigger if it exists (cleanup)
DROP TRIGGER IF EXISTS check_buyer_profile_type ON buyers;
DROP FUNCTION IF EXISTS prevent_wrong_buyer_profile_type();