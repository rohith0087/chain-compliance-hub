-- Create table for buyer's default onboarding settings
CREATE TABLE public.buyer_default_onboarding_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL,
  allow_branch_selection BOOLEAN NOT NULL DEFAULT true,
  require_branch_selection BOOLEAN NOT NULL DEFAULT false,
  default_welcome_message TEXT,
  auto_approve_standard_docs BOOLEAN NOT NULL DEFAULT false,
  require_all_documents BOOLEAN NOT NULL DEFAULT true,
  expires_days INTEGER NOT NULL DEFAULT 7,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE,
  UNIQUE(buyer_id)
);

-- Create table for default document requirements
CREATE TABLE public.default_document_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  template_file_path TEXT,
  template_file_name TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE
);

-- Create table for default form fields
CREATE TABLE public.default_form_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'email', 'tel', 'textarea', 'select', 'multiselect', 'checkbox', 'radio', 'date', 'number', 'file')),
  field_label TEXT NOT NULL,
  field_description TEXT,
  field_options JSONB,
  is_required BOOLEAN NOT NULL DEFAULT false,
  field_order INTEGER NOT NULL DEFAULT 0,
  field_category TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE
);

-- Enable RLS on all tables
ALTER TABLE public.buyer_default_onboarding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_form_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies for buyer_default_onboarding_settings
CREATE POLICY "Buyers can manage their default settings"
ON public.buyer_default_onboarding_settings
FOR ALL
USING (buyer_id IN (
  SELECT id FROM buyers WHERE profile_id = auth.uid()
));

-- RLS Policies for default_document_requirements  
CREATE POLICY "Buyers can manage their default document requirements"
ON public.default_document_requirements
FOR ALL
USING (buyer_id IN (
  SELECT id FROM buyers WHERE profile_id = auth.uid()
));

-- RLS Policies for default_form_fields
CREATE POLICY "Buyers can manage their default form fields"
ON public.default_form_fields
FOR ALL
USING (buyer_id IN (
  SELECT id FROM buyers WHERE profile_id = auth.uid()
));

-- Create indexes for better performance
CREATE INDEX idx_buyer_default_settings_buyer_id ON public.buyer_default_onboarding_settings(buyer_id);
CREATE INDEX idx_default_doc_req_buyer_id ON public.default_document_requirements(buyer_id);
CREATE INDEX idx_default_doc_req_order ON public.default_document_requirements(buyer_id, display_order);
CREATE INDEX idx_default_form_fields_buyer_id ON public.default_form_fields(buyer_id);
CREATE INDEX idx_default_form_fields_order ON public.default_form_fields(buyer_id, field_order);

-- Add trigger for updated_at timestamps
CREATE TRIGGER update_buyer_default_settings_updated_at
BEFORE UPDATE ON public.buyer_default_onboarding_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_default_doc_req_updated_at
BEFORE UPDATE ON public.default_document_requirements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_default_form_fields_updated_at
BEFORE UPDATE ON public.default_form_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some standard default configurations for new buyers
INSERT INTO public.default_document_requirements (buyer_id, document_type, document_name, description, is_required, display_order)
SELECT 
  b.id,
  'insurance',
  'General Liability Insurance Certificate',
  'Current certificate of general liability insurance coverage',
  true,
  1
FROM buyers b
WHERE NOT EXISTS (
  SELECT 1 FROM default_document_requirements ddr WHERE ddr.buyer_id = b.id
);

INSERT INTO public.default_document_requirements (buyer_id, document_type, document_name, description, is_required, display_order)
SELECT 
  b.id,
  'business_license',
  'Business License',
  'Valid business license or registration certificate',
  true,
  2
FROM buyers b
WHERE NOT EXISTS (
  SELECT 1 FROM default_document_requirements ddr WHERE ddr.buyer_id = b.id AND ddr.document_type = 'business_license'
);

INSERT INTO public.default_document_requirements (buyer_id, document_type, document_name, description, is_required, display_order)
SELECT 
  b.id,
  'tax_certificate',
  'Tax Certificate',
  'Current tax registration or certificate',
  true,
  3
FROM buyers b
WHERE NOT EXISTS (
  SELECT 1 FROM default_document_requirements ddr WHERE ddr.buyer_id = b.id AND ddr.document_type = 'tax_certificate'
);

-- Insert standard form fields for existing buyers
INSERT INTO public.default_form_fields (buyer_id, field_type, field_label, field_description, is_required, field_order, field_category)
SELECT 
  b.id,
  'number',
  'Years in Business',
  'How many years has your company been in operation?',
  true,
  1,
  'company_info'
FROM buyers b
WHERE NOT EXISTS (
  SELECT 1 FROM default_form_fields dff WHERE dff.buyer_id = b.id
);

INSERT INTO public.default_form_fields (buyer_id, field_type, field_label, field_description, is_required, field_order, field_category)
SELECT 
  b.id,
  'textarea',
  'Key Certifications',
  'List any relevant industry certifications or accreditations',
  false,
  2,
  'certifications'
FROM buyers b
WHERE NOT EXISTS (
  SELECT 1 FROM default_form_fields dff WHERE dff.buyer_id = b.id AND dff.field_label = 'Key Certifications'
);

INSERT INTO public.default_form_fields (buyer_id, field_type, field_label, field_description, is_required, field_order, field_category)
SELECT 
  b.id,
  'select',
  'Company Size',
  'Select your company size range',
  true,
  3,
  'company_info'
FROM buyers b
WHERE NOT EXISTS (
  SELECT 1 FROM default_form_fields dff WHERE dff.buyer_id = b.id AND dff.field_label = 'Company Size'
);

-- Update the select field with options
UPDATE public.default_form_fields 
SET field_options = '["1-10 employees", "11-50 employees", "51-200 employees", "201-500 employees", "500+ employees"]'::jsonb
WHERE field_label = 'Company Size' AND field_type = 'select';

-- Insert default settings for existing buyers
INSERT INTO public.buyer_default_onboarding_settings (buyer_id, allow_branch_selection, default_welcome_message, created_by)
SELECT 
  b.id,
  true,
  'Welcome to our supplier onboarding process. Please complete the following requirements to begin our partnership.',
  b.profile_id
FROM buyers b
WHERE NOT EXISTS (
  SELECT 1 FROM buyer_default_onboarding_settings bdos WHERE bdos.buyer_id = b.id
);