import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Users,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import DocumentsFilter from './DocumentsFilter';
import DocumentCard from './DocumentCard';
import DocumentActivityDashboard from './DocumentActivityDashboard';
import DocumentRoadmap from './DocumentRoadmap';
import BuyerDocumentsManager from './BuyerDocumentsManager';
import DocumentDeclineDialog from './DocumentDeclineDialog';
import { resolveStoragePath } from '@/utils/storagePath';
const BuyerDocumentsDashboard = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveLoading, setApproveLoading] = useState<string | null>(null);
  const [declineLoading, setDeclineLoading] = useState<string | null>(null);
  const [declineDialog, setDeclineDialog] = useState<{
    isOpen: boolean;
    documentId: string;
    documentTitle: string;
  }>({
    isOpen: false,
    documentId: '',
    documentTitle: ''
  });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category: '',
    documentType: '',
    supplier: '',
    expirationStatus: '',
    dateRange: ''
  });
  const [availableSuppliers, setAvailableSuppliers] = useState<any[]>([]);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadDocuments();
      loadConnectedSuppliers();
    }
  }, [user, filters]);

  const loadConnectedSuppliers = async () => {
    try {
      // Get the buyer profile
      const { data: buyerProfile } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

      if (!buyerProfile) return;

      // Load connected suppliers with document counts
      const { data: suppliersData } = await supabase
        .from('buyer_supplier_connections')
        .select(`
          supplier_id,
          suppliers!inner (
            id,
            company_name
          )
        `)
        .eq('buyer_id', buyerProfile.id)
        .eq('status', 'approved');

      if (!suppliersData) return;

      // Get document counts for each supplier
      const suppliersWithCounts = await Promise.all(
        suppliersData.map(async (connection) => {
          const { count } = await supabase
            .from('document_requests')
            .select('*', { count: 'exact', head: true })
            .eq('buyer_id', buyerProfile.id)
            .eq('supplier_id', connection.supplier_id);

          return {
            id: connection.supplier_id,
            company_name: connection.suppliers.company_name,
            documentCount: count || 0
          };
        })
      );

      setAvailableSuppliers(suppliersWithCounts);
    } catch (error) {
      console.error('Error loading connected suppliers:', error);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Get the buyer profile
      const { data: buyerProfile } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

      if (!buyerProfile) return;

      // Load documents with uploads and supplier info
      let query = supabase
        .from('document_requests')
        .select(`
          *,
          suppliers (
            company_name,
            industry,
            profile_id
          ),
          document_uploads (
            id,
            file_name,
            file_path,
            file_size,
            mime_type,
            status,
            created_at,
            expiration_date,
            uploader:uploader_id (
              full_name
            )
          )
        `)
        .eq('buyer_id', buyerProfile.id)
        .order('created_at', { ascending: false });

      // Apply filters with proper type checking
      const validStatuses = ['pending', 'submitted', 'approved', 'rejected'] as const;
      if (filters.status && validStatuses.includes(filters.status as any)) {
        query = query.eq('status', filters.status as typeof validStatuses[number]);
      }
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.documentType) {
        query = query.eq('document_type', filters.documentType);
      }
      if (filters.supplier) {
        query = query.eq('supplier_id', filters.supplier);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading documents:', error);
        toast({
          title: "Error Loading Documents",
          description: "Failed to load documents. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Process and filter documents
      let processedDocuments = (data || []).map(doc => {
        // Determine the effective status with priority logic
        let effectiveStatus = doc.status;
        
        // Priority: document_requests status takes precedence for approved/rejected
        if (doc.status === 'approved' || doc.status === 'rejected') {
          effectiveStatus = doc.status;
        } else if (doc.document_uploads && doc.document_uploads.length > 0) {
          // For other statuses, check upload status
          const latestUpload = doc.document_uploads[0]; 
          if (latestUpload.status === 'pending_review') {
            effectiveStatus = 'submitted';
          } else if (latestUpload.status === 'approved') {
            effectiveStatus = 'approved';
          } else if (latestUpload.status === 'rejected') {
            effectiveStatus = 'rejected';
          }
        }
        
        return {
          ...doc,
          effectiveStatus,
          // Pass the effective status as the main status for DocumentCard
          status: effectiveStatus
        };
      });

      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        processedDocuments = processedDocuments.filter(doc =>
          doc.title.toLowerCase().includes(searchLower) ||
          doc.document_type.toLowerCase().includes(searchLower) ||
          doc.suppliers?.company_name?.toLowerCase().includes(searchLower)
        );
      }

      // Apply date range filter
      if (filters.dateRange) {
        const now = new Date();
        const filterDate = new Date();
        
        switch (filters.dateRange) {
          case 'last_7_days':
            filterDate.setDate(now.getDate() - 7);
            break;
          case 'last_30_days':
            filterDate.setDate(now.getDate() - 30);
            break;
          case 'last_90_days':
            filterDate.setDate(now.getDate() - 90);
            break;
          case 'this_year':
            filterDate.setFullYear(now.getFullYear(), 0, 1);
            break;
        }
        
        if (filters.dateRange !== '') {
          processedDocuments = processedDocuments.filter(doc =>
            new Date(doc.created_at) >= filterDate
          );
        }
      }

      setDocuments(processedDocuments);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: "Unexpected Error",
        description: "An unexpected error occurred while loading documents.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDocument = async (documentId: string) => {
    setApproveLoading(documentId);
    try {
      console.log('Approving document:', documentId);
      
      // Find the document for display purposes
      const document = documents.find(doc => doc.id === documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Use the secure approval function
      const { data, error } = await supabase.rpc('approve_document_request', {
        p_request_id: documentId,
        p_notes: null
      });

      if (error) {
        throw new Error(`Failed to approve document: ${error.message}`);
      }

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to approve document');
      }

      toast({
        title: "Document Approved",
        description: `"${document.document_type}" has been successfully approved.`,
      });

      // Reload documents to reflect the change
      await loadDocuments();
    } catch (error) {
      console.error('Error approving document:', error);
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve the document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setApproveLoading(null);
    }
  };

  const handleDeclineDocument = async (documentId: string, reason: string) => {
    setDeclineLoading(documentId);
    try {
      console.log('Declining document:', documentId);
      
      // Find the document for display purposes
      const document = documents.find(doc => doc.id === documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Use the secure rejection function
      const { data, error } = await supabase.rpc('reject_document_request', {
        p_request_id: documentId,
        p_reason: reason
      });

      if (error) {
        throw new Error(`Failed to reject document: ${error.message}`);
      }

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to reject document');
      }

      toast({
        title: "Document Declined",
        description: `"${document.document_type}" has been declined.`,
      });

      // Close decline dialog and reload documents
      setDeclineDialog({ isOpen: false, documentId: '', documentTitle: '' });
      await loadDocuments();
    } catch (error) {
      console.error('Error declining document:', error);
      toast({
        title: "Decline Failed",
        description: error instanceof Error ? error.message : "Failed to decline the document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeclineLoading(null);
    }
  };

  const openDeclineDialog = (documentId: string, documentTitle: string) => {
    setDeclineDialog({
      isOpen: true,
      documentId,
      documentTitle
    });
  };

// Robust view logic using signed URLs and popup-safe flow
const handleViewDocumentFile = async (doc: any) => {
  let preOpenedTab: Window | null = null;
  try {
    const uploads = doc.document_uploads || [];
    const latest = uploads.length > 1
      ? uploads.slice().sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]
      : uploads[0];

    if (!latest?.file_path) {
      toast({
        title: 'No File',
        description: 'No file available for viewing',
        variant: 'destructive',
      });
      return;
    }

    const isImage = latest.mime_type?.startsWith('image/');
    const isPdf = latest.mime_type === 'application/pdf' || latest.file_name?.toLowerCase().endsWith('.pdf');
    const isViewable = isImage || isPdf;

    // Only pre-open tab for viewable types to avoid stuck tabs
    if (isViewable) {
      preOpenedTab = window.open('', '_blank');
      if (preOpenedTab) preOpenedTab.document.write('Loading document...');
    }

    const resolved = resolveStoragePath(latest.file_path);
    if (!resolved) throw new Error('Invalid file path');

    const { data, error } = await supabase.storage
      .from(resolved.bucket)
      .createSignedUrl(resolved.key, 60);

    if (error || !data?.signedUrl) {
      throw error || new Error('Could not generate a signed URL');
    }

    if (isViewable) {
      if (preOpenedTab) preOpenedTab.location.href = data.signedUrl;
      else window.open(data.signedUrl, '_blank');
    } else {
      // Non-previewable types: trigger download instead
      await handleDownloadDocumentFile(doc);
    }
  } catch (err) {
    console.error('View error:', err);
    if (preOpenedTab) {
      try { preOpenedTab.close(); } catch {}
    }
    toast({
      title: 'View Failed',
      description: 'Failed to open the document',
      variant: 'destructive',
    });
  }
};

  // Robust download logic with signed URL first, blob fallback
  const handleDownloadDocumentFile = async (doc: any) => {
    try {
      const uploads = doc.document_uploads || [];
      const latest = uploads.length > 1
        ? uploads.slice().sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]
        : uploads[0];

      if (!latest?.file_path) {
        toast({
          title: 'No File',
          description: 'No file available for download',
          variant: 'destructive',
        });
        return;
      }

// Try signed URL with download param
const resolved = resolveStoragePath(latest.file_path);
if (!resolved) throw new Error('Invalid file path');

const { data: signed, error: signedErr } = await supabase.storage
  .from(resolved.bucket)
  .createSignedUrl(resolved.key, 60, { download: latest.file_name });

if (!signedErr && signed?.signedUrl) {
  const a = window.document.createElement('a');
  a.href = signed.signedUrl;
  a.download = latest.file_name || 'download';
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  return;
}

// Fallback: download blob
const { data: blob, error } = await supabase.storage
  .from(resolved.bucket)
  .download(resolved.key);
if (error) throw error;

const url = URL.createObjectURL(blob);
const a2 = window.document.createElement('a');
a2.href = url;
a2.download = latest.file_name || 'download';
window.document.body.appendChild(a2);
a2.click();
window.document.body.removeChild(a2);
URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      toast({
        title: 'Download Failed',
        description: 'Failed to download the document',
        variant: 'destructive',
      });
    }
  };

  // Calculate stats using effective status
  const stats = {
    total: documents.length,
    pending: documents.filter(doc => doc.effectiveStatus === 'pending').length,
    submitted: documents.filter(doc => doc.effectiveStatus === 'submitted').length,
    approved: documents.filter(doc => doc.effectiveStatus === 'approved').length,
    rejected: documents.filter(doc => doc.effectiveStatus === 'rejected').length
  };

  // Generate activity events for the new dashboard
  const activityEvents = documents.map(doc => ({
    id: doc.id,
    type: doc.effectiveStatus as 'created' | 'submitted' | 'approved' | 'rejected' | 'expired' | 'reminder',
    title: `Document ${doc.effectiveStatus}`,
    description: `${doc.document_type} - ${doc.suppliers?.company_name || 'Unknown Supplier'}`,
    date: doc.updated_at || doc.created_at,
    documentTitle: doc.document_type,
    supplier: doc.suppliers?.company_name,
    priority: doc.priority as 'high' | 'medium' | 'low',
    category: doc.category
  }));

  // Generate roadmap items with proper status mapping
  const roadmapItems = documents
    .filter(doc => doc.effectiveStatus !== 'approved')
    .map(doc => {
      let roadmapStatus: 'pending' | 'completed' | 'in_progress' | 'overdue';
      
      switch (doc.effectiveStatus) {
        case 'pending':
          roadmapStatus = 'pending';
          break;
        case 'submitted':
          roadmapStatus = 'in_progress';
          break;
        case 'rejected':
          roadmapStatus = 'overdue';
          break;
        default:
          roadmapStatus = 'pending';
      }

      return {
        id: doc.id,
        title: doc.document_type,
        status: roadmapStatus,
        dueDate: doc.due_date,
        description: `${doc.document_type} from ${doc.suppliers?.company_name || 'Unknown Supplier'}`,
        priority: (doc.priority || 'medium') as 'high' | 'medium' | 'low'
      };
    });

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading documents...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Documents Dashboard</h1>
        <Badge variant="outline" className="bg-blue-100 text-blue-800">
          Buyer Portal
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Review</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Document Manager</TabsTrigger>
          <TabsTrigger value="timeline">Activity</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <DocumentsFilter 
            filters={filters}
            onFiltersChange={setFilters}
            showExpirationFilter={false}
            availableSuppliers={availableSuppliers}
          />
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Document Requests ({documents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length > 0 ? (
                <div className="grid gap-6">
                  {documents.slice(0, 5).map(doc => (
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
                      onView={() => handleViewDocumentFile(doc)}
                      onDownload={() => handleDownloadDocumentFile(doc)}
                      onApprove={() => handleApproveDocument(doc.id)}
                      onDecline={() => openDeclineDialog(doc.id, doc.document_type)}
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
                      : "You haven't requested any documents yet."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <BuyerDocumentsManager 
            documents={documents}
            onApprove={handleApproveDocument}
            onDecline={(documentId) => {
              const doc = documents.find(d => d.id === documentId);
              openDeclineDialog(documentId, doc?.document_type || 'Document');
            }}
            onRefresh={loadDocuments}
            approveLoading={approveLoading}
            declineLoading={declineLoading}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <DocumentActivityDashboard events={activityEvents} documents={documents} />
        </TabsContent>

        <TabsContent value="roadmap">
          <DocumentRoadmap 
            items={roadmapItems}
            title="Document Collection Progress"
          />
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Analytics coming soon</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Supplier Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Supplier metrics coming soon</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Decline Dialog */}
      <DocumentDeclineDialog
        isOpen={declineDialog.isOpen}
        onClose={() => setDeclineDialog({ isOpen: false, documentId: '', documentTitle: '' })}
        onConfirm={(reason) => handleDeclineDocument(declineDialog.documentId, reason)}
        documentTitle={declineDialog.documentTitle}
        loading={declineLoading === declineDialog.documentId}
      />
    </div>
  );
};

export default BuyerDocumentsDashboard;
