-- Add 'completed' to the request_status enum
ALTER TYPE request_status ADD VALUE 'completed';

-- Update the sync trigger to handle 'completed' status properly
CREATE OR REPLACE FUNCTION public.sync_document_upload_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update all document uploads for this request to match the request status
  UPDATE document_uploads 
  SET status = CASE 
    WHEN NEW.status = 'completed' THEN 'approved'  -- Convert completed to approved for uploads
    WHEN NEW.status = 'approved' THEN 'approved'
    WHEN NEW.status = 'rejected' THEN 'rejected'
    WHEN NEW.status = 'pending' THEN 'pending_review'
    ELSE NEW.status::text
  END,
  updated_at = now()
  WHERE request_id = NEW.id;
  
  RETURN NEW;
END;
$function$;

-- Add a trigger to automatically convert 'completed' to 'approved' in document_requests
CREATE OR REPLACE FUNCTION public.normalize_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Convert 'completed' to 'approved' to maintain consistency
  IF NEW.status = 'completed' THEN
    NEW.status = 'approved';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger for INSERT and UPDATE operations
DROP TRIGGER IF EXISTS normalize_request_status_trigger ON document_requests;
CREATE TRIGGER normalize_request_status_trigger
  BEFORE INSERT OR UPDATE OF status ON document_requests
  FOR EACH ROW
  EXECUTE FUNCTION normalize_request_status();