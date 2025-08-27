-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION public.log_document_processing()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log when document extraction status changes
  IF OLD.extraction_status IS DISTINCT FROM NEW.extraction_status THEN
    INSERT INTO document_processing_logs (document_id, processing_step, status)
    VALUES (NEW.id, 'extraction', NEW.extraction_status);
  END IF;
  
  RETURN NEW;
END;
$$;