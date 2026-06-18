-- Phase 4: Advanced Multi-Branch Features Database Schema

-- Add branch_id to existing document tables
ALTER TABLE public.document_requests 
ADD COLUMN branch_id UUID REFERENCES public.company_branches(id);

ALTER TABLE public.document_uploads 
ADD COLUMN branch_id UUID REFERENCES public.company_branches(id);

-- Create document libraries for branch-specific organization
CREATE TABLE public.document_libraries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  company_type TEXT NOT NULL,
  branch_id UUID REFERENCES public.company_branches(id),
  library_name TEXT NOT NULL,
  description TEXT,
  library_type TEXT NOT NULL DEFAULT 'general', -- general, compliance, contracts, etc.
  is_default BOOLEAN DEFAULT false,
  access_level TEXT DEFAULT 'branch', -- branch, company, restricted
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shared documents for cross-branch sharing
CREATE TABLE public.shared_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL, -- references document_uploads or document_requests
  document_type TEXT NOT NULL, -- 'upload' or 'request'
  shared_from_branch_id UUID NOT NULL REFERENCES public.company_branches(id),
  shared_to_branch_id UUID NOT NULL REFERENCES public.company_branches(id),
  shared_by UUID NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'read', -- read, write, admin
  expires_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  status TEXT DEFAULT 'active', -- active, revoked, expired
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(document_id, document_type, shared_from_branch_id, shared_to_branch_id)
);

-- Create approval workflows for multi-level approvals
CREATE TABLE public.approval_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  company_type TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  description TEXT,
  document_types TEXT[], -- array of document types this workflow applies to
  branch_id UUID REFERENCES public.company_branches(id), -- null means company-wide
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workflow steps to define approval sequence
CREATE TABLE public.workflow_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  required_role TEXT NOT NULL, -- role required to approve this step
  required_permissions TEXT[], -- specific permissions required
  is_parallel BOOLEAN DEFAULT false, -- can be approved in parallel with other steps
  timeout_hours INTEGER, -- auto-escalate after this many hours
  escalation_role TEXT, -- role to escalate to if timeout
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, step_order)
);

