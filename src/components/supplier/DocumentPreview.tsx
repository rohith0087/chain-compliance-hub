
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  FileText, 
  Image as ImageIcon, 
  Download, 
  Eye, 
  Calendar,
  User,
  FileCheck,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DocumentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
}

const DocumentPreview = ({ isOpen, onClose, request }: DocumentPreviewProps) => {
  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && request) {
      loadUploads();
    }
  }, [isOpen, request]);

  const loadUploads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_uploads')
        .select('*')
        .eq('request_id', request.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUploads(data || []);
    } catch (error) {
      console.error('Error loading uploads:', error);
      toast({
        title: "Error",
        description: "Failed to load document uploads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) {
      return <ImageIcon className="w-8 h-8 text-primary" />;
    }
    return <FileText className="w-8 h-8 text-muted-foreground" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success/15 text-success';
      case 'pending_review': return 'bg-warning/15 text-warning';
      case 'rejected': return 'bg-danger/15 text-danger';
      default: return 'bg-muted text-foreground';
    }
  };

  const handleDownload = async (upload: any) => {
    try {
      // For now, create a blob URL since we don't have actual file storage
      // In a real implementation, you'd download from Supabase Storage
      const blob = new Blob(['Document content placeholder'], { type: upload.mime_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = upload.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download Started",
        description: `Downloading ${upload.file_name}`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download the document",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5" />
            Document Preview - {request.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Request Summary */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Document Type</p>
                  <p className="text-sm">{request.document_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Category</p>
                  <p className="text-sm">{request.category}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(request.status)} variant="secondary">
                    {request.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                  <p className="text-sm">{request.due_date ? formatDate(request.due_date) : 'No due date'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Uploaded Documents */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Uploaded Documents ({uploads.length})</h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading documents...</p>
              </div>
            ) : uploads.length > 0 ? (
              <div className="space-y-4">
                {uploads.map((upload) => (
                  <Card key={upload.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          {getFileIcon(upload.mime_type)}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground truncate">{upload.file_name}</h4>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(upload.created_at)}
                              </span>
                              <span>{formatFileSize(upload.file_size || 0)}</span>
                              <Badge className={getStatusColor(upload.status)} variant="outline">
                                {upload.status}
                              </Badge>
                            </div>
                            {upload.reviewer_notes && (
                              <div className="mt-2 p-2 bg-muted rounded text-sm">
                                <p className="font-medium text-foreground/80">Notes:</p>
                                <p className="text-muted-foreground">{upload.reviewer_notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(upload)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                          {upload.mime_type?.startsWith('image/') && (
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              Preview
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-muted-foreground/70 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Documents Uploaded</h3>
                <p className="text-muted-foreground">No documents have been uploaded for this request yet.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreview;
