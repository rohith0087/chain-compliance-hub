-- Fix RLS Policies for Phase 4 Tables

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
  EXISTS (
    SELECT 1 FROM company_branches cb 
    WHERE cb.id = shared_from_branch_id 
    AND user_has_permission(auth.uid(), cb.company_id, cb.company_type, 'write')
  )
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
    SELECT aw.id FROM approval_workflows aw
    WHERE user_has_company_access(auth.uid(), aw.company_id, aw.company_type)
  )
);

-- Create RLS policies for document_approvals
CREATE POLICY "Users can view approvals for documents they can access" 
ON public.document_approvals 
FOR SELECT 
USING (
  document_id IN (
    SELECT du.id FROM document_uploads du
    JOIN document_requests dr ON du.request_id = dr.id
    WHERE dr.buyer_id IN (SELECT b.id FROM buyers b WHERE b.profile_id = auth.uid())
       OR dr.supplier_id IN (SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid())
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