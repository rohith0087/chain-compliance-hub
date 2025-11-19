-- Function to populate onboarding requirements via edge function
CREATE OR REPLACE FUNCTION trigger_populate_onboarding_requirements()
RETURNS TRIGGER AS $$
DECLARE
  v_requirement_count INTEGER;
BEGIN
  -- Only run when status becomes 'pending' or 'onboarding_initiated'
  IF (TG_OP = 'INSERT' AND NEW.status IN ('pending', 'onboarding_initiated')) OR 
     (TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status IN ('pending', 'onboarding_initiated')) THEN
    
    -- Check if requirements already exist
    SELECT COUNT(*) INTO v_requirement_count
    FROM onboarding_document_requirements
    WHERE onboarding_request_id = NEW.id;
    
    -- Only populate if no requirements exist
    IF v_requirement_count = 0 THEN
      PERFORM net.http_post(
        url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/populate-onboarding-requirements',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
        ),
        body := jsonb_build_object(
          'onboarding_request_id', NEW.id
        )
      );
      
      RAISE LOG 'Triggered requirement population for onboarding request: %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on supplier_onboarding_requests
DROP TRIGGER IF EXISTS auto_populate_onboarding_requirements ON supplier_onboarding_requests;
CREATE TRIGGER auto_populate_onboarding_requirements
  AFTER INSERT OR UPDATE OF status ON supplier_onboarding_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_populate_onboarding_requirements();