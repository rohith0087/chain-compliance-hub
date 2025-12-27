-- Add display_name column to buyer_sample_templates for custom template names
ALTER TABLE public.buyer_sample_templates 
ADD COLUMN IF NOT EXISTS display_name TEXT;