-- Add missing columns to onboarding_form_fields table
ALTER TABLE onboarding_form_fields 
ADD COLUMN IF NOT EXISTS field_category TEXT DEFAULT 'general';

ALTER TABLE onboarding_form_fields 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();