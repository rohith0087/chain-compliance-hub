
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

  const handleView = async (document: any) => {
    const upload = document.document_uploads?.[0];
    if (!upload?.file_path) {
      toast({
        title: "Error",
        description: "No file available for viewing",
        variant: "destructive",
      });
      return;
    }

    try {
      // For images, open in new tab
      if (upload.mime_type?.startsWith('image/')) {
        const { data, error } = await supabase.storage
          .from('compliance-documents')
          .createSignedUrl(upload.file_path, 60);

        if (error) throw error;
        window.open(data.signedUrl, '_blank');
      } else {
        // For other files, download them
        handleDownload(document);
      }
    } catch (error) {
      console.error('View error:', error);
      toast({
        title: "Error",
        description: "Failed to view document",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (document: any) => {
    const upload = document.document_uploads?.[0];
    if (!upload?.file_path) {
      toast({
        title: "Error",
        description: "No file available for download",
        variant: "destructive",
      });
      return;
    }

    setDownloading(document.id);
    try {
      const { data, error } = await supabase.storage
        .from('compliance-documents')
        .download(upload.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
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
