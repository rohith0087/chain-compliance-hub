import { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  AlertCircle,
  Building2,
  Mail,
  Calendar,
  Send,
  ThumbsUp,
  ThumbsDown,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';

interface OnboardingRequestDetailDrawerProps {
  request: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

export const OnboardingRequestDetailDrawer = ({
  request,
  open,
  onOpenChange,
  onStatusChange
}: OnboardingRequestDetailDrawerProps) => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  useEffect(() => {
    if (open && request) {
      loadDocuments();
    }
  }, [open, request]);

  const loadDocuments = async () => {
    try {
      setLoading(true);

      // Fetch document requirements for this onboarding request
      const { data: docsData, error: docsError } = await supabase
        .from('onboarding_document_requirements')
        .select('*')
        .eq('onboarding_request_id', request.id)
        .order('created_at', { ascending: true });

      if (docsError) {
        console.error('Error loading document requirements:', docsError);
        throw docsError;
      }

      // Fetch document submissions (if any)
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('onboarding_document_submissions')
        .select('*')
        .eq('onboarding_request_id', request.id);

      if (submissionsError) {
        console.error('Error loading submissions:', submissionsError);
        // Don't throw - submissions might not exist yet
      }

      setDocuments(docsData || []);
      setSubmissions(submissionsData || []);
    } catch (error: any) {
      console.error('Error loading documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load document requirements',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async () => {
    try {
      setActionLoading(true);

      // Update status to 'pending' and trigger requirements population
      const { error: updateError } = await supabase
        .from('supplier_onboarding_requests')
        .update({ 
          status: 'pending',
          responded_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Call edge function to populate requirements
      const { error: functionError } = await supabase.functions.invoke('populate-onboarding-requirements', {
        body: { onboarding_request_id: request.id }
      });

      if (functionError) throw functionError;

      toast({
        title: 'Request Approved',
        description: 'The onboarding request has been approved and requirements have been set up.'
      });

      onStatusChange?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to approve request',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);

      const { error } = await supabase
        .from('supplier_onboarding_requests')
        .update({ 
          status: 'approved',
          responded_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (error) throw error;

      toast({
        title: 'Request Approved',
        description: 'The supplier has been approved successfully.'
      });

      onStatusChange?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to approve request',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionNote.trim()) {
      toast({
        title: 'Note Required',
        description: 'Please provide a reason for rejection',
        variant: 'destructive'
      });
      return;
    }

    try {
      setActionLoading(true);

      const { error } = await supabase
        .from('supplier_onboarding_requests')
        .update({ 
          status: 'rejected',
          responded_at: new Date().toISOString(),
          rejection_reason: rejectionNote
        })
        .eq('id', request.id);

      if (error) throw error;

      toast({
        title: 'Request Declined',
        description: 'The supplier request has been declined.'
      });

      onStatusChange?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to decline request',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
      setShowRejectionForm(false);
      setRejectionNote('');
    }
  };

  const handleSendReminder = async () => {
    try {
      setActionLoading(true);

      // Call edge function to send reminder email
      const { error } = await supabase.functions.invoke('send-supplier-invitation', {
        body: {
          email: request.supplier_email,
          isReminder: true,
          requestId: request.id
        }
      });

      if (error) throw error;

      toast({
        title: 'Reminder Sent',
        description: `Reminder email sent to ${request.supplier_email}`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to send reminder',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getDocumentStatus = (docReq: any) => {
    const submission = submissions.find(s => s.requirement_id === docReq.id);
    if (!submission) return { status: 'missing', icon: XCircle, color: 'text-destructive' };
    if (submission.is_document_available === false) return { status: 'unavailable', icon: XCircle, color: 'text-muted-foreground' };
    return { status: 'submitted', icon: CheckCircle, color: 'text-success' };
  };

  const calculateProgress = () => {
    if (documents.length === 0) return 0;
    const submitted = documents.filter(doc => {
      const submission = submissions.find(s => s.requirement_id === doc.id);
      return submission && submission.is_document_available !== false;
    }).length;
    return Math.round((submitted / documents.length) * 100);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any }> = {
      pending: { label: 'Invited', variant: 'secondary' },
      onboarding_initiated: { label: 'Started', variant: 'default' },
      under_review: { label: 'Under Review', variant: 'outline' },
      approved: { label: 'Approved', variant: 'default' },
      rejected: { label: 'Declined', variant: 'destructive' }
    };
    
    const config = statusMap[status] || statusMap.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const progress = calculateProgress();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <div className="overflow-y-auto">
          <DrawerHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <DrawerTitle className="text-2xl">
                  {request.supplier_company_name || request.supplier_email}
                </DrawerTitle>
                <DrawerDescription className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {request.supplier_email}
                </DrawerDescription>
              </div>
              {getStatusBadge(request.status)}
            </div>
          </DrawerHeader>

          <div className="px-6 space-y-6">
            {/* Timeline & Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Created
                </div>
                <div className="text-sm font-medium">
                  {format(new Date(request.created_at), 'MMM d, yyyy')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                </div>
              </div>

              {request.responded_at && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last Updated
                  </div>
                  <div className="text-sm font-medium">
                    {format(new Date(request.responded_at), 'MMM d, yyyy')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(request.responded_at), { addSuffix: true })}
                  </div>
                </div>
              )}

              {request.branch_id && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Branch
                  </div>
                  <div className="text-sm font-medium">Branch Assigned</div>
                </div>
              )}
            </div>

            <Separator />

            {/* Progress Overview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Overall Progress</h3>
                <span className="text-sm font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <p className="text-sm text-muted-foreground">
                {documents.filter(doc => {
                  const submission = submissions.find(s => s.requirement_id === doc.id);
                  return submission && submission.is_document_available !== false;
                }).length} of {documents.length} documents submitted
              </p>
            </div>

            <Separator />

            {/* Document Checklist */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Document Checklist
              </h3>
              
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="text-sm text-muted-foreground">No documents required</div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => {
                    const statusInfo = getDocumentStatus(doc);
                    const StatusIcon = statusInfo.icon;
                    
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
                          <div>
                            <div className="font-medium text-sm">{doc.document_name}</div>
                            {doc.description && (
                              <div className="text-xs text-muted-foreground">{doc.description}</div>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {statusInfo.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom Message */}
            {request.custom_message && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Custom Message
                  </h3>
                  <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                    {request.custom_message}
                  </p>
                </div>
              </>
            )}

            {/* Rejection Form */}
            {showRejectionForm && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-destructive">Decline Request</h3>
                  <Textarea
                    placeholder="Please provide a reason for declining this request..."
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={actionLoading}
                    >
                      Confirm Decline
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowRejectionForm(false);
                        setRejectionNote('');
                      }}
                      disabled={actionLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <DrawerFooter className="pt-6">
            <div className="flex gap-2 w-full">
              {request.status === 'under_review' && !showRejectionForm && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="flex-1"
                          onClick={handleApprove}
                          disabled={actionLoading}
                        >
                          <ThumbsUp className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Approve this supplier</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="destructive"
                          onClick={() => setShowRejectionForm(true)}
                          disabled={actionLoading}
                        >
                          <ThumbsDown className="mr-2 h-4 w-4" />
                          Decline
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Decline this request</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}

              {(request.status === 'pending' || request.status === 'onboarding_initiated') && !showRejectionForm && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={handleSendReminder}
                        disabled={actionLoading}
                        className="flex-1"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send Reminder
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send a reminder email to the supplier</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {!showRejectionForm && (
                <DrawerClose asChild>
                  <Button variant="outline">Close</Button>
                </DrawerClose>
              )}
            </div>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
