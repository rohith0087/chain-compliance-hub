import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ApprovalWorkflow {
  id: string;
  company_id: string;
  company_type: 'buyer' | 'supplier';
  workflow_name: string;
  description?: string;
  document_types?: string[];
  branch_id?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  step_name: string;
  required_role: string;
  required_permissions?: string[];
  is_parallel: boolean;
  timeout_hours?: number;
  escalation_role?: string;
  created_at: string;
}

export interface DocumentApproval {
  id: string;
  document_id: string;
  workflow_id?: string;
  current_step_id?: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'escalated';
  approver_id?: string;
  approval_notes?: string;
  approved_at?: string;
  escalated_at?: string;
  escalated_to?: string;
  created_at: string;
  updated_at: string;
}

export const useApprovalWorkflows = (companyId?: string, companyType?: 'buyer' | 'supplier') => {
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<Record<string, WorkflowStep[]>>({});
  const [documentApprovals, setDocumentApprovals] = useState<DocumentApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchWorkflows = async () => {
    if (!companyId || !companyType) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: workflowsData, error: workflowsError } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .order('workflow_name', { ascending: true });

      if (workflowsError) {
        console.error('Error fetching workflows:', workflowsError);
        setError('Failed to load approval workflows');
        return;
      }

      setWorkflows(workflowsData as ApprovalWorkflow[] || []);

      // Fetch workflow steps for each workflow
      if (workflowsData && workflowsData.length > 0) {
        const workflowIds = workflowsData.map(w => w.id);
        const { data: stepsData, error: stepsError } = await supabase
          .from('workflow_steps')
          .select('*')
          .in('workflow_id', workflowIds)
          .order('step_order', { ascending: true });

        if (stepsError) {
          console.error('Error fetching workflow steps:', stepsError);
        } else {
          // Group steps by workflow_id
          const stepsGrouped = (stepsData as WorkflowStep[]).reduce((acc, step) => {
            if (!acc[step.workflow_id]) {
              acc[step.workflow_id] = [];
            }
            acc[step.workflow_id].push(step);
            return acc;
          }, {} as Record<string, WorkflowStep[]>);
          setWorkflowSteps(stepsGrouped);
        }
      }

    } catch (err) {
      console.error('Error in fetchWorkflows:', err);
      setError('Failed to load approval workflows');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentApprovals = async () => {
    if (!companyId || !companyType) return;

    try {
      const { data: approvalsData, error: approvalsError } = await supabase
        .from('document_approvals')
        .select('*')
        .order('created_at', { ascending: false });

      if (approvalsError) {
        console.error('Error fetching document approvals:', approvalsError);
        return;
      }

      setDocumentApprovals(approvalsData as DocumentApproval[] || []);
    } catch (err) {
      console.error('Error in fetchDocumentApprovals:', err);
    }
  };

  const createWorkflow = async (workflowData: Omit<ApprovalWorkflow, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) {
      toast.error('You must be logged in to create workflows');
      return { error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('approval_workflows')
        .insert([workflowData])
        .select()
        .single();

      if (error) {
        console.error('Error creating workflow:', error);
        toast.error('Failed to create approval workflow');
        return { error };
      }

      setWorkflows(prev => [...prev, data as ApprovalWorkflow]);
      toast.success('Approval workflow created successfully');
      return { data, error: null };
    } catch (err) {
      console.error('Error in createWorkflow:', err);
      toast.error('Failed to create approval workflow');
      return { error: err };
    }
  };

  const addWorkflowStep = async (stepData: Omit<WorkflowStep, 'id' | 'created_at'>) => {
    if (!user) {
      toast.error('You must be logged in to add workflow steps');
      return { error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('workflow_steps')
        .insert([stepData])
        .select()
        .single();

      if (error) {
        console.error('Error adding workflow step:', error);
        toast.error('Failed to add workflow step');
        return { error };
      }

      setWorkflowSteps(prev => ({
        ...prev,
        [stepData.workflow_id]: [
          ...(prev[stepData.workflow_id] || []),
          data as WorkflowStep
        ].sort((a, b) => a.step_order - b.step_order)
      }));

      toast.success('Workflow step added successfully');
      return { data, error: null };
    } catch (err) {
      console.error('Error in addWorkflowStep:', err);
      toast.error('Failed to add workflow step');
      return { error: err };
    }
  };

  const createDocumentApproval = async (approvalData: Omit<DocumentApproval, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) {
      toast.error('You must be logged in to create document approvals');
      return { error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('document_approvals')
        .insert([approvalData])
        .select()
        .single();

      if (error) {
        console.error('Error creating document approval:', error);
        toast.error('Failed to create document approval');
        return { error };
      }

      setDocumentApprovals(prev => [data as DocumentApproval, ...prev]);
      toast.success('Document approval created successfully');
      return { data, error: null };
    } catch (err) {
      console.error('Error in createDocumentApproval:', err);
      toast.error('Failed to create document approval');
      return { error: err };
    }
  };

  const updateApprovalStatus = async (
    approvalId: string, 
    status: DocumentApproval['status'], 
    notes?: string
  ) => {
    if (!user) {
      toast.error('You must be logged in to update approvals');
      return { error: 'Not authenticated' };
    }

    try {
      const updateData: any = {
        status,
        approver_id: user.id,
        approval_notes: notes
      };

      if (status === 'approved' || status === 'rejected') {
        updateData.approved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('document_approvals')
        .update(updateData)
        .eq('id', approvalId)
        .select()
        .single();

      if (error) {
        console.error('Error updating approval status:', error);
        toast.error('Failed to update approval status');
        return { error };
      }

      setDocumentApprovals(prev => 
        prev.map(approval => 
          approval.id === approvalId ? data as DocumentApproval : approval
        )
      );

      toast.success(`Document ${status} successfully`);
      return { data, error: null };
    } catch (err) {
      console.error('Error in updateApprovalStatus:', err);
      toast.error('Failed to update approval status');
      return { error: err };
    }
  };

  useEffect(() => {
    fetchWorkflows();
    fetchDocumentApprovals();
  }, [companyId, companyType]);

  return {
    workflows,
    workflowSteps,
    documentApprovals,
    loading,
    error,
    createWorkflow,
    addWorkflowStep,
    createDocumentApproval,
    updateApprovalStatus,
    refetch: () => {
      fetchWorkflows();
      fetchDocumentApprovals();
    }
  };
};