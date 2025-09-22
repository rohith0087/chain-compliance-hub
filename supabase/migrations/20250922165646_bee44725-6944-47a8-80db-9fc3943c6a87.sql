-- Add missing metadata column to document_uploads table
ALTER TABLE document_uploads 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add index for better performance on metadata queries
CREATE INDEX IF NOT EXISTS idx_document_uploads_metadata_gin ON document_uploads USING gin(metadata);

-- Clean up any existing broken pre-populate records without file paths
UPDATE document_uploads 
SET status = 'failed' 
WHERE file_path LIKE 'pre-populated/%' 
  AND file_path NOT LIKE '%/compliance-documents/%';