-- Create document approvals to track approval progress
CREATE TABLE public.document_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL, -- references document_uploads
  workflow_id UUID REFERENCES public.approval_workflows(id),
  current_step_id UUID REFERENCES public.workflow_steps(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, approved, rejected, escalated
  approver_id UUID, -- user who made the approval/rejection
  approval_notes TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  escalated_at TIMESTAMP WITH TIME ZONE,
  escalated_to UUID, -- user escalated to
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create delegation permissions for temporary permission delegation
CREATE TABLE public.delegation_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delegator_id UUID NOT NULL, -- user granting permission
  delegate_id UUID NOT NULL, -- user receiving permission
  company_id UUID NOT NULL,
  company_type TEXT NOT NULL,
  branch_id UUID REFERENCES public.company_branches(id),
  permission_type permission_type NOT NULL,
  delegation_reason TEXT,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active', -- active, revoked, expired
  revoked_by UUID,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create branch compliance metrics for tracking
CREATE TABLE public.branch_compliance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.company_branches(id),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_documents INTEGER DEFAULT 0,
  pending_documents INTEGER DEFAULT 0,
  approved_documents INTEGER DEFAULT 0,
  rejected_documents INTEGER DEFAULT 0,
  expired_documents INTEGER DEFAULT 0,
  compliance_score DECIMAL(5,2), -- calculated compliance percentage
  overdue_count INTEGER DEFAULT 0,
  avg_approval_time_hours DECIMAL(8,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(branch_id, metric_date)
);

-- Enable RLS on all new tables
ALTER TABLE public.document_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegation_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_compliance_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for document_libraries
CREATE POLICY "Users can view libraries they have access to" 
ON public.document_libraries 
FOR SELECT 
USING (
  user_has_company_access(auth.uid(), company_id, company_type) OR
  user_has_branch_access(auth.uid(), branch_id)
);

CREATE POLICY "Branch managers can manage libraries" 
ON public.document_libraries 
FOR ALL 
USING (user_has_permission(auth.uid(), company_id, company_type, 'manage_branches'));

-- Create RLS policies for shared_documents
CREATE POLICY "Users can view shared documents for their branches" 
ON public.shared_documents 
FOR SELECT 
USING (
  user_has_branch_access(auth.uid(), shared_from_branch_id) OR
  user_has_branch_access(auth.uid(), shared_to_branch_id)
);

CREATE POLICY "Users can create document shares from their branches" 
ON public.shared_documents 
FOR INSERT 
WITH CHECK (
  user_has_branch_access(auth.uid(), shared_from_branch_id) AND
  user_has_permission(auth.uid(), (SELECT company_id FROM company_branches WHERE id = shared_from_branch_id), (SELECT company_type FROM company_branches WHERE id = shared_from_branch_id), 'write')
);

-- Create RLS policies for approval_workflows
CREATE POLICY "Users can view workflows for their company" 
ON public.approval_workflows 
FOR SELECT 
USING (user_has_company_access(auth.uid(), company_id, company_type));

CREATE POLICY "Company admins can manage workflows" 
ON public.approval_workflows 
FOR ALL 
USING (user_has_permission(auth.uid(), company_id, company_type, 'manage_branches'));

-- Create RLS policies for workflow_steps
CREATE POLICY "Users can view workflow steps for accessible workflows" 
ON public.workflow_steps 
FOR SELECT 
USING (
  workflow_id IN (
    SELECT id FROM approval_workflows 
    WHERE user_has_company_access(auth.uid(), company_id, company_type)
  )
);

-- Create RLS policies for document_approvals
CREATE POLICY "Users can view approvals for documents they can access" 
ON public.document_approvals 
FOR SELECT 
USING (
  document_id IN (
    SELECT id FROM document_uploads du
    JOIN document_requests dr ON du.request_id = dr.id
    WHERE dr.buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
       OR dr.supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  )
);

-- Create RLS policies for delegation_permissions
CREATE POLICY "Users can view their delegations" 
ON public.delegation_permissions 
FOR SELECT 
USING (delegator_id = auth.uid() OR delegate_id = auth.uid());

CREATE POLICY "Users can create delegations for permissions they have" 
ON public.delegation_permissions 
FOR INSERT 
WITH CHECK (
  delegator_id = auth.uid() AND
  user_has_permission(auth.uid(), company_id, company_type, permission_type)
);

-- Create RLS policies for branch_compliance_metrics
CREATE POLICY "Users can view metrics for accessible branches" 
ON public.branch_compliance_metrics 
FOR SELECT 
USING (user_has_branch_access(auth.uid(), branch_id));

-- Create indexes for performance
CREATE INDEX idx_document_requests_branch_id ON public.document_requests(branch_id);
CREATE INDEX idx_document_uploads_branch_id ON public.document_uploads(branch_id);
CREATE INDEX idx_shared_documents_from_branch ON public.shared_documents(shared_from_branch_id);
CREATE INDEX idx_shared_documents_to_branch ON public.shared_documents(shared_to_branch_id);
CREATE INDEX idx_document_approvals_document ON public.document_approvals(document_id);
CREATE INDEX idx_delegation_permissions_active ON public.delegation_permissions(delegate_id, status, expires_at);
CREATE INDEX idx_branch_compliance_date ON public.branch_compliance_metrics(branch_id, metric_date);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_document_libraries_updated_at
  BEFORE UPDATE ON public.document_libraries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shared_documents_updated_at
  BEFORE UPDATE ON public.shared_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_approval_workflows_updated_at
  BEFORE UPDATE ON public.approval_workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_approvals_updated_at
  BEFORE UPDATE ON public.document_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delegation_permissions_updated_at
  BEFORE UPDATE ON public.delegation_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_branch_compliance_metrics_updated_at
  BEFORE UPDATE ON public.branch_compliance_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();