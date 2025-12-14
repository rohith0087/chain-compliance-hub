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
import { Input } from '@/components/ui/input';
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
  MessageSquare,
  Eye,
  Download,
  RotateCcw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
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
  const { user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [perDocRejectionNotes, setPerDocRejectionNotes] = useState<Record<string, string>>({});
  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);

  useEffect(() => {
    if (open && request) {
      loadDocuments();
    }
  }, [open, request]);

  const loadDocuments = async () => {
    if (!request) return;
    
    setLoading(true);
    try {
      const { data: requirements, error: reqError } = await supabase
        .from('onboarding_document_requirements')
        .select('*')
        .eq('onboarding_request_id', request.id)
        .order('document_name');

      if (reqError) throw reqError;

      const { data: subs, error: subsError } = await supabase
        .from('onboarding_document_submissions')
        .select('*')
        .eq('onboarding_request_id', request.id);

      if (subsError) throw subsError;

      setDocuments(requirements || []);
      setSubmissions(subs || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewDocument = async (submission: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-documents')
        .createSignedUrl(submission.file_path, 300); // 5 minutes

      if (error) {
        console.error('Error creating signed URL:', error);
        toast({
          title: "Error",
          description: "Failed to load document",
          variant: "destructive"
        });
        return;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      toast({
        title: "Error",
        description: "Failed to view document",
        variant: "destructive"
      });
    }
  };

  const downloadDocument = async (submission: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-documents')
        .createSignedUrl(submission.file_path, 300);

      if (error) {
        console.error('Error creating signed URL:', error);
        toast({
          title: "Error",
          description: "Failed to download document",
          variant: "destructive"
        });
        return;
      }

      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = submission.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive"
      });
    }
  };

  const handleApproveRequest = async () => {
    try {
      setActionLoading(true);

      // Update status to 'pending' and trigger requirements population
      const { error: updateError } = await supabase
        .from('supplier_onboarding_requests')
        .update({ 
          status: 'pending'
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
          status: 'approved'
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
          status: 'pending',
          rejection_reason: rejectionNote
        })
        .eq('id', request.id);

      if (error) throw error;

      toast({
        title: 'Request Declined',
        description: 'The supplier has been notified and can resubmit their documents.'
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

      // Get buyer data for the email
      const { data: { user } } = await supabase.auth.getUser();
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('full_name, company_name')
        .eq('id', user?.id)
        .single();

      const { data: buyer } = await supabase
        .from('buyers')
        .select('company_name, contact_email, buyer_id_number')
        .eq('id', request.buyer_id)
        .single();

      // Call edge function to send reminder email
      const { error } = await supabase.functions.invoke('send-supplier-invitation', {
        body: {
          emails: [request.supplier_email],
          subject: 'Reminder: Complete Your Onboarding',
          customMessage: `This is a friendly reminder to complete your onboarding process. We're looking forward to working with you!`,
          buyerData: {
            name: buyerProfile?.full_name || 'Buyer Representative',
            company: buyer?.company_name || 'Our Company',
            email: buyer?.contact_email || user?.email || '',
            buyerId: buyer?.buyer_id_number || ''
          }
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
    if (!submission) return { status: 'missing', icon: XCircle, color: 'text-destructive', label: 'Missing' };
    if (submission.is_document_available === false) return { status: 'unavailable', icon: AlertCircle, color: 'text-muted-foreground', label: 'Unavailable' };
    
    // Check per-document review status
    const docStatus = submission.status || 'pending';
    if (docStatus === 'approved') return { status: 'approved', icon: CheckCircle, color: 'text-green-600', label: 'Approved' };
    if (docStatus === 'rejected') return { status: 'rejected', icon: XCircle, color: 'text-destructive', label: 'Rejected' };
    if (docStatus === 'resubmitted') return { status: 'resubmitted', icon: RotateCcw, color: 'text-blue-600', label: 'Resubmitted' };
    return { status: 'pending', icon: Clock, color: 'text-amber-600', label: 'Pending Review' };
  };

  const calculateProgress = () => {
    if (documents.length === 0) return 0;
    const approved = submissions.filter(sub => sub.status === 'approved').length;
    return Math.round((approved / documents.length) * 100);
  };

  const handleApproveDocument = async (submissionId: string) => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('onboarding_document_submissions')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (error) throw error;

      toast({ title: 'Document Approved', description: 'The document has been approved.' });
      await loadDocuments();
      await updateRequestStatusBasedOnDocs();
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to approve document', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDocument = async (submissionId: string, requirementId: string) => {
    const reason = perDocRejectionNotes[requirementId];
    if (!reason?.trim()) {
      toast({ title: 'Reason Required', description: 'Please provide a rejection reason', variant: 'destructive' });
      return;
    }

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('onboarding_document_submissions')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', submissionId);

      if (error) throw error;

      toast({ title: 'Document Rejected', description: 'The supplier will be notified to resubmit.' });
      setPerDocRejectionNotes(prev => ({ ...prev, [requirementId]: '' }));
      setReviewingDocId(null);
      await loadDocuments();
      await updateRequestStatusBasedOnDocs();
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to reject document', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const updateRequestStatusBasedOnDocs = async () => {
    // Re-fetch submissions to get latest state
    const { data: latestSubs } = await supabase
      .from('onboarding_document_submissions')
      .select('*')
      .eq('onboarding_request_id', request.id);

    if (!latestSubs || latestSubs.length === 0) return;

    const allApproved = latestSubs.every(s => s.status === 'approved');
    const anyRejected = latestSubs.some(s => s.status === 'rejected');
    const anyPending = latestSubs.some(s => s.status === 'pending' || s.status === 'resubmitted');

    let newStatus = request.status;
    if (allApproved) {
      newStatus = 'approved';
    } else if (anyRejected && !anyPending) {
      newStatus = 'partially_approved';
    }

    if (newStatus !== request.status) {
      await supabase
        .from('supplier_onboarding_requests')
        .update({ status: newStatus })
        .eq('id', request.id);
      onStatusChange?.();
    }
  };

  const handleCompleteReview = async () => {
    // Check if all documents have been reviewed
    const allReviewed = submissions.every(s => s.status === 'approved' || s.status === 'rejected');
    if (!allReviewed) {
      toast({ title: 'Review Incomplete', description: 'Please review all documents before completing.', variant: 'destructive' });
      return;
    }

    await updateRequestStatusBasedOnDocs();
    toast({ title: 'Review Completed', description: 'The onboarding review has been completed.' });
    onStatusChange?.();
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any }> = {
      pending: { label: 'Invited', variant: 'secondary' },
      onboarding_initiated: { label: 'Started', variant: 'default' },
      under_review: { label: 'Under Review', variant: 'outline' },
      partially_approved: { label: 'Needs Resubmission', variant: 'outline' },
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
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const statusInfo = getDocumentStatus(doc);
                    const StatusIcon = statusInfo.icon;
                    const submission = submissions.find(s => s.requirement_id === doc.id);
                    const isReviewing = reviewingDocId === doc.id;
                    const canReview = submission && 
                      submission.is_document_available !== false && 
                      (submission.status === 'pending' || submission.status === 'resubmitted') &&
                      (request.status === 'under_review' || request.status === 'partially_approved');
                    
                    return (
                      <div
                        key={doc.id}
                        className="p-3 rounded-lg border bg-card space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{doc.document_name}</div>
                              {doc.description && (
                                <div className="text-xs text-muted-foreground">{doc.description}</div>
                              )}
                              {submission && submission.is_document_available !== false && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {submission.file_name} • {Math.round((submission.file_size || 0) / 1024)}KB
                                  {submission.version > 1 && <span className="ml-2 text-blue-600">v{submission.version}</span>}
                                </div>
                              )}
                              {submission && submission.is_document_available === false && (
                                <div className="text-xs text-orange-600 mt-1">
                                  Reason: {submission.unavailability_reason || 'Not provided'}
                                </div>
                              )}
                              {submission?.rejection_reason && submission.status === 'rejected' && (
                                <div className="text-xs text-destructive mt-1">
                                  Rejection: {submission.rejection_reason}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={statusInfo.status === 'approved' ? 'default' : statusInfo.status === 'rejected' ? 'destructive' : 'outline'}
                              className="capitalize"
                            >
                              {statusInfo.label}
                            </Badge>
                            
                            {submission && submission.is_document_available !== false && (
                              <div className="flex items-center gap-1 ml-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => viewDocument(submission)}
                                  className="h-8 px-2"
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => downloadDocument(submission)}
                                  className="h-8 px-2"
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  Download
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Per-Document Review Actions */}
                        {canReview && !isReviewing && (
                          <div className="flex items-center gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-600 hover:bg-green-50"
                              onClick={() => handleApproveDocument(submission.id)}
                              disabled={actionLoading}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive hover:bg-destructive/10"
                              onClick={() => setReviewingDocId(doc.id)}
                              disabled={actionLoading}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}

                        {/* Rejection Reason Input */}
                        {isReviewing && (
                          <div className="space-y-2 pt-2 border-t">
                            <Input
                              placeholder="Enter rejection reason..."
                              value={perDocRejectionNotes[doc.id] || ''}
                              onChange={(e) => setPerDocRejectionNotes(prev => ({ ...prev, [doc.id]: e.target.value }))}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectDocument(submission.id, doc.id)}
                                disabled={actionLoading || !perDocRejectionNotes[doc.id]?.trim()}
                              >
                                Confirm Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReviewingDocId(null);
                                  setPerDocRejectionNotes(prev => ({ ...prev, [doc.id]: '' }));
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
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
              {(request.status === 'under_review' || request.status === 'partially_approved') && !showRejectionForm && (
                <>
                  {/* Show Complete Review when all docs are reviewed */}
                  {submissions.length > 0 && submissions.every(s => s.status === 'approved' || s.status === 'rejected') && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="flex-1"
                            onClick={handleCompleteReview}
                            disabled={actionLoading}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Complete Review
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Finalize the review process</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {/* Approve All - only if all docs are pending */}
                  {submissions.length > 0 && submissions.every(s => s.status === 'pending' || s.status === 'resubmitted') && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="flex-1"
                            onClick={handleApprove}
                            disabled={actionLoading}
                          >
                            <ThumbsUp className="mr-2 h-4 w-4" />
                            Approve All
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Approve all documents and this supplier</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="destructive"
                          onClick={() => setShowRejectionForm(true)}
                          disabled={actionLoading}
                        >
                          <ThumbsDown className="mr-2 h-4 w-4" />
                          Decline All
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Decline the entire request</TooltipContent>
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
