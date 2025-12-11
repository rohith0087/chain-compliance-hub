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
import { BulkDownloadOptionsDialog } from './BulkDownloadOptionsDialog';
import { BulkDownloadOverlay } from './BulkDownloadOverlay';

interface BuyerDocumentsManagerProps {
  documents: any[];
  onApprove: (documentId: string) => Promise<void>;
  onDecline: (documentId: string) => void;
  onRefresh: () => Promise<void>;
  approveLoading?: string | null;
  declineLoading?: string | null;
}

// Helper to get the latest upload (most recent by created_at)
const getLatestUpload = (uploads: any[] | undefined) => {
  if (!uploads || uploads.length === 0) return null;
  if (uploads.length === 1) return uploads[0];
  return uploads.slice().sort((a, b) => 
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )[0];
};

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
    specificYear: '',
    facilityLocation: ''
  });
  const [downloading, setDownloading] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [downloadMode, setDownloadMode] = useState<'current' | 'all'>('current');
  const [organizeFolders, setOrganizeFolders] = useState(true);
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

    // Facility location filter
    const matchesFacility = !filters.facilityLocation || doc.branch_id === filters.facilityLocation;

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
      const upload = getLatestUpload(doc.document_uploads);
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
           matchesSpecificYear && matchesExpirationStatus && matchesFacility;
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

  // Create available facilities list from documents
  const availableFacilities = Array.from(
    new Map(
      documents
        .filter(doc => doc.branch)
        .map(doc => [doc.branch.id, {
          id: doc.branch.id,
          name: doc.branch.branch_name,
          location: doc.branch.location || '',
          documentCount: documents.filter(d => d.branch_id === doc.branch.id).length
        }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

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

        // Log download activity with error handling
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id && upload.id) {
          try {
            const { error: logError } = await supabase.from('document_activity_logs').insert({
              document_upload_id: upload.id,
              document_request_id: doc.id,
              user_id: user.id,
              action_type: 'downloaded',
              notes: `Downloaded: ${upload.file_name}`,
              metadata: { file_name: upload.file_name }
            });
            if (logError) console.error('Failed to log download activity:', logError);
          } catch (logErr) {
            console.error('Error logging download activity:', logErr);
          }
        }

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

      // Log download activity (fallback path) with error handling
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id && upload.id) {
        try {
          const { error: logError } = await supabase.from('document_activity_logs').insert({
            document_upload_id: upload.id,
            document_request_id: doc.id,
            user_id: user.id,
            action_type: 'downloaded',
            notes: `Downloaded: ${upload.file_name}`,
            metadata: { file_name: upload.file_name }
          });
          if (logError) console.error('Failed to log download activity (fallback):', logError);
        } catch (logErr) {
          console.error('Error logging download activity (fallback):', logErr);
        }
      }

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

  // Check if any selected documents have multiple versions
  const getMultiVersionCount = () => {
    return Array.from(selectedDocuments).filter(docId => {
      const doc = documents.find(d => d.id === docId);
      return doc?.document_uploads?.length > 1;
    }).length;
  };

  // Bulk download function - checks for multi-version documents first
  const handleBulkDownload = async () => {
    if (selectedDocuments.size === 0) {
      toast({
        title: "Error",
        description: "No documents selected",
        variant: "destructive",
      });
      return;
    }

    const multiVersionCount = getMultiVersionCount();
    if (multiVersionCount > 0) {
      setShowVersionDialog(true);
      return;
    }

    // No multi-version docs, proceed with download
    await executeBulkDownload('current');
  };

  // Execute the actual bulk download
  const executeBulkDownload = async (mode: 'current' | 'all') => {
    try {
      setShowVersionDialog(false);
      setIsBulkDownloading(true);
      
      // Get user's session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session - please log in again');
      }
      
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

      // Get document upload IDs and metadata based on download mode
      let uploadIds: string[] = [];
      const documentMetadata: Array<{ title: string; uploadIds: string[] }> = [];
      
      Array.from(selectedDocuments).forEach(docId => {
        const doc = documents.find(d => d.id === docId);
        if (!doc?.document_uploads?.length) return;
        
        const docUploadIds: string[] = [];
        
        if (mode === 'all') {
          // Include all versions
          doc.document_uploads.forEach((upload: any) => {
            if (upload?.id) {
              uploadIds.push(upload.id);
              docUploadIds.push(upload.id);
            }
          });
        } else {
          // Include only latest version (first in array)
          if (doc.document_uploads[0]?.id) {
            uploadIds.push(doc.document_uploads[0].id);
            docUploadIds.push(doc.document_uploads[0].id);
          }
        }
        
        // Collect metadata for folder organization
        if (docUploadIds.length > 0) {
          documentMetadata.push({
            title: doc.title || doc.document_type || 'Documents',
            uploadIds: docUploadIds
          });
        }
      });

      if (uploadIds.length === 0) {
        throw new Error('No valid document uploads found for selected documents');
      }

      // Call bulk download edge function with user's session token
      const response = await fetch('https://edwerzutsknhuplidhsj.supabase.co/functions/v1/bulk-document-downloader', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentIds: uploadIds,
          filterDescription,
          organizeFolders,
          documentMetadata
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Download failed: ${errorText}`);
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
        description: `ZIP download started with ${uploadIds.length} file${uploadIds.length !== 1 ? 's' : ''}`,
      });
      setSelectedDocuments(new Set());

    } catch (error: any) {
      console.error('Bulk download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download documents",
        variant: "destructive",
      });
    } finally {
      setIsBulkDownloading(false);
    }
  };


  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Loading Overlay */}
      {isBulkDownloading && (
        <BulkDownloadOverlay documentCount={selectedDocuments.size} />
      )}

      {/* Version Selection Dialog */}
      <BulkDownloadOptionsDialog
        open={showVersionDialog}
        onOpenChange={setShowVersionDialog}
        multiVersionCount={getMultiVersionCount()}
        totalSelected={selectedDocuments.size}
        downloadMode={downloadMode}
        onDownloadModeChange={setDownloadMode}
        organizeFolders={organizeFolders}
        onOrganizeFoldersChange={setOrganizeFolders}
        onConfirm={() => executeBulkDownload(downloadMode)}
      />

      {/* Enhanced Filters */}
      <EnhancedDocumentsFilter
        filters={filters}
        onFiltersChange={setFilters}
        showExpirationFilter={true}
        availableSuppliers={availableSuppliers}
        availableFacilities={availableFacilities}
        selectedDocuments={selectedDocuments}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onBulkDownload={handleBulkDownload}
        filteredDocumentsCount={filteredDocuments.length}
        totalDocumentsCount={documents.length}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
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
                    ...(() => {
                      const latestUpload = getLatestUpload(doc.document_uploads);
                      return latestUpload ? {
                        file_name: latestUpload.file_name,
                        file_size: latestUpload.file_size,
                        expiration_date: latestUpload.expiration_date,
                        uploader: latestUpload.uploader
                      } : {};
                    })()
                  }}
                  userRole="buyer"
                  showActions={true}
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
          documentUpload={getLatestUpload(selectedDocument.document_uploads)}
        />
      )}
    </div>
  );
};

export default BuyerDocumentsManager;