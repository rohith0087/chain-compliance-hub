import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { resolveStoragePath } from "@/utils/storagePath";
import { 
  Download, 
  FileText, 
  Loader2, 
  AlertCircle, 
  Calendar, 
  Building,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X
} from "lucide-react";
import { format } from "date-fns";

interface DocumentReference {
  id: string;
  title: string;
  supplier_name?: string;
  document_type: string;
  expiration_date?: string;
  status: string;
  file_path?: string;
  metadata?: any;
}

interface ChatDocumentViewerProps {
  document: DocumentReference | null;
  isOpen: boolean;
  onClose: () => void;
}

const ChatDocumentViewer = ({ document, isOpen, onClose }: ChatDocumentViewerProps) => {
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (isOpen && document?.file_path) {
      loadDocument();
    } else {
      setDocumentUrl(null);
      setError(null);
      setZoom(100);
    }
  }, [isOpen, document]);

  const loadDocument = async () => {
    if (!document?.file_path) return;

    setIsLoading(true);
    setError(null);

    try {
      const pathInfo = resolveStoragePath(document.file_path);
      if (!pathInfo) throw new Error('Invalid file path');

      const { data, error } = await supabase.functions.invoke('secure-document-url', {
        body: { bucket: pathInfo.bucket, key: pathInfo.key, expiresIn: 3600 },
      });

      if (error) throw error as any;

      if (data?.url) {
        setDocumentUrl(data.url);
      } else {
        throw new Error('No URL returned');
      }
    } catch (err) {
      console.error('Error loading document:', err);
      setError("We couldn’t open this document. It may have moved or you might not have access.");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadDocument = async () => {
    if (!documentUrl || !document) return;

    try {
      const response = await fetch(documentUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.title || 'document';
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading document:', err);
    }
  };

  const getFileType = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop() || '';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    return 'other';
  };

  const renderDocumentViewer = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading document...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={loadDocument} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    if (!documentUrl || !document) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No document to display</p>
          </div>
        </div>
      );
    }

    const fileType = getFileType(document.file_path || '');

    if (fileType === 'pdf') {
      return (
        <div className="relative h-96 md:h-[500px] lg:h-[600px]">
          <iframe
            src={documentUrl}
            className="w-full h-full border-0 rounded-md"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
            title={document.title}
          />
        </div>
      );
    }

    if (fileType === 'image') {
      return (
        <div className="relative h-96 md:h-[500px] lg:h-[600px] flex items-center justify-center bg-muted/20 rounded-md">
          <img
            src={documentUrl}
            alt={document.title}
            className="max-w-full max-h-full object-contain rounded-md"
            style={{ transform: `scale(${zoom / 100})` }}
          />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <FileText className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Preview not available for this file type</p>
          <Button onClick={downloadDocument} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Download to View
          </Button>
        </div>
      </div>
    );
  };

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-primary" />
                {document.title}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Inline document preview — press Esc to close and continue chatting.
              </DialogDescription>
              
              <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                {document.supplier_name && (
                  <div className="flex items-center gap-1">
                    <Building className="w-4 h-4" />
                    <span>{document.supplier_name}</span>
                  </div>
                )}
                
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  {document.document_type}
                </Badge>
                
                {document.expiration_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Expires: {format(new Date(document.expiration_date), 'MMM dd, yyyy')}</span>
                  </div>
                )}
                
                <Badge 
                  variant="outline" 
                  className={`capitalize ${
                    document.status === 'approved' ? 'border-success text-success' :
                    document.status === 'pending_review' ? 'border-warning text-warning' :
                    'border-danger text-danger'
                  }`}
                >
                  {document.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {documentUrl && (
                <>
                  <Button
                    onClick={() => setZoom(Math.max(50, zoom - 25))}
                    variant="outline"
                    size="sm"
                    disabled={zoom <= 50}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  
                  <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                    {zoom}%
                  </span>
                  
                  <Button
                    onClick={() => setZoom(Math.min(200, zoom + 25))}
                    variant="outline"
                    size="sm"
                    disabled={zoom >= 200}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  
                  <Separator orientation="vertical" className="h-6" />
                  
                  <Button onClick={downloadDocument} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <Separator />
        
        <ScrollArea className="flex-1 p-6">
          {renderDocumentViewer()}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ChatDocumentViewer;