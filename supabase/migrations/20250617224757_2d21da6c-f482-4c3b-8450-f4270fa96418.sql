
-- Add expiration_date column to document_uploads table
ALTER TABLE public.document_uploads 
ADD COLUMN expiration_date DATE;

-- Add index for better performance when querying by expiration date
CREATE INDEX idx_document_uploads_expiration_date ON public.document_uploads(expiration_date);

-- Add index for better performance when filtering by status and expiration
CREATE INDEX idx_document_uploads_status_expiration ON public.document_uploads(status, expiration_date);
