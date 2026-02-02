-- Create function to sync sample templates to pending document requests
CREATE OR REPLACE FUNCTION sync_sample_to_pending_requests()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all pending document requests for this buyer/document_type
  -- that don't already have a sample attached
  UPDATE document_requests
  SET 
    sample_file_path = NEW.sample_file_path,
    sample_file_name = NEW.sample_file_name,
    sample_file_size = NEW.sample_file_size,
    sample_mime_type = NEW.sample_mime_type,
    sample_uploaded_by = NEW.uploaded_by,
    sample_uploaded_at = NEW.created_at,
    updated_at = NOW()
  WHERE buyer_id = NEW.buyer_id
    AND document_type = NEW.document_type
    AND sample_file_path IS NULL
    AND status = 'pending';
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run automatically when a sample template is inserted or updated
CREATE TRIGGER trigger_sync_sample_to_pending_requests
AFTER INSERT OR UPDATE ON buyer_sample_templates
FOR EACH ROW
EXECUTE FUNCTION sync_sample_to_pending_requests();