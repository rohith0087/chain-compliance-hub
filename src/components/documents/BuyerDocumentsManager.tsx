
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Filter,
  RefreshCw
} from 'lucide-react';
import DocumentsFilter from './DocumentsFilter';
import DocumentCard from './DocumentCard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { resolveStoragePath } from '@/utils/storagePath';
interface BuyerDocumentsManagerProps {
  documents: any[];
  onApprove: (documentId: string) => Promise<void>;
  onDecline: (documentId: string) => void;
  onRefresh: () => Promise<void>;
  approveLoading?: string | null;
  declineLoading?: string | null;
}

const BuyerDocumentsManager = ({ 
  documents, 
  onApprove, 
  onDecline, 
  onRefresh,
  approveLoading,
  declineLoading 
}: BuyerDocumentsManagerProps) => {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category: '',
    documentType: '',
    supplier: '',
    expirationStatus: '',
    dateRange: ''
  });
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  // Filter documents based on current filters
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !filters.search || 
      doc.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      doc.document_type.toLowerCase().includes(filters.search.toLowerCase()) ||
      doc.suppliers?.company_name?.toLowerCase().includes(filters.search.toLowerCase());

    const matchesStatus = !filters.status || doc.status === filters.status;
    const matchesCategory = !filters.category || doc.category === filters.category;
    const matchesDocumentType = !filters.documentType || doc.document_type === filters.documentType;

    return matchesSearch && matchesStatus && matchesCategory && matchesDocumentType;
  });

  const handleView = async (doc: any) => {
    console.log('View document:', doc.id);
    console.log('Document uploads:', doc.document_uploads);
    const uploads = doc.document_uploads || [];
    const upload = uploads.length > 1
      ? uploads.slice().sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]
      : uploads[0];
    console.log('Selected upload data:', upload);
    
    if (!upload?.file_path) {
      console.log('No file_path found:', upload);
      toast({
        title: "Error",
        description: "No file available for viewing",
        variant: "destructive",
      });
      return;
    }

    let newTab: Window | null = null;
    try {
      // Determine if we can preview in a new tab (images and PDFs)
      const isPreviewable =
        upload?.mime_type?.startsWith('image/') ||
        upload?.mime_type === 'application/pdf' ||
        upload?.file_name?.toLowerCase?.().endsWith('.pdf');

      if (isPreviewable) {
        newTab = window.open('', '_blank');
        if (newTab) newTab.document.write('Loading document...');

        const resolved = resolveStoragePath(upload.file_path);
        if (!resolved) throw new Error('Invalid file path');
        const { data, error } = await supabase.storage
          .from(resolved.bucket)
          .createSignedUrl(resolved.key, 60);

        if (error) throw error;
        if (newTab) {
          newTab.location.href = data.signedUrl;
        } else {
          window.open(data.signedUrl, '_blank');
        }
      } else {
        // For other files, trigger a download
        await handleDownload(doc);
      }
    } catch (error) {
      console.error('View error:', error);
      // Close any pre-opened tab left on "Loading"
      try {
        if (newTab && !newTab.closed) newTab.close();
      } catch {}
      toast({
        title: "Error",
        description: "Failed to view document",
        variant: "destructive",
      });
    }
  };
  const handleDownload = async (doc: any) => {
    console.log('Download document:', doc.id);
    console.log('Document uploads:', doc.document_uploads);
    const uploads = doc.document_uploads || [];
    const upload = uploads.length > 1
      ? uploads.slice().sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]
      : uploads[0];
    console.log('Selected upload data:', upload);
    
    if (!upload?.file_path) {
      console.log('No file_path found:', upload);
      toast({
        title: "Error",
        description: "No file available for download",
        variant: "destructive",
      });
      return;
    }

    setDownloading(doc.id);
    try {
      // Prefer a signed URL download so we avoid loading large blobs into memory
      const resolved = resolveStoragePath(upload.file_path);
      if (!resolved) {
        throw new Error('Invalid file path');
      }
      const { data: signed, error: signedErr } = await supabase.storage
        .from(resolved.bucket)
        .createSignedUrl(resolved.key, 60, { download: upload.file_name });

      if (!signedErr && signed?.signedUrl) {
        const a = window.document.createElement('a');
        a.href = signed.signedUrl;
        a.download = upload.file_name || 'download';
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        toast({
          title: "Download Started",
          description: `Downloading ${upload.file_name}`,
        });
        return;
      }

      // Fallback: fetch the blob and download
      const { data: blob, error } = await supabase.storage
        .from(resolved.bucket)
        .download(resolved.key);

      if (error) {
        console.error('Storage download error:', error);
        throw error;
      }

      const url = URL.createObjectURL(blob);
      const a2 = window.document.createElement('a');
      a2.href = url;
      a2.download = upload.file_name || 'download';
      window.document.body.appendChild(a2);
      a2.click();
      window.document.body.removeChild(a2);
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
    } finally {
      setDownloading(null);
    }
  };
  const stats = {
    total: filteredDocuments.length,
    pending: filteredDocuments.filter(doc => doc.status === 'pending').length,
    submitted: filteredDocuments.filter(doc => doc.status === 'submitted').length,
    approved: filteredDocuments.filter(doc => doc.status === 'approved').length,
    rejected: filteredDocuments.filter(doc => doc.status === 'rejected').length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Document Manager</h2>
          <p className="text-gray-600">Manage and review all supplier documents</p>
        </div>
        <Button onClick={onRefresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Submitted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <DocumentsFilter 
        filters={filters}
        onFiltersChange={setFilters}
        showExpirationFilter={false}
      />

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>All Documents ({filteredDocuments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length > 0 ? (
            <div className="space-y-6">
              {filteredDocuments.map(doc => (
                <DocumentCard
                  key={doc.id}
                  document={{
                    ...doc,
                    supplier: doc.suppliers,
                    ...(doc.document_uploads?.[0] && {
                      file_name: doc.document_uploads[0].file_name,
                      file_size: doc.document_uploads[0].file_size,
                      expiration_date: doc.document_uploads[0].expiration_date,
                      uploader: doc.document_uploads[0].uploader
                    })
                  }}
                  userRole="buyer"
                  onView={() => handleView(doc)}
                  onDownload={() => handleDownload(doc)}
                  downloadLoading={downloading === doc.id}
                  onApprove={() => onApprove(doc.id)}
                  onDecline={() => onDecline(doc.id)}
                  approveLoading={approveLoading === doc.id}
                  declineLoading={declineLoading === doc.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Found</h3>
              <p className="text-gray-500">
                {Object.values(filters).some(f => f !== '') 
                  ? "No documents match your current filters." 
                  : "No documents available."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BuyerDocumentsManager;
