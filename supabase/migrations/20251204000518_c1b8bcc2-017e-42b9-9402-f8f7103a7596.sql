-- Phase 1: Schema Enhancement for document_activity_logs

-- Add document_request_id column to link activities to requests (before upload exists)
ALTER TABLE document_activity_logs 
ADD COLUMN IF NOT EXISTS document_request_id UUID REFERENCES document_requests(id) ON DELETE CASCADE;

-- Make document_upload_id nullable to allow logging before upload exists
ALTER TABLE document_activity_logs 
ALTER COLUMN document_upload_id DROP NOT NULL;

-- Add constraint ensuring at least one reference exists
ALTER TABLE document_activity_logs 
ADD CONSTRAINT activity_has_reference 
CHECK (document_request_id IS NOT NULL OR document_upload_id IS NOT NULL);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_request_id ON document_activity_logs(document_request_id);
CREATE INDEX IF NOT EXISTS idx_activity_action_type ON document_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON document_activity_logs(created_at DESC);

-- Phase 2: Database Triggers for Automatic Logging

-- 2.1 Trigger for Document Requested
CREATE OR REPLACE FUNCTION log_document_requested()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO document_activity_logs (
    document_request_id,
    user_id,
    action_type,
    notes,
    metadata
  ) VALUES (
    NEW.id,
    NEW.requester_id,
    'requested',
    'Document request created: ' || NEW.title,
    jsonb_build_object(
      'document_type', NEW.document_type,
      'category', NEW.category,
      'priority', NEW.priority,
      'supplier_id', NEW.supplier_id,
      'title', NEW.title
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for document requested (drop if exists first)
DROP TRIGGER IF EXISTS trigger_log_document_requested ON document_requests;
CREATE TRIGGER trigger_log_document_requested
AFTER INSERT ON document_requests
FOR EACH ROW EXECUTE FUNCTION log_document_requested();

-- 2.2 Trigger for Document Uploaded
CREATE OR REPLACE FUNCTION log_document_uploaded()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO document_activity_logs (
    document_upload_id,
    document_request_id,
    user_id,
    action_type,
    notes,
    metadata
  ) VALUES (
    NEW.id,
    NEW.request_id,
    NEW.uploader_id,
    'uploaded',
    'Document uploaded: ' || COALESCE(NEW.file_name, 'Unknown'),
    jsonb_build_object(
      'file_name', NEW.file_name,
      'file_size', NEW.file_size,
      'mime_type', NEW.mime_type,
      'document_name', NEW.document_name
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for document uploaded
DROP TRIGGER IF EXISTS trigger_log_document_uploaded ON document_uploads;
CREATE TRIGGER trigger_log_document_uploaded
AFTER INSERT ON document_uploads
FOR EACH ROW EXECUTE FUNCTION log_document_uploaded();

-- 2.3 Trigger for Link Created
CREATE OR REPLACE FUNCTION log_link_created()
RETURNS TRIGGER AS $$
DECLARE
  v_request_id UUID;
BEGIN
  -- Get the request_id from the upload
  SELECT request_id INTO v_request_id
  FROM document_uploads WHERE id = NEW.document_upload_id;
  
  INSERT INTO document_activity_logs (
    document_upload_id,
    document_request_id,
    user_id,
    action_type,
    notes,
    metadata
  ) VALUES (
    NEW.document_upload_id,
    v_request_id,
    NEW.created_by,
    'link_created',
    'Shareable link created',
    jsonb_build_object(
      'permission_level', NEW.permission_level,
      'expires_at', NEW.expires_at,
      'link_id', NEW.id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for link created
DROP TRIGGER IF EXISTS trigger_log_link_created ON document_shared_links;
CREATE TRIGGER trigger_log_link_created
AFTER INSERT ON document_shared_links
FOR EACH ROW EXECUTE FUNCTION log_link_created();

-- Update RLS policy to allow viewing activities by document_request_id
DROP POLICY IF EXISTS "Users can view logs for their company documents" ON document_activity_logs;
CREATE POLICY "Users can view logs for their company documents" 
ON document_activity_logs FOR SELECT
USING (
  -- Allow if activity is linked via document_upload
  (document_upload_id IN (
    SELECT du.id FROM document_uploads du
    JOIN document_requests dr ON du.request_id = dr.id
    WHERE 
      dr.buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
      OR dr.buyer_id IN (SELECT company_id FROM company_users WHERE profile_id = auth.uid() AND company_type = 'buyer' AND status = 'active')
      OR dr.supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
      OR dr.supplier_id IN (SELECT company_id FROM company_users WHERE profile_id = auth.uid() AND company_type = 'supplier' AND status = 'active')
  ))
  OR
  -- Allow if activity is linked via document_request directly
  (document_request_id IN (
    SELECT dr.id FROM document_requests dr
    WHERE 
      dr.buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
      OR dr.buyer_id IN (SELECT company_id FROM company_users WHERE profile_id = auth.uid() AND company_type = 'buyer' AND status = 'active')
      OR dr.supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
      OR dr.supplier_id IN (SELECT company_id FROM company_users WHERE profile_id = auth.uid() AND company_type = 'supplier' AND status = 'active')
  ))
);