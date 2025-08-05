-- Phase 4: Advanced Multi-Branch Features Database Schema (Fixed)

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
  library_type TEXT NOT NULL DEFAULT 'general',
  is_default BOOLEAN DEFAULT false,
  access_level TEXT DEFAULT 'branch',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shared documents for cross-branch sharing
CREATE TABLE public.shared_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  shared_from_branch_id UUID NOT NULL REFERENCES public.company_branches(id),
  shared_to_branch_id UUID NOT NULL REFERENCES public.company_branches(id),
  shared_by UUID NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'read',
  expires_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  status TEXT DEFAULT 'active',
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
  document_types TEXT[],
  branch_id UUID REFERENCES public.company_branches(id),
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
  required_role TEXT NOT NULL,
  required_permissions TEXT[],
  is_parallel BOOLEAN DEFAULT false,
  timeout_hours INTEGER,
  escalation_role TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, step_order)
);

-- Create document approvals to track approval progress
CREATE TABLE public.document_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  workflow_id UUID REFERENCES public.approval_workflows(id),
  current_step_id UUID REFERENCES public.workflow_steps(id),
  status TEXT NOT NULL DEFAULT 'pending',
  approver_id UUID,
  approval_notes TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  escalated_at TIMESTAMP WITH TIME ZONE,
  escalated_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create delegation permissions for temporary permission delegation
CREATE TABLE public.delegation_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delegator_id UUID NOT NULL,
  delegate_id UUID NOT NULL,
  company_id UUID NOT NULL,
  company_type TEXT NOT NULL,
  branch_id UUID REFERENCES public.company_branches(id),
  permission_type permission_type NOT NULL,
  delegation_reason TEXT,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active',
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
  compliance_score DECIMAL(5,2),
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