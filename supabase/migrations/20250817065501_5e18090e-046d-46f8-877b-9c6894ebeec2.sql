-- Create agent activity logs table
CREATE TABLE public.agent_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('supplier', 'buyer')),
  action_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  details JSONB,
  confidence_score DECIMAL(3,2),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create supplier response times tracking
CREATE TABLE public.supplier_response_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  request_date TIMESTAMP WITH TIME ZONE NOT NULL,
  response_date TIMESTAMP WITH TIME ZONE,
  response_time_hours INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create document validation criteria
CREATE TABLE public.document_validation_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  criteria JSONB NOT NULL,
  required_fields JSONB,
  validation_rules JSONB,
  auto_approve_threshold DECIMAL(3,2) DEFAULT 0.85,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agent configuration
CREATE TABLE public.agent_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  company_type TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('supplier', 'buyer')),
  enabled BOOLEAN DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_response_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_validation_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_activities
CREATE POLICY "Users can view agent activities for their entities" 
ON public.agent_activities 
FOR SELECT 
USING (
  (agent_type = 'supplier' AND entity_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )) OR
  (agent_type = 'buyer' AND entity_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  ))
);

-- RLS Policies for supplier_response_metrics
CREATE POLICY "Users can view their response metrics" 
ON public.supplier_response_metrics 
FOR SELECT 
USING (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()) OR
  buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
);

CREATE POLICY "System can manage response metrics" 
ON public.supplier_response_metrics 
FOR ALL 
USING (true);

-- RLS Policies for document_validation_criteria
CREATE POLICY "Buyers can manage their validation criteria" 
ON public.document_validation_criteria 
FOR ALL 
USING (buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid()));

-- RLS Policies for agent_configurations
CREATE POLICY "Users can manage their agent configurations" 
ON public.agent_configurations 
FOR ALL 
USING (
  (company_type = 'supplier' AND company_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )) OR
  (company_type = 'buyer' AND company_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  ))
);

-- Add indexes for performance
CREATE INDEX idx_agent_activities_agent_type_entity ON agent_activities(agent_type, entity_id);
CREATE INDEX idx_supplier_response_metrics_supplier ON supplier_response_metrics(supplier_id);
CREATE INDEX idx_supplier_response_metrics_buyer ON supplier_response_metrics(buyer_id);
CREATE INDEX idx_document_validation_criteria_buyer ON document_validation_criteria(buyer_id);
CREATE INDEX idx_agent_configurations_company ON agent_configurations(company_id, company_type);

-- Add trigger for updated_at
CREATE TRIGGER update_supplier_response_metrics_updated_at
BEFORE UPDATE ON public.supplier_response_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_validation_criteria_updated_at
BEFORE UPDATE ON public.document_validation_criteria
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_configurations_updated_at
BEFORE UPDATE ON public.agent_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();