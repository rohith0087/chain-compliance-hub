-- Add expiration date and AI suggestion columns to supplier_document_library
ALTER TABLE supplier_document_library 
ADD COLUMN expiration_date DATE,
ADD COLUMN ai_suggested_tags TEXT[],
ADD COLUMN ai_suggested_description TEXT;