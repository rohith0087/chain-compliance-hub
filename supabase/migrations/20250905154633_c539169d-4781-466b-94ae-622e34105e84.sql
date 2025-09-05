-- Create supplier onboarding requests table
CREATE TABLE public.supplier_onboarding_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL,
  supplier_id UUID,
  supplier_email TEXT NOT NULL,
  supplier_company_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  can_choose_branches BOOLEAN NOT NULL DEFAULT false,
  custom_message TEXT,
  invitation_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64'),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID
);

-- Create onboarding document requirements table
CREATE TABLE public.onboarding_document_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_request_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  template_file_path TEXT,
  template_file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create onboarding document submissions table
CREATE TABLE public.onboarding_document_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_request_id UUID NOT NULL,
  requirement_id UUID,
  document_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  submitted_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create onboarding branch selections table
CREATE TABLE public.onboarding_branch_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_request_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  selected_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create onboarding form fields table
CREATE TABLE public.onboarding_form_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_request_id UUID NOT NULL,
  field_type TEXT NOT NULL, -- 'text', 'textarea', 'select', 'checkbox', 'date'
  field_label TEXT NOT NULL,
  field_description TEXT,
  field_options JSONB, -- For select fields
  is_required BOOLEAN NOT NULL DEFAULT false,
  field_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create onboarding form responses table
CREATE TABLE public.onboarding_form_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_request_id UUID NOT NULL,
  field_id UUID NOT NULL,
  response_value TEXT,
  submitted_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_onboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_document_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_branch_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_form_responses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for supplier_onboarding_requests
CREATE POLICY "Buyers can manage their onboarding requests" 
ON public.supplier_onboarding_requests 
FOR ALL 
USING (buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid()));

CREATE POLICY "Suppliers can view requests for them" 
ON public.supplier_onboarding_requests 
FOR SELECT 
USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()) OR supplier_email = auth.email());

CREATE POLICY "Suppliers can update their onboarding status" 
ON public.supplier_onboarding_requests 
FOR UPDATE 
USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()) OR supplier_email = auth.email());

-- Create RLS policies for document requirements
CREATE POLICY "Users can view requirements for accessible requests" 
ON public.onboarding_document_requirements 
FOR SELECT 
USING (onboarding_request_id IN (
  SELECT id FROM supplier_onboarding_requests 
  WHERE buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid()) 
     OR supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
     OR supplier_email = auth.email()
));

CREATE POLICY "Buyers can manage requirements for their requests" 
ON public.onboarding_document_requirements 
FOR ALL 
USING (onboarding_request_id IN (
  SELECT id FROM supplier_onboarding_requests 
  WHERE buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
));

-- Create RLS policies for document submissions
CREATE POLICY "Users can view submissions for accessible requests" 
ON public.onboarding_document_submissions 
FOR SELECT 
USING (onboarding_request_id IN (
  SELECT id FROM supplier_onboarding_requests 
  WHERE buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid()) 
     OR supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
     OR supplier_email = auth.email()
));

CREATE POLICY "Suppliers can manage their submissions" 
ON public.onboarding_document_submissions 
FOR ALL 
USING (submitted_by = auth.uid());

-- Create RLS policies for branch selections
CREATE POLICY "Users can view branch selections for accessible requests" 
ON public.onboarding_branch_selections 
FOR SELECT 
USING (onboarding_request_id IN (
  SELECT id FROM supplier_onboarding_requests 
  WHERE buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid()) 
     OR supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
     OR supplier_email = auth.email()
));

CREATE POLICY "Suppliers can manage their branch selections" 
ON public.onboarding_branch_selections 
FOR ALL 
USING (selected_by = auth.uid());

-- Create RLS policies for form fields
CREATE POLICY "Users can view form fields for accessible requests" 
ON public.onboarding_form_fields 
FOR SELECT 
USING (onboarding_request_id IN (
  SELECT id FROM supplier_onboarding_requests 
  WHERE buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid()) 
     OR supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
     OR supplier_email = auth.email()
));

CREATE POLICY "Buyers can manage form fields for their requests" 
ON public.onboarding_form_fields 
FOR ALL 
USING (onboarding_request_id IN (
  SELECT id FROM supplier_onboarding_requests 
  WHERE buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
));

-- Create RLS policies for form responses
CREATE POLICY "Users can view form responses for accessible requests" 
ON public.onboarding_form_responses 
FOR SELECT 
USING (onboarding_request_id IN (
  SELECT id FROM supplier_onboarding_requests 
  WHERE buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid()) 
     OR supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
     OR supplier_email = auth.email()
));

CREATE POLICY "Suppliers can manage their form responses" 
ON public.onboarding_form_responses 
FOR ALL 
USING (submitted_by = auth.uid());

-- Create triggers for updated_at
CREATE TRIGGER update_supplier_onboarding_requests_updated_at
BEFORE UPDATE ON public.supplier_onboarding_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_document_submissions_updated_at
BEFORE UPDATE ON public.onboarding_document_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_form_responses_updated_at
BEFORE UPDATE ON public.onboarding_form_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();