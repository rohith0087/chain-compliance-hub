import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, FileText, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DocumentMetadata {
  documentTitle: string;
  originalFileName: string;
  fileSize: number;
  documentType: string;
  uploadedDate: string;
  companyName: string;
  supplierName: string;
  permissionLevel: string;
  signedUrl: string;
}

const SharedDocumentViewer: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [documentData, setDocumentData] = useState<DocumentMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchSharedDocument();
    }
  }, [token]);

  const fetchSharedDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!token) {
        throw new Error('No access token provided');
      }

      // URL decode the token to handle special characters
      const decodedToken = decodeURIComponent(token);

      // Call the edge function to access the shared document
      const { data, error: functionError } = await supabase.functions.invoke('document-link-handler', {
        body: { access_token: decodedToken }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Failed to access document');
      }

      if (!data.success) {
        throw new Error(data.error || 'Document access denied');
      }

      const mapped: DocumentMetadata = {
        documentTitle: data.document?.request_title ?? 'Document',
        originalFileName: data.document?.file_name ?? 'file',
        fileSize: data.document?.file_size ?? 0,
        documentType: data.document?.mime_type ?? 'unknown',
        uploadedDate: data.document?.created_at ?? new Date().toISOString(),
        companyName: data.document?.buyer_company ?? 'Buyer',
        supplierName: data.document?.supplier_company ?? 'Supplier',
        permissionLevel: data.permission_level ?? 'public',
        signedUrl: data.access_url,
      };

      setDocumentData(mapped);
    } catch (err) {
      console.error('Error fetching shared document:', err);
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!documentData?.signedUrl) return;

    try {
      setDownloading(true);
      
      // Fetch the file and trigger download
      const response = await fetch(documentData.signedUrl);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = documentData.originalFileName;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleView = () => {
    if (documentData?.signedUrl) {
      window.open(documentData.signedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPermissionBadgeColor = (permission: string) => {
    switch (permission) {
      case 'public':
        return 'bg-success/15 text-success border-success/30';
      case 'organization':
        return 'bg-primary/15 text-primary border-primary/30';
      case 'admin_only':
        return 'bg-danger/15 text-danger border-danger/30';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <p className="text-sm text-muted-foreground">
                This link may have expired, been deactivated, or you may not have permission to access this document.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Document Not Found</h2>
              <p className="text-muted-foreground">The requested document could not be found.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl text-foreground mb-2">
                  {documentData.documentTitle}
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>From: {documentData.supplierName}</span>
                  <span>•</span>
                  <span>To: {documentData.companyName}</span>
                  <span>•</span>
                  <span>Uploaded: {new Date(documentData.uploadedDate).toLocaleDateString()}</span>
                </div>
              </div>
              <Badge className={getPermissionBadgeColor(documentData.permissionLevel)}>
                {documentData.permissionLevel.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Document Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium text-muted-foreground">File Name</p>
                <p className="text-sm text-foreground">{documentData.originalFileName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">File Size</p>
                <p className="text-sm text-foreground">{formatFileSize(documentData.fileSize)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Document Type</p>
                <p className="text-sm text-foreground">{documentData.documentType}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Permission Level</p>
                <p className="text-sm text-foreground capitalize">
                  {documentData.permissionLevel.replace('_', ' ')}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={handleView} className="flex-1">
                <Eye className="w-4 h-4 mr-2" />
                View Document
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDownload}
                disabled={downloading}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                {downloading ? 'Downloading...' : 'Download'}
              </Button>
            </div>

            {/* Security Notice */}
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Security Notice:</strong> This is a shared document link. 
                Please verify the authenticity of this document with the sender if you have any concerns.
                Do not share this link with unauthorized parties.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SharedDocumentViewer;