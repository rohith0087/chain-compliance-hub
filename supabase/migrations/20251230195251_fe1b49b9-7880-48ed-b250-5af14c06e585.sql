-- Add last_used_at column to track when a document set was last used
ALTER TABLE document_sets 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;