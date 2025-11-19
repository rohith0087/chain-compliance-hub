-- Fix search_path security issue for trigger_populate_onboarding_requirements
CREATE OR REPLACE FUNCTION trigger_populate_onboarding_requirements()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;