-- Add new columns to onboarding_document_submissions table to support "document not available" option
ALTER TABLE public.onboarding_document_submissions 
ADD COLUMN is_document_available boolean NOT NULL DEFAULT true,
ADD COLUMN unavailability_reason text;

-- Make file-related columns nullable since they won't exist for unavailable documents
ALTER TABLE public.onboarding_document_submissions 
ALTER COLUMN file_path DROP NOT NULL,
ALTER COLUMN file_name DROP NOT NULL,
ALTER COLUMN file_size DROP NOT NULL;