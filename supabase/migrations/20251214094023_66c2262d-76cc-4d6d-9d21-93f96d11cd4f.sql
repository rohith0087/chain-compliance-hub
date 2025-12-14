-- Add missing columns to onboarding_document_requirements table
ALTER TABLE onboarding_document_requirements 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

ALTER TABLE onboarding_document_requirements 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();