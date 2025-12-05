import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  Download, 
  CheckCircle, 
  XCircle, 
  Clock,
  FileText,
  AlertTriangle,
  ChevronRight,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { resolveStoragePath } from '@/utils/storagePath';

interface DocumentUpload {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  status: string;
  created_at: string;
  expiration_date?: string;
  reviewer_notes?: string;
  version?: number;
  uploader?: {
    full_name: string;
  };
}

interface DocumentVersionHistoryProps {
  documentTitle: string;
  uploads: DocumentUpload[];
}

const DocumentVersionHistory = ({ 
  documentTitle, 
  uploads
}: DocumentVersionHistoryProps) => {
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Sort uploads by created_at descending (newest first) and assign version numbers
  const sortedUploads = [...uploads]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((upload, index, arr) => ({
      ...upload,
      versionNumber: arr.length - index,
      uploadYear: new Date(upload.created_at).getFullYear()
    }));

  // Group uploads by year
  const uploadsByYear = sortedUploads.reduce((acc, upload) => {
    const year = upload.uploadYear;
    if (!acc[year]) acc[year] = [];
    acc[year].push(upload);
    return acc;
  }, {} as Record<number, typeof sortedUploads>);

  const sortedYears = Object.keys(uploadsByYear)
    .map(Number)
    .sort((a, b) => b - a); // Most recent year first

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved':
        return { 
          icon: CheckCircle, 
          color: 'text-green-600', 
          bgColor: 'bg-green-100',
          label: 'Approved'
        };
      case 'rejected':
        return { 
          icon: XCircle, 
          color: 'text-red-600', 
          bgColor: 'bg-red-100',
          label: 'Rejected'
        };
      case 'pending_review':
      case 'submitted':
        return { 
          icon: Clock, 
          color: 'text-blue-600', 
          bgColor: 'bg-blue-100',
          label: 'Pending Review'
        };
      default:
        return { 
          icon: FileText, 
          color: 'text-gray-600', 
          bgColor: 'bg-gray-100',
          label: status
        };
    }
  };

  const handleViewVersion = async (upload: DocumentUpload & { versionNumber: number }) => {
    setViewingId(upload.id);
    try {
      const resolvedPath = resolveStoragePath(upload.file_path);
      if (!resolvedPath) {
        throw new Error('Invalid file path');
      }
      
      const { data: urlData, error: urlError } = await supabase.storage
        .from(resolvedPath.bucket)
        .createSignedUrl(resolvedPath.key, 300);

      if (urlError || !urlData?.signedUrl) {
        throw new Error('Failed to generate view URL');
      }

      window.open(urlData.signedUrl, '_blank');
    } catch (error) {
      console.error('Error viewing version:', error);
      toast({
        title: "View Failed",
        description: "Could not open this version. Please try again.",
        variant: "destructive"
      });
    } finally {
      setViewingId(null);
    }
  };

  const handleDownloadVersion = async (upload: DocumentUpload & { versionNumber: number }) => {
    setDownloadingId(upload.id);
    try {
      const resolvedPath = resolveStoragePath(upload.file_path);
      if (!resolvedPath) {
        throw new Error('Invalid file path');
      }
      
      const { data: urlData, error: urlError } = await supabase.storage
        .from(resolvedPath.bucket)
        .createSignedUrl(resolvedPath.key, 60);

      if (urlError || !urlData?.signedUrl) {
        throw new Error('Failed to generate download URL');
      }

      const response = await fetch(urlData.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `v${upload.versionNumber}_${upload.file_name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: `Downloading version ${upload.versionNumber} of ${upload.file_name}`
      });
    } catch (error) {
      console.error('Error downloading version:', error);
      toast({
        title: "Download Failed",
        description: "Could not download this version. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDownloadingId(null);
    }
  };

  if (uploads.length <= 1) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-xs gap-1.5"
        >
          <History className="w-3.5 h-3.5" />
          {uploads.length} versions
          <ChevronRight className="w-3 h-3" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Version History
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{documentTitle}</p>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] mt-6 pr-4">
          <div className="space-y-6">
            {sortedYears.map((year, yearIndex) => (
              <div key={year}>
                {/* Year Header */}
                <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={yearIndex === 0 ? "default" : "secondary"}
                      className="text-sm px-3 py-1"
                    >
                      {year}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {uploadsByYear[year].length} version{uploadsByYear[year].length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {uploadsByYear[year].map((upload, index) => {
                    const statusConfig = getStatusConfig(upload.status);
                    const StatusIcon = statusConfig.icon;
                    const isLatest = yearIndex === 0 && index === 0;

                    return (
                      <div 
                        key={upload.id}
                        className={`relative p-4 rounded-lg border ${
                          isLatest ? 'border-primary/50 bg-primary/5' : 'border-border'
                        }`}
                      >
                        {/* Version indicator line */}
                        {index < uploadsByYear[year].length - 1 && (
                          <div className="absolute left-7 top-16 w-0.5 h-[calc(100%-32px)] bg-border" />
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            {/* Version number circle */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                              isLatest 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              V{upload.versionNumber}
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isLatest && (
                                  <Badge variant="default" className="text-xs">
                                    Current
                                  </Badge>
                                )}
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${statusConfig.bgColor} ${statusConfig.color}`}
                                >
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {statusConfig.label}
                                </Badge>
                              </div>

                              <p className="text-sm font-medium truncate max-w-[200px]">
                                {upload.file_name}
                              </p>

                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatDate(upload.created_at)}</span>
                                {upload.file_size && (
                                  <>
                                    <span>•</span>
                                    <span>{formatFileSize(upload.file_size)}</span>
                                  </>
                                )}
                              </div>

                              {upload.uploader?.full_name && (
                                <p className="text-xs text-muted-foreground">
                                  Uploaded by: {upload.uploader.full_name}
                                </p>
                              )}

                              {/* Rejection reason */}
                              {upload.status === 'rejected' && upload.reviewer_notes && (
                                <div className="mt-2 p-2 rounded bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900">
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs font-medium text-red-800 dark:text-red-400">
                                        Rejection Reason:
                                      </p>
                                      <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                                        {upload.reviewer_notes}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewVersion(upload)}
                              disabled={viewingId === upload.id}
                              title="View document"
                            >
                              {viewingId === upload.id ? (
                                <Clock className="w-4 h-4 animate-spin" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadVersion(upload)}
                              disabled={downloadingId === upload.id}
                              title="Download document"
                            >
                              {downloadingId === upload.id ? (
                                <Clock className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Expiration date */}
                        {upload.expiration_date && (
                          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                            Expiration: {new Date(upload.expiration_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default DocumentVersionHistory;