-- Create custom document templates table for buyer-uploaded templates
CREATE TABLE custom_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  template_name TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL,
  category TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  required_fields JSONB DEFAULT '[]'::jsonb,
  template_version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create template submissions table to track supplier responses to custom templates
CREATE TABLE template_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES custom_document_templates(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES document_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL,
  submission_file_path TEXT,
  submission_file_name TEXT,
  submission_file_size INTEGER,
  submission_mime_type TEXT,
  submission_type TEXT DEFAULT 'upload', -- 'upload' or 'form_fill'
  form_data JSONB DEFAULT '{}'::jsonb, -- For digital form submissions
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'revision_requested')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE custom_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_submissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_document_templates
CREATE POLICY "Buyers can manage their custom templates"
ON custom_document_templates
FOR ALL
USING (buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid()));

CREATE POLICY "Suppliers can view templates from connected buyers"
ON custom_document_templates
FOR SELECT
USING (buyer_id IN (
  SELECT bsc.buyer_id 
  FROM buyer_supplier_connections bsc
  JOIN suppliers s ON s.id = bsc.supplier_id
  WHERE s.profile_id = auth.uid() AND bsc.status = 'approved'
));

-- RLS policies for template_submissions
CREATE POLICY "Suppliers can manage submissions for their templates"
ON template_submissions
FOR ALL
USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()));

CREATE POLICY "Buyers can view submissions for their templates"
ON template_submissions
FOR SELECT
USING (template_id IN (
  SELECT id FROM custom_document_templates 
  WHERE buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
));

CREATE POLICY "Buyers can update submission status"
ON template_submissions
FOR UPDATE
USING (template_id IN (
  SELECT id FROM custom_document_templates 
  WHERE buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
));

-- Add indexes for performance
CREATE INDEX idx_custom_templates_buyer_id ON custom_document_templates(buyer_id);
CREATE INDEX idx_custom_templates_active ON custom_document_templates(is_active);
CREATE INDEX idx_template_submissions_template_id ON template_submissions(template_id);
CREATE INDEX idx_template_submissions_request_id ON template_submissions(request_id);
CREATE INDEX idx_template_submissions_supplier_id ON template_submissions(supplier_id);
CREATE INDEX idx_template_submissions_status ON template_submissions(status);

-- Add updated_at triggers
CREATE TRIGGER update_custom_templates_updated_at
  BEFORE UPDATE ON custom_document_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_submissions_updated_at
  BEFORE UPDATE ON template_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add template_type field to document_requests to distinguish between standard and custom templates
ALTER TABLE document_requests 
ADD COLUMN template_type TEXT DEFAULT 'standard' CHECK (template_type IN ('standard', 'custom')),
ADD COLUMN custom_template_id UUID REFERENCES custom_document_templates(id);

-- Create index for the new fields
CREATE INDEX idx_document_requests_template_type ON document_requests(template_type);
CREATE INDEX idx_document_requests_custom_template ON document_requests(custom_template_id);