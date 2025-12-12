-- Fix sync_document_upload_status to only update the LATEST document upload, not all versions
CREATE OR REPLACE FUNCTION public.sync_document_upload_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only update the LATEST document upload for this request, not all versions
  -- This preserves the status history of previous document versions
  UPDATE document_uploads 
  SET status = CASE 
    WHEN NEW.status = 'completed' THEN 'approved'
    WHEN NEW.status = 'approved' THEN 'approved'
    WHEN NEW.status = 'rejected' THEN 'rejected'
    WHEN NEW.status = 'pending' THEN 'pending_review'
    ELSE NEW.status::text
  END,
  updated_at = now()
  WHERE id = (
    SELECT id FROM document_uploads 
    WHERE request_id = NEW.id 
    ORDER BY created_at DESC 
    LIMIT 1
  );
  
  RETURN NEW;
END;
$function$;