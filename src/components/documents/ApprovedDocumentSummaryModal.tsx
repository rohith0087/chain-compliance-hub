import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FileText,
  Eye,
  Download,
  Link,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  User,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Loader2,
  Upload,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface DocumentUpload {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  status: string;
  version?: number;
  content_summary?: string;
  content_extraction_status?: string;
  content_extracted_at?: string;
  expiration_date?: string;
  created_at: string;
  reviewer_notes?: string;
  uploader?: {
    full_name: string;
  };
}

interface ActivityLog {
  id: string;
  action_type: string;
  created_at: string;
  notes: string | null;
  metadata: any;
  user?: {
    full_name: string | null;
    email: string | null;
  };
}

interface ApprovedDocumentSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    document_type: string;
    title?: string;
    category?: string;
    created_at: string;
    supplier?: { company_name: string };
    document_uploads?: DocumentUpload[];
  } | null;
  onView: () => void;
  onDownload: () => void;
  onCreateLink: () => void;
}

const ApprovedDocumentSummaryModal = ({
  isOpen,
  onClose,
  document,
  onView,
  onDownload,
  onCreateLink,
}: ApprovedDocumentSummaryModalProps) => {
  const [previousVersionsOpen, setPreviousVersionsOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Get versions sorted and categorized
  const getVersionsWithSummaries = (uploads: DocumentUpload[] | undefined) => {
    if (!uploads || uploads.length === 0) return { current: null, previous: [] };

    // Sort by version DESC (newest first)
    const sorted = [...uploads].sort((a, b) => (b.version || 0) - (a.version || 0));

    // Find the latest approved version (this is "current")
    const currentApproved = sorted.find((u) => u.status === 'approved');

    // All other versions are "previous"
    const previous = sorted.filter((u) => u.id !== currentApproved?.id);

    return { current: currentApproved || sorted[0], previous };
  };

  const { current, previous } = getVersionsWithSummaries(document?.document_uploads);

  // Fetch activity logs when modal opens
  useEffect(() => {
    if (isOpen && document?.id) {
      fetchActivityChain();
    }
  }, [isOpen, document?.id]);

  const fetchActivityChain = async () => {
    if (!document?.id) return;

    setLoadingActivities(true);
    try {
      const uploadIds = document.document_uploads?.map((u) => u.id).filter(Boolean) || [];

      let query = supabase
        .from('document_activity_logs')
        .select(
          `
          *,
          user:profiles!document_activity_logs_user_id_fkey(full_name, email)
        `
        )
        .order('created_at', { ascending: false });

      if (uploadIds.length > 0) {
        query = query.or(
          `document_request_id.eq.${document.id},document_upload_id.in.(${uploadIds.join(',')})`
        );
      } else {
        query = query.eq('document_request_id', document.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching activities:', error);
        return;
      }

      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activity chain:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

  const getExtractionStatusDisplay = (status?: string) => {
    switch (status) {
      case 'completed':
        return {
          icon: <Sparkles className="h-4 w-4 text-[hsl(var(--green-accent))]" />,
          label: 'AI Analyzed',
          className: 'bg-[hsl(var(--green-accent))]/10 text-[hsl(var(--green-accent))] border-[hsl(var(--green-accent))]/30',
        };
      case 'processing':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--blue-accent))]" />,
          label: 'Analyzing...',
          className: 'bg-[hsl(var(--blue-accent))]/10 text-[hsl(var(--blue-accent))] border-[hsl(var(--blue-accent))]/30',
        };
      case 'pending':
        return {
          icon: <Clock className="h-4 w-4 text-[hsl(var(--orange-accent))]" />,
          label: 'Pending Analysis',
          className: 'bg-[hsl(var(--orange-accent))]/10 text-[hsl(var(--orange-accent))] border-[hsl(var(--orange-accent))]/30',
        };
      case 'failed':
        return {
          icon: <AlertCircle className="h-4 w-4 text-destructive" />,
          label: 'Analysis Failed',
          className: 'bg-destructive/10 text-destructive border-destructive/30',
        };
      default:
        return {
          icon: <FileText className="h-4 w-4 text-muted-foreground" />,
          label: 'No Summary',
          className: 'bg-muted text-muted-foreground border-muted',
        };
    }
  };

  const getVersionStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-[hsl(var(--green-accent))]/10 text-[hsl(var(--green-accent))] border-[hsl(var(--green-accent))]/30 border">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/30 border">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'requested':
        return <FileText className="h-4 w-4" />;
      case 'uploaded':
        return <Upload className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'downloaded':
        return <Download className="h-4 w-4" />;
      case 'link_created':
        return <Link className="h-4 w-4" />;
      case 'link_accessed':
        return <Eye className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'requested':
        return 'bg-[hsl(var(--blue-accent))]/10 text-[hsl(var(--blue-accent))] border-[hsl(var(--blue-accent))]/30';
      case 'uploaded':
        return 'bg-[hsl(var(--pink-accent))]/10 text-[hsl(var(--pink-accent))] border-[hsl(var(--pink-accent))]/30';
      case 'approved':
        return 'bg-[hsl(var(--green-accent))]/10 text-[hsl(var(--green-accent))] border-[hsl(var(--green-accent))]/30';
      case 'rejected':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'downloaded':
        return 'bg-[hsl(var(--orange-accent))]/10 text-[hsl(var(--orange-accent))] border-[hsl(var(--orange-accent))]/30';
      case 'link_created':
        return 'bg-[hsl(var(--teal-accent))]/10 text-[hsl(var(--teal-accent))] border-[hsl(var(--teal-accent))]/30';
      case 'link_accessed':
        return 'bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'requested':
        return 'Request Created';
      case 'uploaded':
        return 'Document Uploaded';
      case 'approved':
        return 'Document Approved';
      case 'rejected':
        return 'Document Declined';
      case 'downloaded':
        return 'Document Downloaded';
      case 'link_created':
        return 'Share Link Created';
      case 'link_accessed':
        return 'Link Accessed';
      default:
        return actionType;
    }
  };

  if (!document) return null;

  const extractionStatus = getExtractionStatusDisplay(current?.content_extraction_status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader className="space-y-3">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[hsl(var(--green-accent))]/20 to-[hsl(var(--emerald-accent))]/20 rounded-xl flex items-center justify-center">
              <FileText className="h-6 w-6 text-[hsl(var(--green-accent))]" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">
                {document.title || document.document_type}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                {document.supplier && (
                  <span className="text-sm text-muted-foreground">
                    {document.supplier.company_name}
                  </span>
                )}
                <Badge className="bg-[hsl(var(--green-accent))]/10 text-[hsl(var(--green-accent))] border-[hsl(var(--green-accent))]/30 border">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approved
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs defaultValue="summary" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {/* Current Version Summary */}
                <Card className="border-[hsl(var(--green-accent))]/30 bg-gradient-to-br from-[hsl(var(--green-accent))]/5 to-transparent">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-medium">
                          V{current?.version || 1} — Current
                        </Badge>
                        <Badge className={`${extractionStatus.className} border`}>
                          {extractionStatus.icon}
                          <span className="ml-1">{extractionStatus.label}</span>
                        </Badge>
                      </div>
                    </div>

                    {/* Summary Content */}
                    {current?.content_extraction_status === 'completed' && current?.content_summary ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-background rounded-lg border">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {current.content_summary}
                          </p>
                        </div>
                      </div>
                    ) : current?.content_extraction_status === 'processing' ? (
                      <div className="p-4 bg-background rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--blue-accent))]" />
                          <div>
                            <p className="text-sm font-medium">Analyzing document...</p>
                            <p className="text-xs text-muted-foreground">
                              AI is extracting content and generating a summary
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : current?.content_extraction_status === 'pending' ? (
                      <div className="p-4 bg-background rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-[hsl(var(--orange-accent))]" />
                          <div>
                            <p className="text-sm font-medium">Summary pending</p>
                            <p className="text-xs text-muted-foreground">
                              Document queued for AI analysis
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-background rounded-lg border">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">No summary available</p>
                            <p className="text-xs text-muted-foreground">
                              This document was uploaded before AI analysis was enabled
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Document Details */}
                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Uploaded:</span>
                        <span>{formatDate(current?.created_at)}</span>
                      </div>
                      {current?.expiration_date && (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Expires:</span>
                          <span>{formatDate(current.expiration_date)}</span>
                        </div>
                      )}
                      {current?.file_size && (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Size:</span>
                          <span>{formatFileSize(current.file_size)}</span>
                        </div>
                      )}
                      {current?.uploader?.full_name && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">By:</span>
                          <span>{current.uploader.full_name}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Previous Versions */}
                {previous.length > 0 && (
                  <Collapsible open={previousVersionsOpen} onOpenChange={setPreviousVersionsOpen}>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors w-full p-2 rounded-lg hover:bg-muted/50">
                      {previousVersionsOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      Previous Versions ({previous.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 mt-2">
                      {previous.map((version) => {
                        const versionExtractionStatus = getExtractionStatusDisplay(
                          version.content_extraction_status
                        );
                        return (
                          <Card key={version.id} className="border-muted">
                            <CardContent className="pt-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    V{version.version || 1}
                                  </Badge>
                                  {getVersionStatusBadge(version.status)}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(version.created_at)}
                                </span>
                              </div>

                              {version.content_summary ? (
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                  {version.content_summary}
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">
                                  No summary available
                                </p>
                              )}

                              {version.status === 'rejected' && version.reviewer_notes && (
                                <div className="mt-2 p-2 bg-destructive/10 rounded-md border border-destructive/30">
                                  <div className="flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                                    <p className="text-xs text-destructive">
                                      {version.reviewer_notes}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {loadingActivities ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">No activity history</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Legacy documents may not have activity logs
                  </p>
                </div>
              ) : (
                <div className="relative space-y-4">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                  {activities.map((activity) => (
                    <div key={activity.id} className="relative flex gap-4 pl-10">
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${getActionColor(activity.action_type)}`}
                      >
                        {getActionIcon(activity.action_type)}
                      </div>

                      {/* Activity content */}
                      <div className={`flex-1 p-3 rounded-lg border ${getActionColor(activity.action_type)}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-medium">
                              {getActionLabel(activity.action_type)}
                            </h4>
                            {activity.user?.full_name && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {activity.user.full_name}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(activity.created_at), 'MMM d, HH:mm')}
                          </span>
                        </div>

                        {activity.notes && (
                          <div className="mt-2 p-2 bg-background/50 rounded text-xs">
                            <div className="flex items-start gap-1">
                              <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground" />
                              <span>{activity.notes}</span>
                            </div>
                          </div>
                        )}

                        {activity.action_type === 'uploaded' && activity.metadata?.file_name && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            File: {activity.metadata.file_name}
                            {activity.metadata.version && ` (V${activity.metadata.version})`}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={onCreateLink}>
            <Link className="h-4 w-4 mr-2" />
            Create Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApprovedDocumentSummaryModal;
