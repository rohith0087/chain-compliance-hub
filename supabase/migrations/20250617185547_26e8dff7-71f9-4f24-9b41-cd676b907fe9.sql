
-- Add missing fields to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS auto_approve_connections BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS description TEXT;
