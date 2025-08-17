-- Create workflow templates table
CREATE TABLE public.workflow_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'document_upload', 'approval_request', 'expiry_warning', etc.
  steps JSONB NOT NULL, -- Array of workflow steps
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workflow states table for tracking active workflows
CREATE TABLE public.workflow_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES workflow_templates(id),
  current_step TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed', 'paused'
  ai_responses JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI generated documents table
CREATE TABLE public.ai_generated_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id),
  document_type TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'rejected'
  metadata JSONB DEFAULT '{}',
  workflow_id UUID REFERENCES workflow_states(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workflow execution logs
CREATE TABLE public.workflow_execution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES workflow_states(id),
  step_id TEXT NOT NULL,
  step_type TEXT NOT NULL,
  ai_response JSONB,
  execution_time_ms INTEGER,
  status TEXT NOT NULL, -- 'success', 'error', 'skipped'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflow_templates
CREATE POLICY "workflow_templates_select" ON public.workflow_templates
  FOR SELECT USING (true); -- Allow all authenticated users to read

CREATE POLICY "workflow_templates_admin" ON public.workflow_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND 'admin' = ANY(roles)
    )
  );

-- RLS Policies for workflow_states
CREATE POLICY "workflow_states_view_own" ON public.workflow_states
  FOR SELECT USING (
    (context->>'user_id')::uuid = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND ('admin' = ANY(roles) OR 'buyer' = ANY(roles))
    )
  );

CREATE POLICY "workflow_states_manage" ON public.workflow_states
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND ('admin' = ANY(roles) OR 'buyer' = ANY(roles))
    )
  );

-- RLS Policies for ai_generated_documents
CREATE POLICY "ai_generated_documents_view_own" ON public.ai_generated_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = ai_generated_documents.supplier_id
      AND s.profile_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND ('admin' = ANY(roles) OR 'buyer' = ANY(roles))
    )
  );

CREATE POLICY "ai_generated_documents_supplier_manage" ON public.ai_generated_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = ai_generated_documents.supplier_id
      AND s.profile_id = auth.uid()
    )
  );

-- RLS Policies for workflow_execution_logs
CREATE POLICY "workflow_execution_logs_view" ON public.workflow_execution_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workflow_states ws
      WHERE ws.id = workflow_execution_logs.workflow_id
      AND (
        (ws.context->>'user_id')::uuid = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = auth.uid() 
          AND ('admin' = ANY(roles) OR 'buyer' = ANY(roles))
        )
      )
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER update_workflow_templates_updated_at
  BEFORE UPDATE ON public.workflow_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_states_updated_at
  BEFORE UPDATE ON public.workflow_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_generated_documents_updated_at
  BEFORE UPDATE ON public.ai_generated_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_workflow_states_template_id ON public.workflow_states(template_id);
CREATE INDEX idx_workflow_states_status ON public.workflow_states(status);
CREATE INDEX idx_workflow_execution_logs_workflow_id ON public.workflow_execution_logs(workflow_id);
CREATE INDEX idx_ai_generated_documents_supplier_id ON public.ai_generated_documents(supplier_id);

-- Insert default workflow templates
INSERT INTO public.workflow_templates (name, description, trigger_type, steps) VALUES
(
  'Advanced Document Validation',
  'Multi-step AI validation with risk assessment and intelligent decision making',
  'document_upload',
  '[
    {
      "id": "initial_analysis",
      "type": "ai_analysis",
      "prompt": "Analyze this document for compliance, completeness, and quality. Consider: 1) All required fields present, 2) Document authenticity, 3) Compliance with regulations, 4) Risk factors. Rate confidence and provide detailed reasoning.",
      "next_steps": ["risk_assessment"]
    },
    {
      "id": "risk_assessment",
      "type": "ai_analysis",
      "prompt": "Based on the initial analysis, assess the risk level of this document and supplier. Consider: 1) Historical compliance, 2) Industry risk factors, 3) Document quality issues, 4) Potential compliance violations. Recommend approval, rejection, or human review.",
      "next_steps": ["confidence_decision"]
    },
    {
      "id": "confidence_decision",
      "type": "decision",
      "conditions": {"confidence_above": 90},
      "next_steps": ["auto_approve", "manual_review"]
    },
    {
      "id": "auto_approve",
      "type": "action",
      "action_type": "approve_document",
      "next_steps": ["send_approval_notification"]
    },
    {
      "id": "manual_review",
      "type": "action",
      "action_type": "escalate_to_human",
      "next_steps": ["send_review_notification"]
    },
    {
      "id": "send_approval_notification",
      "type": "notification",
      "next_steps": []
    },
    {
      "id": "send_review_notification",
      "type": "notification",
      "next_steps": []
    }
  ]'::jsonb
),
(
  'Intelligent Document Generation',
  'AI-powered document generation based on requirements and templates',
  'document_request',
  '[
    {
      "id": "analyze_requirements",
      "type": "ai_analysis",
      "prompt": "Analyze the document requirements and determine what type of document needs to be generated. Consider industry standards, compliance requirements, and specific client needs.",
      "next_steps": ["generate_document"]
    },
    {
      "id": "generate_document",
      "type": "action",
      "action_type": "generate_document",
      "next_steps": ["quality_check"]
    },
    {
      "id": "quality_check",
      "type": "ai_analysis",
      "prompt": "Review the generated document for quality, completeness, and compliance. Ensure it meets all requirements and industry standards.",
      "next_steps": ["finalize_document"]
    },
    {
      "id": "finalize_document",
      "type": "action",
      "action_type": "approve_document",
      "next_steps": ["send_completion_notification"]
    },
    {
      "id": "send_completion_notification",
      "type": "notification",
      "next_steps": []
    }
  ]'::jsonb
),
(
  'Predictive Compliance Monitoring',
  'Proactive monitoring and prediction of compliance issues',
  'scheduled_analysis',
  '[
    {
      "id": "analyze_trends",
      "type": "ai_analysis",
      "prompt": "Analyze current compliance trends, document patterns, and supplier behavior to predict potential issues. Identify suppliers at risk and documents likely to expire or fail compliance.",
      "next_steps": ["risk_prioritization"]
    },
    {
      "id": "risk_prioritization",
      "type": "ai_analysis",
      "prompt": "Prioritize identified risks based on impact, likelihood, and urgency. Recommend specific actions for each risk category.",
      "next_steps": ["proactive_actions"]
    },
    {
      "id": "proactive_actions",
      "type": "action",
      "action_type": "generate_recommendations",
      "next_steps": ["send_alerts"]
    },
    {
      "id": "send_alerts",
      "type": "notification",
      "next_steps": []
    }
  ]'::jsonb
);