-- Add buyer upload tracking to document_uploads
ALTER TABLE document_uploads 
ADD COLUMN uploaded_by_buyer boolean DEFAULT false,
ADD COLUMN original_uploader_type text DEFAULT 'supplier',
ADD COLUMN buyer_notes text,
ADD COLUMN pre_populated_at timestamp with time zone;

-- Create bulk document uploads tracking table
CREATE TABLE bulk_document_uploads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  connection_id uuid REFERENCES buyer_supplier_connections(id),
  total_files integer NOT NULL DEFAULT 0,
  processed_files integer NOT NULL DEFAULT 0,
  successful_uploads integer NOT NULL DEFAULT 0,
  failed_uploads integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing',
  error_details jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- Enable RLS on bulk_document_uploads
ALTER TABLE bulk_document_uploads ENABLE ROW LEVEL SECURITY;

-- RLS policies for bulk_document_uploads
CREATE POLICY "Buyers can manage their bulk uploads"
ON bulk_document_uploads
FOR ALL
USING (buyer_id IN (
  SELECT id FROM buyers WHERE profile_id = auth.uid()
));

CREATE POLICY "Suppliers can view bulk uploads for them"
ON bulk_document_uploads
FOR SELECT
USING (supplier_id IN (
  SELECT id FROM suppliers WHERE profile_id = auth.uid()
));

-- Update RLS policy for document_uploads to allow buyer uploads
CREATE POLICY "Buyers can upload documents for connected suppliers"
ON document_uploads
FOR INSERT
WITH CHECK (
  uploaded_by_buyer = true AND
  request_id IN (
    SELECT dr.id FROM document_requests dr
    WHERE dr.buyer_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
    )
  )
);

-- Create trigger for bulk upload progress tracking
CREATE OR REPLACE FUNCTION update_bulk_upload_progress()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER bulk_upload_progress_trigger
  AFTER UPDATE ON document_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_upload_progress();