import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Filter,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import EnhancedDocumentsFilter from './EnhancedDocumentsFilter';
import DocumentCardWithSelection from './DocumentCardWithSelection';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DocumentLinkModal } from './DocumentLinkModal';
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
    dateRange: '',
    uploadDateRange: '',
    specificYear: ''
  });
  const [downloading, setDownloading] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const { toast } = useToast();

  // Enhanced filter logic with new filter options
  const filteredDocuments = documents.filter(doc => {
    // Search filter
    const searchTerm = filters.search.toLowerCase();
    const matchesSearch = !searchTerm || 
      doc.title?.toLowerCase().includes(searchTerm) ||
      doc.document_type.toLowerCase().includes(searchTerm) ||
      doc.category?.toLowerCase().includes(searchTerm) ||
      doc.suppliers?.company_name?.toLowerCase().includes(searchTerm);

    // Status filter
    const matchesStatus = !filters.status || doc.status === filters.status;

    // Category filter
    const matchesCategory = !filters.category || doc.category === filters.category;

    // Document type filter
    const matchesDocumentType = !filters.documentType || doc.document_type === filters.documentType;

    // Supplier filter
    const matchesSupplier = !filters.supplier || doc.supplier_id === filters.supplier;

    // Upload date range filter
    let matchesUploadDateRange = true;
    if (filters.uploadDateRange) {
      const docDate = new Date(doc.created_at);
      const now = new Date();
      
      switch (filters.uploadDateRange) {
        case 'last_7_days':
          matchesUploadDateRange = docDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last_30_days':
          matchesUploadDateRange = docDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'last_90_days':
          matchesUploadDateRange = docDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'this_year':
          matchesUploadDateRange = docDate.getFullYear() === now.getFullYear();
          break;
        default:
          matchesUploadDateRange = true;
      }
    }

    // Specific year filter
    let matchesSpecificYear = true;
    if (filters.specificYear) {
      const docDate = new Date(doc.created_at);
      const docYear = docDate.getFullYear();
      
      switch (filters.specificYear) {
        case '2025':
          matchesSpecificYear = docYear === 2025;
          break;
        case '2024':
          matchesSpecificYear = docYear === 2024;
          break;
        case '2023':
          matchesSpecificYear = docYear === 2023;
          break;
        case '2024-2025':
          matchesSpecificYear = docYear === 2024 || docYear === 2025;
          break;
        case '2023-2024':
          matchesSpecificYear = docYear === 2023 || docYear === 2024;
          break;
        default:
          matchesSpecificYear = true;
      }
    }

    // Expiration status filter
    let matchesExpirationStatus = true;
    if (filters.expirationStatus) {
      const upload = doc.document_uploads?.[0];
      if (upload?.expiration_date) {
        const expirationDate = new Date(upload.expiration_date);
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        switch (filters.expirationStatus) {
          case 'expiring_soon':
            matchesExpirationStatus = expirationDate <= thirtyDaysFromNow && expirationDate >= now;
            break;
          case 'expired':
            matchesExpirationStatus = expirationDate < now;
            break;
          case 'valid':
            matchesExpirationStatus = expirationDate >= now;
            break;
          default:
            matchesExpirationStatus = true;
        }
      }
    }

    return matchesSearch && matchesStatus && matchesCategory && 
           matchesDocumentType && matchesSupplier && matchesUploadDateRange && 
           matchesSpecificYear && matchesExpirationStatus;
  });

  // Create available suppliers list from documents - extract actual supplier data
  const availableSuppliers = Array.from(
    new Map(
      documents
        .filter(doc => doc.suppliers && doc.supplier_id)
        .map(doc => [doc.supplier_id, { // Use supplier_id as key for consistency
          id: doc.supplier_id,
          company_name: doc.suppliers.company_name,
          documentCount: documents.filter(d => d.supplier_id === doc.supplier_id).length
        }])
    ).values()
  ).sort((a, b) => a.company_name.localeCompare(b.company_name));

  const handleView = async (doc: any) => {
    console.log('View document:', doc.id);
    console.log('Document uploads:', doc.document_uploads);
    const uploads = doc.document_uploads || [];
    const upload = uploads.length > 1
      ? uploads.slice().sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]
      : uploads[0];
    console.log('Selected upload data:', upload);
    
    if (!upload?.file_path) {
      try {
        if (doc.template_type === 'custom') {
          const { data: subs } = await supabase
            .from('template_submissions')
            .select('submission_file_path, submission_file_name, submission_mime_type')
            .eq('request_id', doc.id)
            .limit(1);
          const sub = subs && subs[0];
          if (sub?.submission_file_path) {
            const { data, error } = await supabase.functions.invoke('secure-document-url', {
              body: { filePath: sub.submission_file_path, expiresIn: 3600 }
            });
            if (error || !data?.success) throw new Error(data?.error || 'Failed to get secure URL');
            window.open(data.url, '_blank');
            return;
          }
        }
      } catch (e) {
        console.error('Custom submission view fallback failed', e);
      }
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
      try {
        if (doc.template_type === 'custom') {
          const { data: subs } = await supabase
            .from('template_submissions')
            .select('submission_file_path, submission_file_name')
            .eq('request_id', doc.id)
            .limit(1);
          const sub = subs && subs[0];
          if (sub?.submission_file_path) {
            const { data, error } = await supabase.functions.invoke('secure-document-url', {
              body: { filePath: sub.submission_file_path, expiresIn: 3600 }
            });
            if (error || !data?.success) throw new Error(data?.error || 'Failed to get secure URL');
            const a = window.document.createElement('a');
            a.href = data.url;
            a.download = sub.submission_file_name || 'download';
            window.document.body.appendChild(a);
            a.click();
            window.document.body.removeChild(a);
            return;
          }
        }
      } catch (e) {
        console.error('Custom submission download fallback failed', e);
      }
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

  const handleCreateLink = (doc: any) => {
    setSelectedDocument(doc);
    setLinkModalOpen(true);
  };

  // Bulk selection functions
  const handleSelectAll = () => {
    const newSelection = new Set<string>();
    filteredDocuments.forEach(doc => {
      const upload = doc.document_uploads?.[0];
      if (upload?.file_path) { // Only select documents with files
        newSelection.add(doc.id);
      }
    });
    setSelectedDocuments(newSelection);
  };

  const handleClearSelection = () => {
    setSelectedDocuments(new Set());
  };

  const handleDocumentSelectionChange = (documentId: string, selected: boolean) => {
    const newSelection = new Set(selectedDocuments);
    if (selected) {
      newSelection.add(documentId);
    } else {
      newSelection.delete(documentId);
    }
    setSelectedDocuments(newSelection);
  };

  // Bulk download function
  const handleBulkDownload = async () => {
    if (selectedDocuments.size === 0) {
      toast({
        title: "Error",
        description: "No documents selected",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsBulkDownloading(true);
      
      // Create filter description for filename
      const filterParts = [];
      
      if (filters.supplier) {
        const supplier = availableSuppliers.find(s => s.id === filters.supplier);
        if (supplier) filterParts.push(supplier.company_name);
      } else {
        filterParts.push("All_Suppliers");
      }
      
      if (filters.expirationStatus) {
        filterParts.push(filters.expirationStatus.replace('_', ' '));
      }
      
      if (filters.specificYear) {
        filterParts.push(filters.specificYear);
      } else if (filters.uploadDateRange) {
        filterParts.push(filters.uploadDateRange.replace('_', ' '));
      }
      
      if (filters.status) {
        filterParts.push(filters.status);
      }

      const filterDescription = filterParts.join('_') || 'Documents';

      // Get document upload IDs for selected documents
      const uploadIds = Array.from(selectedDocuments).map(docId => {
        const doc = documents.find(d => d.id === docId);
        return doc?.document_uploads?.[0]?.id;
      }).filter(Boolean);

      if (uploadIds.length === 0) {
        throw new Error('No valid document uploads found for selected documents');
      }

      // Call bulk download edge function
      const { data, error } = await supabase.functions.invoke('bulk-document-downloader', {
        body: {
          documentIds: uploadIds,
          filterDescription
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Since the edge function returns a blob response, we need to handle it differently
      const response = await fetch('https://edwerzutsknhuplidhsj.supabase.co/functions/v1/bulk-document-downloader', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkd2VyenV0c2tuaHVwbGlkaHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwOTU3MzYsImV4cCI6MjA2NTY3MTczNn0.zlfoc_V7IyFzmseOgfuew9Mjks_U6hrlO8XwNc_GXbI`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentIds: uploadIds,
          filterDescription
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Download the ZIP file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filterDescription}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: `ZIP download started with ${selectedDocuments.size} documents`,
      });
      setSelectedDocuments(new Set()); // Clear selection after download

    } catch (error) {
      console.error('Bulk download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download documents",
        variant: "destructive",
      });
    } finally {
      setIsBulkDownloading(false);
    }
  };


  // Calculate statistics
  const statsData = {
    total: documents.length,
    approved: documents.filter(d => d.status === 'approved').length,
    pending: documents.filter(d => d.status === 'pending' || d.status === 'submitted').length,
    expiringSoon: documents.filter(d => {
      const upload = d.document_uploads?.[0];
      if (upload?.expiration_date) {
        const expirationDate = new Date(upload.expiration_date);
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return expirationDate <= thirtyDaysFromNow && expirationDate >= now;
      }
      return false;
    }).length
  };

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="rounded-xl bg-gradient-to-br from-[hsl(var(--blue-accent))]/10 via-[hsl(var(--accent))]/5 to-[hsl(var(--teal-accent))]/10 border border-[hsl(var(--blue-accent))]/20 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-[hsl(var(--blue-accent))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
              Document Manager
            </h2>
            <p className="text-muted-foreground mt-1">Manage and review all supplier documents</p>
          </div>
          <Button 
            onClick={onRefresh} 
            size="sm"
            className="bg-gradient-to-r from-[hsl(var(--blue-accent))] to-[hsl(var(--accent))] hover:opacity-90 text-white border-0 shadow-[0_4px_12px_hsl(var(--blue-accent)/0.3)]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-[hsl(var(--blue-accent))] bg-gradient-to-br from-[hsl(var(--blue-accent))]/10 to-transparent backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Documents</p>
                  <p className="text-2xl font-bold text-[hsl(var(--blue-accent))]">{statsData.total}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[hsl(var(--blue-accent))] to-[hsl(var(--accent))] flex items-center justify-center shadow-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[hsl(var(--green-accent))] bg-gradient-to-br from-[hsl(var(--green-accent))]/10 to-transparent backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Approved</p>
                  <p className="text-2xl font-bold text-[hsl(var(--green-accent))]">{statsData.approved}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[hsl(var(--green-accent))] to-[hsl(var(--emerald-accent))] flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[hsl(var(--orange-accent))] bg-gradient-to-br from-[hsl(var(--orange-accent))]/10 to-transparent backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Pending Review</p>
                  <p className="text-2xl font-bold text-[hsl(var(--orange-accent))]">{statsData.pending}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[hsl(var(--orange-accent))] to-amber-500 flex items-center justify-center shadow-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500 bg-gradient-to-br from-red-500/10 to-transparent backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Expiring Soon</p>
                  <p className="text-2xl font-bold text-red-600">{statsData.expiringSoon}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Enhanced Filters */}
      <EnhancedDocumentsFilter
        filters={filters}
        onFiltersChange={setFilters}
        showExpirationFilter={true}
        availableSuppliers={availableSuppliers}
        selectedDocuments={selectedDocuments}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onBulkDownload={handleBulkDownload}
        filteredDocumentsCount={filteredDocuments.length}
        totalDocumentsCount={documents.length}
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
                <DocumentCardWithSelection
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
                  onCreateLink={() => handleCreateLink(doc)}
                  approveLoading={approveLoading === doc.id}
                  declineLoading={declineLoading === doc.id}
                  showSelection={true}
                  isSelected={selectedDocuments.has(doc.id)}
                  onSelectionChange={(selected) => handleDocumentSelectionChange(doc.id, selected)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Documents Found</h3>
              <p className="text-muted-foreground">
                {Object.values(filters).some(f => f !== '') 
                  ? "No documents match your current filters." 
                  : "No documents available."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Link Modal */}
      {selectedDocument && (
        <DocumentLinkModal
          isOpen={linkModalOpen}
          onClose={() => {
            setLinkModalOpen(false);
            setSelectedDocument(null);
          }}
          documentUpload={selectedDocument.document_uploads?.[0]}
        />
      )}
    </div>
  );
};

export default BuyerDocumentsManager;