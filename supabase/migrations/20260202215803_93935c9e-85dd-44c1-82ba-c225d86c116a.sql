-- Add content extraction tracking to document_uploads
ALTER TABLE document_uploads
ADD COLUMN IF NOT EXISTS content_extraction_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS content_extracted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS content_summary TEXT;

-- Comment on columns
COMMENT ON COLUMN document_uploads.content_extraction_status IS 'Status of AI content extraction: pending, processing, completed, failed';
COMMENT ON COLUMN document_uploads.content_extracted_at IS 'Timestamp when content extraction completed';
COMMENT ON COLUMN document_uploads.content_summary IS 'AI-generated summary of document content';

-- Create index for year-based queries on ai_knowledge_entries for buyer documents
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_buyer_year 
ON ai_knowledge_entries ((metadata->>'year'), company_id) 
WHERE company_type = 'buyer';

-- Create index for source reference lookups to prevent duplicates
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_source_ref 
ON ai_knowledge_entries (source_reference);

-- Create index for content extraction status queries
CREATE INDEX IF NOT EXISTS idx_document_uploads_extraction_status 
ON document_uploads (content_extraction_status) 
WHERE content_extraction_status IS NOT NULL;