import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Download, FileText, Loader2, ExternalLink, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SampleDocumentViewerProps {
  requestId: string;
  fileName: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedAt?: string | null;
  notes?: string | null;
  className?: string;
}

const SampleDocumentViewer = ({
  requestId,
  fileName,
  fileSize,
  mimeType,
  uploadedAt,
  notes,
  className = ''
}: SampleDocumentViewerProps) => {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const fetchSignedUrl = async (): Promise<string | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('secure-sample-url', {
        body: { request_id: requestId }
      });

      if (error) {
        console.error('Error fetching signed URL:', error);
        toast({
          title: 'Error',
          description: 'Failed to access sample document. Please try again.',
          variant: 'destructive'
        });
        return null;
      }

      return data.signed_url;
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: 'Error',
        description: 'Failed to access sample document.',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    const url = await fetchSignedUrl();
    if (url) {
      // For PDFs and images, show in dialog
      if (mimeType?.startsWith('image/') || mimeType === 'application/pdf') {
        setPreviewUrl(url);
        setShowPreview(true);
      } else {
        // For other file types, open in new tab
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleDownload = async () => {
    const url = await fetchSignedUrl();
    if (url) {
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'sample-document';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isPreviewable = mimeType?.startsWith('image/') || mimeType === 'application/pdf';

  return (
    <>
      <Card className={`border-primary/20 bg-primary/10 ${className}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-primary">
            <FileText className="w-4 h-4" />
            Reference Document from Buyer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* File info and actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{fileName || 'Sample Document'}</p>
                {fileSize && (
                  <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePreview}
                disabled={loading}
                className="bg-card dark:bg-background"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPreviewable ? (
                  <>
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Open
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownload}
                disabled={loading}
                className="bg-card dark:bg-background"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Buyer's notes */}
          {notes && (
            <div className="text-sm bg-card/60 dark:bg-background/40 p-3 rounded-md border border-primary/20">
              <p className="font-medium text-primary mb-1">Buyer's Instructions:</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {/* Upload timestamp */}
          {uploadedAt && (
            <div className="flex items-center gap-1 text-xs text-primary">
              <Calendar className="w-3 h-3" />
              Sample uploaded: {format(new Date(uploadedAt), 'PPP')}
            </div>
          )}

          {/* Guidance text */}
          <p className="text-xs text-primary italic">
            Use this sample as a reference for the expected format and content of your document.
          </p>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {fileName || 'Sample Document'}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {previewUrl && mimeType?.startsWith('image/') && (
              <img
                src={previewUrl}
                alt="Sample document preview"
                className="max-w-full h-auto rounded-lg border"
              />
            )}
            {previewUrl && mimeType === 'application/pdf' && (
              <iframe
                src={previewUrl}
                className="w-full h-[70vh] rounded-lg border"
                title="Sample document preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SampleDocumentViewer;
