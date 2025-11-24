-- Function to match supplier signup with pending invitations and auto-connect
CREATE OR REPLACE FUNCTION match_supplier_invitation()
RETURNS TRIGGER AS $$
DECLARE
  v_onboarding_request_id UUID;
  v_buyer_id UUID;
  v_supplier_email TEXT;
BEGIN
  -- Get supplier email from new supplier record
  v_supplier_email := NEW.contact_email;
  
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
    
    RAISE LOG 'Matched supplier % with onboarding request % and created connection', NEW.id, v_onboarding_request_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create it
DROP TRIGGER IF EXISTS on_supplier_signup_match_invitation ON suppliers;

CREATE TRIGGER on_supplier_signup_match_invitation
  AFTER INSERT ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION match_supplier_invitation();