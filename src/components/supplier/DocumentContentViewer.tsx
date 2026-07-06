import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Download, RefreshCw, Calendar, Tag, FileType, HardDrive } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentContentViewerProps {
  document: {
    id: string;
    document_name: string;
    document_type: string;
    file_path: string;
    file_size: number;
    category: string;
    tags: string[];
    description: string;
    version: number;
    extraction_status: string;
    content_extracted: string;
    content_summary: string;
    created_at: string;
    updated_at: string;
  };
  onClose: () => void;
}

export const DocumentContentViewer: React.FC<DocumentContentViewerProps> = ({
  document,
  onClose
}) => {
  const [processing, setProcessing] = useState(false);
  const [documentData, setDocumentData] = useState(document);

  useEffect(() => {
    setDocumentData(document);
  }, [document]);

  const handleReprocessDocument = async () => {
    try {
      setProcessing(true);
      
      const { error } = await supabase.functions.invoke('document-content-extractor', {
        body: {
          document_id: documentData.id,
          file_path: documentData.file_path
        }
      });

      if (error) {
        console.error('Reprocessing error:', error);
        toast.error('Failed to reprocess document');
        return;
      }

      // Update status
      await supabase
        .from('supplier_document_library')
        .update({ extraction_status: 'processing' })
        .eq('id', documentData.id);

      setDocumentData(prev => ({ ...prev, extraction_status: 'processing' }));
      toast.success('Document reprocessing started');

      // Poll for updates
      const pollInterval = setInterval(async () => {
        const { data } = await supabase
          .from('supplier_document_library')
          .select('extraction_status, content_extracted, content_summary')
          .eq('id', documentData.id)
          .single();

        if (data) {
          setDocumentData(prev => ({
            ...prev,
            extraction_status: data.extraction_status,
            content_extracted: data.content_extracted || prev.content_extracted,
            content_summary: data.content_summary || prev.content_summary
          }));

          if (data.extraction_status !== 'processing') {
            clearInterval(pollInterval);
            setProcessing(false);
          }
        }
      }, 2000);

      // Clear interval after 30 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
        setProcessing(false);
      }, 30000);

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to reprocess document');
      setProcessing(false);
    }
  };

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-documents')
        .download(documentData.file_path);

      if (error) {
        console.error('Error downloading file:', error);
        toast.error('Failed to download document');
        return;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = documentData.document_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to download document');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-muted text-foreground';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {documentData.document_name}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {documentData.description}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Badge className={getStatusColor(documentData.extraction_status)}>
                {documentData.extraction_status}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="content" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="flex-1 overflow-hidden">
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex items-center justify-between flex-shrink-0">
                <h3 className="text-lg font-medium">Extracted Content</h3>
                {documentData.extraction_status === 'failed' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleReprocessDocument}
                    disabled={processing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${processing ? 'animate-spin' : ''}`} />
                    Reprocess
                  </Button>
                )}
              </div>
              
              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-4">
                  {documentData.content_extracted ? (
                    <div className="whitespace-pre-wrap text-sm">
                      {documentData.content_extracted}
                    </div>
                  ) : documentData.extraction_status === 'processing' ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Processing document content...</p>
                    </div>
                  ) : documentData.extraction_status === 'failed' ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Content extraction failed. Click "Reprocess" to try again.</p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Content extraction is pending...</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="summary" className="flex-1">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">AI-Generated Summary</h3>
              <div className="border rounded-lg p-4">
                {documentData.content_summary ? (
                  <p className="text-sm leading-relaxed">{documentData.content_summary}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Summary will be available after content extraction is completed.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="metadata" className="flex-1">
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Document Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <FileType className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Document Type</p>
                      <p className="text-sm text-muted-foreground">{documentData.document_type.toUpperCase()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">File Size</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(documentData.file_size)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Category</p>
                      <p className="text-sm text-muted-foreground">{documentData.category}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Created</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(documentData.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Last Updated</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(documentData.updated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium mb-2">Version</p>
                    <Badge variant="outline">v{documentData.version}</Badge>
                  </div>
                </div>
              </div>
              
              {documentData.tags && documentData.tags.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {documentData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};