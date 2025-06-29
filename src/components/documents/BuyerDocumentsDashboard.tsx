
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
import DocumentTimeline from './DocumentTimeline';
import DocumentRoadmap from './DocumentRoadmap';
import BuyerDocumentsManager from './BuyerDocumentsManager';

const BuyerDocumentsDashboard = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category: '',
    documentType: '',
    expirationStatus: '',
    dateRange: ''
  });
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user, filters]);

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
            industry
          ),
          document_uploads (
            id,
            file_name,
            file_size,
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
        // Determine the effective status based on document status and uploads
        let effectiveStatus = doc.status;
        
        // If document has uploads, check their status
        if (doc.document_uploads && doc.document_uploads.length > 0) {
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
    try {
      console.log('Approving document:', documentId);
      
      // Find the document and its upload
      const document = documents.find(doc => doc.id === documentId);
      if (!document) {
        throw new Error('Document not found');
      }
      
      console.log('Document found:', document);

      if (!document.document_uploads || document.document_uploads.length === 0) {
        throw new Error('No file uploaded for this document');
      }

      const uploadId = document.document_uploads[0].id;
      console.log('Upload ID:', uploadId);

      // Update the upload status to approved
      const { error: uploadError } = await supabase
        .from('document_uploads')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', uploadId);

      if (uploadError) {
        console.error('Upload update error:', uploadError);
        throw uploadError;
      }

      // Update the document request status to approved
      const { error: requestError } = await supabase
        .from('document_requests')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (requestError) {
        console.error('Request update error:', requestError);
        throw requestError;
      }

      toast({
        title: "Document Approved",
        description: `"${document.title}" has been successfully approved.`,
      });

      // Reload documents to reflect the change
      loadDocuments();
    } catch (error) {
      console.error('Error approving document:', error);
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve the document. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeclineDocument = async (documentId: string) => {
    try {
      console.log('Declining document:', documentId);
      
      // Find the document and its upload
      const document = documents.find(doc => doc.id === documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      console.log('Document found:', document);

      if (!document.document_uploads || document.document_uploads.length === 0) {
        throw new Error('No file uploaded for this document');
      }

      const uploadId = document.document_uploads[0].id;
      console.log('Upload ID:', uploadId);

      // Update the upload status to rejected
      const { error: uploadError } = await supabase
        .from('document_uploads')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', uploadId);

      if (uploadError) {
        console.error('Upload update error:', uploadError);
        throw uploadError;
      }

      // Update the document request status to rejected
      const { error: requestError } = await supabase
        .from('document_requests')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (requestError) {
        console.error('Request update error:', requestError);
        throw requestError;
      }

      toast({
        title: "Document Declined",
        description: `"${document.title}" has been declined.`,
      });

      // Reload documents to reflect the change
      loadDocuments();
    } catch (error) {
      console.error('Error declining document:', error);
      toast({
        title: "Decline Failed",
        description: error instanceof Error ? error.message : "Failed to decline the document. Please try again.",
        variant: "destructive"
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

  // Generate timeline events
  const timelineEvents = documents.slice(0, 10).map(doc => ({
    id: doc.id,
    type: doc.effectiveStatus as 'created' | 'submitted' | 'approved' | 'rejected' | 'expired' | 'reminder',
    title: `Document ${doc.effectiveStatus}`,
    description: `${doc.title} - ${doc.suppliers?.company_name || 'Unknown Supplier'}`,
    date: doc.updated_at || doc.created_at,
    documentTitle: doc.title
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
        title: doc.title,
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
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <DocumentsFilter 
            filters={filters}
            onFiltersChange={setFilters}
            showExpirationFilter={false}
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
                      onView={() => console.log('View document:', doc.id)}
                      onDownload={() => console.log('Download document:', doc.id)}
                      onApprove={() => handleApproveDocument(doc.id)}
                      onDecline={() => handleDeclineDocument(doc.id)}
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
            onDecline={handleDeclineDocument}
            onRefresh={loadDocuments}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <DocumentTimeline events={timelineEvents} />
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
    </div>
  );
};

export default BuyerDocumentsDashboard;
