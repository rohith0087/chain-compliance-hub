import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Upload, 
  CheckCircle, 
  XCircle, 
  Download, 
  Link, 
  Eye,
  Clock,
  User,
  Calendar,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { resolveStoragePath } from '@/utils/storagePath';

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

interface DocumentActivityChainProps {
  isOpen: boolean;
  onClose: () => void;
  documentRequestId: string | null;
  documentTitle?: string;
  supplierName?: string;
}

const DocumentActivityChain = ({ 
  isOpen, 
  onClose, 
  documentRequestId,
  documentTitle,
  supplierName
}: DocumentActivityChainProps) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [documentInfo, setDocumentInfo] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && documentRequestId) {
      fetchActivityChain();
    }
  }, [isOpen, documentRequestId]);

  const fetchActivityChain = async () => {
    if (!documentRequestId) return;
    
    setLoading(true);
    try {
      // First get the document request info
      const { data: requestData } = await supabase
        .from('document_requests')
        .select(`
          *,
          supplier:suppliers(company_name),
          document_uploads(id, file_name, file_path, created_at)
        `)
        .eq('id', documentRequestId)
        .single();

      if (requestData) {
        setDocumentInfo(requestData);
      }

      // Fetch activities linked to this request (directly or via upload)
      const uploadIds = requestData?.document_uploads?.map((u: any) => u.id).filter(Boolean) || [];
      
      let query = supabase
        .from('document_activity_logs')
        .select(`
          *,
          user:profiles!document_activity_logs_user_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: true });

      // Apply filter based on whether we have upload IDs
      if (uploadIds.length > 0) {
        query = query.or(`document_request_id.eq.${documentRequestId},document_upload_id.in.(${uploadIds.join(',')})`);
      } else {
        query = query.eq('document_request_id', documentRequestId);
      }

      const { data: activityData, error } = await query;

      if (error) {
        console.error('Error fetching activities:', error);
        return;
      }

      setActivities(activityData || []);
    } catch (error) {
      console.error('Error loading activity chain:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'requested': return <FileText className="h-4 w-4" />;
      case 'uploaded': return <Upload className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'downloaded': return <Download className="h-4 w-4" />;
      case 'link_created': return <Link className="h-4 w-4" />;
      case 'link_accessed': return <Eye className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'requested': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'uploaded': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'downloaded': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'link_created': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'link_accessed': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-muted text-foreground/80 border-border';
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'requested': return 'Request Created';
      case 'uploaded': return 'Document Uploaded';
      case 'approved': return 'Document Approved';
      case 'rejected': return 'Document Declined';
      case 'downloaded': return 'Document Downloaded';
      case 'link_created': return 'Share Link Created';
      case 'link_accessed': return 'Link Accessed';
      default: return actionType;
    }
  };

  const handleDownload = async () => {
    const upload = documentInfo?.document_uploads?.[0];
    if (!upload?.file_path) {
      toast({
        title: "No File Available",
        description: "This document has not been uploaded yet.",
        variant: "destructive"
      });
      return;
    }

    try {
      const resolved = resolveStoragePath(upload.file_path);
      if (!resolved) throw new Error('Invalid file path');

      const { data: signed, error } = await supabase.storage
        .from(resolved.bucket)
        .createSignedUrl(resolved.key, 60, { download: upload.file_name });

      if (error) throw error;

      const a = document.createElement('a');
      a.href = signed.signedUrl;
      a.download = upload.file_name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: `Downloading ${upload.file_name}`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download the document",
        variant: "destructive"
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Activity History
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Document Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Document Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <Badge variant="outline">{documentTitle || documentInfo?.document_type || 'Unknown'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Supplier</span>
                <span className="text-sm font-medium">{supplierName || documentInfo?.supplier?.company_name || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge 
                  variant={documentInfo?.status === 'approved' ? 'default' : documentInfo?.status === 'rejected' ? 'destructive' : 'secondary'}
                >
                  {documentInfo?.status || 'Unknown'}
                </Badge>
              </div>
              {documentInfo?.document_uploads?.[0]?.file_name && (
                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Document
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Activity Timeline */}
          <div>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Activity Timeline ({activities.length} events)
            </h3>
            
            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-muted-foreground">Loading activity...</span>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No activity history available</p>
                  <p className="text-xs text-muted-foreground mt-1">Legacy documents may not have activity logs</p>
                </div>
              ) : (
                <div className="relative space-y-4">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  
                  {activities.map((activity, index) => (
                    <div key={activity.id} className="relative flex gap-4 pl-10">
                      {/* Timeline dot */}
                      <div className={`absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${getActionColor(activity.action_type)}`}>
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
                        
                        {/* Notes/Comments */}
                        {activity.notes && (
                          <div className="mt-2 p-2 bg-background/50 rounded text-xs">
                            <div className="flex items-start gap-1">
                              <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground" />
                              <span>{activity.notes}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Metadata details for specific actions */}
                        {activity.action_type === 'link_created' && activity.metadata && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <span>Permission: {activity.metadata.permission_level || 'view'}</span>
                            {activity.metadata.expires_at && (
                              <span className="ml-2">
                                Expires: {format(new Date(activity.metadata.expires_at), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {activity.action_type === 'uploaded' && activity.metadata?.file_name && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            File: {activity.metadata.file_name}
                            {activity.metadata.file_size && (
                              <span className="ml-2">({Math.round(activity.metadata.file_size / 1024)} KB)</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DocumentActivityChain;
