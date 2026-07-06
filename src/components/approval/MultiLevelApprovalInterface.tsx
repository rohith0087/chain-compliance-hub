import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Plus, 
  ArrowRight, 
  Users, 
  Shield, 
  Timer,
  FileText
} from 'lucide-react';
import { useApprovalWorkflows, DocumentApproval, ApprovalWorkflow, WorkflowStep } from '@/hooks/useApprovalWorkflows';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface MultiLevelApprovalInterfaceProps {
  companyId: string;
  companyType: 'buyer' | 'supplier';
  branchId?: string;
}

const MultiLevelApprovalInterface: React.FC<MultiLevelApprovalInterfaceProps> = ({
  companyId,
  companyType,
  branchId
}) => {
  const { 
    workflows, 
    workflowSteps, 
    documentApprovals, 
    loading, 
    createWorkflow, 
    addWorkflowStep,
    updateApprovalStatus
  } = useApprovalWorkflows(companyId, companyType);
  const { user } = useAuth();

  const [isCreateWorkflowOpen, setIsCreateWorkflowOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [isAddStepOpen, setIsAddStepOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const [newWorkflow, setNewWorkflow] = useState({
    workflow_name: '',
    description: '',
    document_types: [] as string[],
    is_active: true
  });

  const [newStep, setNewStep] = useState({
    step_name: '',
    required_role: '',
    required_permissions: [] as string[],
    is_parallel: false,
    timeout_hours: undefined as number | undefined,
    escalation_role: ''
  });

  const handleCreateWorkflow = async () => {
    if (!user || !newWorkflow.workflow_name.trim()) return;

    const workflowData = {
      company_id: companyId,
      company_type: companyType,
      workflow_name: newWorkflow.workflow_name,
      description: newWorkflow.description,
      document_types: newWorkflow.document_types,
      branch_id: branchId,
      is_active: newWorkflow.is_active,
      created_by: user.id
    };

    const result = await createWorkflow(workflowData);
    if (!result.error) {
      setIsCreateWorkflowOpen(false);
      setNewWorkflow({
        workflow_name: '',
        description: '',
        document_types: [],
        is_active: true
      });
    }
  };

  const handleAddStep = async () => {
    if (!selectedWorkflowId || !newStep.step_name.trim() || !newStep.required_role) return;

    const currentSteps = workflowSteps[selectedWorkflowId] || [];
    const stepData = {
      workflow_id: selectedWorkflowId,
      step_order: currentSteps.length + 1,
      step_name: newStep.step_name,
      required_role: newStep.required_role,
      required_permissions: newStep.required_permissions,
      is_parallel: newStep.is_parallel,
      timeout_hours: newStep.timeout_hours,
      escalation_role: newStep.escalation_role || undefined
    };

    const result = await addWorkflowStep(stepData);
    if (!result.error) {
      setIsAddStepOpen(false);
      setNewStep({
        step_name: '',
        required_role: '',
        required_permissions: [],
        is_parallel: false,
        timeout_hours: undefined,
        escalation_role: ''
      });
    }
  };

  const handleApprovalAction = async (approvalId: string, action: 'approved' | 'rejected') => {
    const notes = approvalNotes[approvalId] || '';
    await updateApprovalStatus(approvalId, action, notes);
    setApprovalNotes(prev => ({ ...prev, [approvalId]: '' }));
  };

  const getStatusIcon = (status: DocumentApproval['status']) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'in_progress':
        return <Timer className="h-4 w-4 text-blue-600" />;
      case 'escalated':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: DocumentApproval['status']) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'escalated': return 'bg-orange-100 text-orange-800';
      default: return 'bg-muted text-foreground';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'company_admin':
        return <Shield className="h-4 w-4" />;
      case 'branch_manager':
        return <Users className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Multi-Level Approval Workflows</h2>
          <p className="text-muted-foreground">
            Manage document approval processes and track progress
          </p>
        </div>
        
        <Dialog open={isCreateWorkflowOpen} onOpenChange={setIsCreateWorkflowOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Approval Workflow</DialogTitle>
              <DialogDescription>
                Define a multi-step approval process for document reviews.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="workflow_name">Workflow Name</Label>
                <Input
                  id="workflow_name"
                  value={newWorkflow.workflow_name}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, workflow_name: e.target.value })}
                  placeholder="e.g., Compliance Document Review"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                  placeholder="Describe when this workflow should be used..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateWorkflowOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateWorkflow}>
                Create Workflow
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="workflows" className="w-full">
        <TabsList>
          <TabsTrigger value="workflows">Workflows ({workflows.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending Approvals ({documentApprovals.filter(a => a.status === 'pending' || a.status === 'in_progress').length})</TabsTrigger>
          <TabsTrigger value="history">Approval History</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          {workflows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Approval Workflows</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first approval workflow to automate document reviews.
                </p>
                <Button onClick={() => setIsCreateWorkflowOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Workflow
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {workflows.map((workflow) => {
                const steps = workflowSteps[workflow.id] || [];
                return (
                  <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{workflow.workflow_name}</CardTitle>
                        <Badge variant={workflow.is_active ? 'default' : 'secondary'}>
                          {workflow.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {workflow.description && (
                        <CardDescription>{workflow.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Approval Steps ({steps.length})</p>
                        {steps.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No steps defined</p>
                        ) : (
                          <div className="space-y-2">
                            {steps.map((step, index) => (
                              <div key={step.id} className="flex items-center space-x-2 text-sm">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                                  {step.step_order}
                                </div>
                                <div className="flex items-center space-x-1">
                                  {getRoleIcon(step.required_role)}
                                  <span>{step.step_name}</span>
                                </div>
                                {index < steps.length - 1 && (
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedWorkflowId(workflow.id);
                            setIsAddStepOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Step
                        </Button>
                        <Button variant="outline" size="sm">
                          Configure
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {documentApprovals.filter(a => a.status === 'pending' || a.status === 'in_progress').length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Pending Approvals</h3>
                <p className="text-muted-foreground text-center">
                  All documents have been processed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {documentApprovals
                .filter(approval => approval.status === 'pending' || approval.status === 'in_progress')
                .map((approval) => (
                <Card key={approval.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(approval.status)}
                          <span className="font-medium">Document ID: {approval.document_id}</span>
                          <Badge className={getStatusColor(approval.status)}>
                            {approval.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Created: {format(new Date(approval.created_at), 'PPp')}
                        </p>
                        {approval.workflow_id && (
                          <p className="text-sm text-muted-foreground">
                            Workflow: {workflows.find(w => w.id === approval.workflow_id)?.workflow_name || 'Unknown'}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col space-y-2">
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleApprovalAction(approval.id, 'approved')}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleApprovalAction(approval.id, 'rejected')}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Add notes..."
                          value={approvalNotes[approval.id] || ''}
                          onChange={(e) => setApprovalNotes(prev => ({ ...prev, [approval.id]: e.target.value }))}
                          className="text-xs"
                          rows={2}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="space-y-3">
            {documentApprovals
              .filter(approval => approval.status === 'approved' || approval.status === 'rejected')
              .map((approval) => (
              <Card key={approval.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(approval.status)}
                        <span className="font-medium">Document ID: {approval.document_id}</span>
                        <Badge className={getStatusColor(approval.status)}>
                          {approval.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {approval.approved_at && `Processed: ${format(new Date(approval.approved_at), 'PPp')}`}
                      </p>
                      {approval.approval_notes && (
                        <p className="text-sm">Notes: {approval.approval_notes}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Step Dialog */}
      <Dialog open={isAddStepOpen} onOpenChange={setIsAddStepOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Workflow Step</DialogTitle>
            <DialogDescription>
              Add a new step to the approval workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="step_name">Step Name</Label>
              <Input
                id="step_name"
                value={newStep.step_name}
                onChange={(e) => setNewStep({ ...newStep, step_name: e.target.value })}
                placeholder="e.g., Manager Review"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="required_role">Required Role</Label>
              <Select value={newStep.required_role} onValueChange={(value) => setNewStep({ ...newStep, required_role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select required role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company_admin">Company Admin</SelectItem>
                  <SelectItem value="branch_manager">Branch Manager</SelectItem>
                  <SelectItem value="document_manager">Document Manager</SelectItem>
                  <SelectItem value="approver">Approver</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timeout_hours">Timeout Hours (Optional)</Label>
              <Input
                id="timeout_hours"
                type="number"
                value={newStep.timeout_hours || ''}
                onChange={(e) => setNewStep({ ...newStep, timeout_hours: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="Hours before escalation"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStepOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStep}>
              Add Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MultiLevelApprovalInterface;