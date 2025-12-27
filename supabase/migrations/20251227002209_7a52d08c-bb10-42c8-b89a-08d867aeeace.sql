-- Create buyer_sample_templates table for storing per-document-type sample templates
CREATE TABLE public.buyer_sample_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  sample_file_path TEXT NOT NULL,
  sample_file_name TEXT NOT NULL,
  sample_file_size INTEGER,
  sample_mime_type TEXT,
  notes TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(buyer_id, document_type)
);

-- Add comment describing the table
COMMENT ON TABLE public.buyer_sample_templates IS 'Stores reusable sample document templates per document type for buyers';

-- Enable RLS
ALTER TABLE public.buyer_sample_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Buyers can view their own sample templates
CREATE POLICY "Buyers can view own sample templates"
  ON public.buyer_sample_templates FOR SELECT
  USING (
    buyer_id IN (
      SELECT id FROM public.buyers WHERE profile_id = auth.uid()
    )
    OR
    buyer_id IN (
      SELECT company_id FROM public.company_users 
      WHERE profile_id = auth.uid() 
      AND company_type = 'buyer' 
      AND status = 'active'
    )
  );

-- Buyers can insert their own sample templates
CREATE POLICY "Buyers can insert own sample templates"
  ON public.buyer_sample_templates FOR INSERT
  WITH CHECK (
    buyer_id IN (
      SELECT id FROM public.buyers WHERE profile_id = auth.uid()
    )
    OR
    buyer_id IN (
      SELECT company_id FROM public.company_users 
      WHERE profile_id = auth.uid() 
      AND company_type = 'buyer' 
      AND status = 'active'
    )
  );

-- Buyers can update their own sample templates
CREATE POLICY "Buyers can update own sample templates"
  ON public.buyer_sample_templates FOR UPDATE
  USING (
    buyer_id IN (
      SELECT id FROM public.buyers WHERE profile_id = auth.uid()
    )
    OR
    buyer_id IN (
      SELECT company_id FROM public.company_users 
      WHERE profile_id = auth.uid() 
      AND company_type = 'buyer' 
      AND status = 'active'
    )
  );

-- Buyers can delete their own sample templates
CREATE POLICY "Buyers can delete own sample templates"
  ON public.buyer_sample_templates FOR DELETE
  USING (
    buyer_id IN (
      SELECT id FROM public.buyers WHERE profile_id = auth.uid()
    )
    OR
    buyer_id IN (
      SELECT company_id FROM public.company_users 
      WHERE profile_id = auth.uid() 
      AND company_type = 'buyer' 
      AND status = 'active'
    )
  );

-- Create updated_at trigger
CREATE TRIGGER update_buyer_sample_templates_updated_at
  BEFORE UPDATE ON public.buyer_sample_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_buyer_sample_templates_buyer_id ON public.buyer_sample_templates(buyer_id);
CREATE INDEX idx_buyer_sample_templates_document_type ON public.buyer_sample_templates(document_type);