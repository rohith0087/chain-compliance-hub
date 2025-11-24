-- COMPLETE FIX: Prevent invited buyer team members from creating supplier profiles
-- Phase 1: Modify match_supplier_invitation() to skip invited buyer users
-- Phase 2: Dashboard guards (handled in frontend)
-- Phase 3: Add database constraint to prevent wrong profile types

-- ============================================================================
-- PHASE 1: Update match_supplier_invitation() with safety check
-- ============================================================================

CREATE OR REPLACE FUNCTION match_supplier_invitation()
RETURNS TRIGGER AS $$
DECLARE
  v_onboarding_request_id UUID;
  v_buyer_id UUID;
  v_supplier_email TEXT;
  v_is_invited_buyer BOOLEAN;
  v_user_email TEXT;
BEGIN
  -- Get supplier email from new supplier record
  v_supplier_email := NEW.contact_email;
  
  -- Get the auth user's email for this profile
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.profile_id;
  
  -- CRITICAL CHECK: Don't process if this is an invited buyer team member
  -- who accidentally created a supplier profile
  SELECT EXISTS (
    SELECT 1 FROM user_invitations 
    WHERE (user_id = NEW.profile_id OR email = v_user_email)
    AND company_type = 'buyer'  -- Invited as buyer, shouldn't have supplier profile
  ) INTO v_is_invited_buyer;
  
  IF v_is_invited_buyer THEN
    RAISE LOG 'match_supplier_invitation: Skipping for invited buyer user % (email: %)', NEW.profile_id, v_user_email;
    RETURN NEW;
  END IF;
  
  -- Check if there's an onboarding request for this email (invited or pending, no supplier_id yet)
  SELECT id, buyer_id
  INTO v_onboarding_request_id, v_buyer_id
  FROM supplier_onboarding_requests
  WHERE supplier_email = v_supplier_email
    AND status IN ('invited', 'pending')
    AND supplier_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If invitation found, link it to this new supplier and auto-connect
  IF v_onboarding_request_id IS NOT NULL THEN
    -- Update onboarding request with supplier_id and set to pending
    UPDATE supplier_onboarding_requests
    SET supplier_id = NEW.id,
        supplier_company_name = NEW.company_name,
        status = 'pending',
        updated_at = NOW()
    WHERE id = v_onboarding_request_id;
    
    -- Auto-create buyer-supplier connection (pending approval)
    INSERT INTO buyer_supplier_connections (
      buyer_id,
      supplier_id,
      status,
      notes,
      initiated_by,
      requested_at
    ) VALUES (
      v_buyer_id,
      NEW.id,
      'pending',
      'Auto-connected from bulk invitation',
      'supplier',
      NOW()
    )
    ON CONFLICT DO NOTHING;
    
    -- Create notification for buyer
    INSERT INTO notifications (user_id, title, message, type, reference_id)
    SELECT 
      profile_id,
      'Invited Supplier Signed Up',
      'A supplier you invited (' || v_supplier_email || ') has created their account and connected.',
      'connection_request',
      v_onboarding_request_id
    FROM buyers
    WHERE id = v_buyer_id;
    
    RAISE LOG 'match_supplier_invitation: Matched supplier % with onboarding request % and created connection', NEW.id, v_onboarding_request_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 3: Add database constraint to prevent invited buyers from having supplier profiles
-- ============================================================================

-- Note: We use a trigger-based check instead of a direct CHECK constraint
-- because CHECK constraints can't use subqueries in PostgreSQL

CREATE OR REPLACE FUNCTION prevent_wrong_profile_type()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email TEXT;
  v_is_invited_buyer BOOLEAN;
BEGIN
  -- Get the user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.profile_id;
  
  -- Check if this user was invited as a buyer
  SELECT EXISTS (
    SELECT 1 FROM user_invitations 
    WHERE (user_id = NEW.profile_id OR email = v_user_email)
    AND company_type = 'buyer'
  ) INTO v_is_invited_buyer;
  
  -- Block the insert if they're an invited buyer trying to create supplier profile
  IF v_is_invited_buyer THEN
    RAISE EXCEPTION 'User % was invited as a buyer team member and cannot create a supplier profile', v_user_email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create it
DROP TRIGGER IF EXISTS check_supplier_profile_type ON suppliers;

CREATE TRIGGER check_supplier_profile_type
  BEFORE INSERT ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION prevent_wrong_profile_type();

-- Similarly, prevent invited suppliers from creating buyer profiles
CREATE OR REPLACE FUNCTION prevent_wrong_buyer_profile_type()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email TEXT;
  v_is_invited_supplier BOOLEAN;
BEGIN
  -- Get the user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.profile_id;
  
  -- Check if this user was invited as a supplier
  SELECT EXISTS (
    SELECT 1 FROM user_invitations 
    WHERE (user_id = NEW.profile_id OR email = v_user_email)
    AND company_type = 'supplier'
  ) INTO v_is_invited_supplier;
  
  -- Block the insert if they're an invited supplier trying to create buyer profile
  IF v_is_invited_supplier THEN
    RAISE EXCEPTION 'User % was invited as a supplier team member and cannot create a buyer profile', v_user_email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create it
DROP TRIGGER IF EXISTS check_buyer_profile_type ON buyers;

CREATE TRIGGER check_buyer_profile_type
  BEFORE INSERT ON buyers
  FOR EACH ROW
  EXECUTE FUNCTION prevent_wrong_buyer_profile_type();