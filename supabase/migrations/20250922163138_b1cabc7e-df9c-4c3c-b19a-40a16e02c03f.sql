-- Fix security warnings by setting search_path for the trigger function
CREATE OR REPLACE FUNCTION update_bulk_upload_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.uploaded_by_buyer = true AND NEW.status != OLD.status THEN
    UPDATE bulk_document_uploads
    SET 
      processed_files = processed_files + 1,
      successful_uploads = CASE WHEN NEW.status = 'approved' THEN successful_uploads + 1 ELSE successful_uploads END,
      failed_uploads = CASE WHEN NEW.status = 'rejected' THEN failed_uploads + 1 ELSE failed_uploads END,
      updated_at = now()
    WHERE id = (NEW.metadata->>'bulk_upload_id')::uuid;
  END IF;
  RETURN NEW;
END;
$function$;