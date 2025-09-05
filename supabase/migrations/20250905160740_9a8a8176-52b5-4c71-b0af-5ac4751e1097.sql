-- Fix the search_path issue for the function created in previous migration
CREATE OR REPLACE FUNCTION create_onboarding_notification()
RETURNS TRIGGER AS $$
DECLARE
  supplier_profile_id UUID;
  notification_message TEXT;
BEGIN
  -- Check if this is a new onboarding request
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Try to find existing supplier by email
    SELECT profile_id INTO supplier_profile_id
    FROM suppliers
    WHERE contact_email = NEW.supplier_email;
    
    -- If supplier exists, link them and create notification
    IF supplier_profile_id IS NOT NULL THEN
      -- Update the request to link the supplier
      UPDATE supplier_onboarding_requests
      SET supplier_id = (SELECT id FROM suppliers WHERE profile_id = supplier_profile_id)
      WHERE id = NEW.id;
      
      -- Create notification for the supplier
      notification_message := 'You have received a new onboarding request from a buyer.';
      
      PERFORM create_notification(
        supplier_profile_id,
        'New Onboarding Request',
        notification_message,
        'onboarding_request',
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';