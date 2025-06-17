
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
  Calendar,
  Upload
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DocumentsFilter from './DocumentsFilter';
import DocumentCard from './DocumentCard';
import DocumentTimeline from './DocumentTimeline';
import DocumentRoadmap from './DocumentRoadmap';

const SupplierDocumentsDashboard = () => {
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

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user, filters]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Get the supplier profile
      const { data: supplierProfile } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

      if (!supplierProfile) return;

      // Load documents with uploads and buyer info
      let query = supabase
        .from('document_requests')
        .select(`
          *,
          buyers (
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
        .eq('supplier_id', supplierProfile.id)
        .order('created_at', { ascending: false });

      // Apply filters with proper type checking
      if (filters.status && ['pending', 'submitted', 'approved', 'rejected'].includes(filters.status)) {
        query = query.eq('status', filters.status);
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
        return;
      }

      // Process and filter documents
      let processedDocuments = data || [];

      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        processedDocuments = processedDocuments.filter(doc =>
          doc.title.toLowerCase().includes(searchLower) ||
          doc.document_type.toLowerCase().includes(searchLower) ||
          doc.buyers?.company_name?.toLowerCase().includes(searchLower)
        );
      }

      // Apply expiration filter
      if (filters.expirationStatus) {
        processedDocuments = processedDocuments.filter(doc => {
          const upload = doc.document_uploads?.[0];
          if (!upload?.expiration_date) return filters.expirationStatus === 'valid';
          
          const expDate = new Date(upload.expiration_date);
          const today = new Date();
          const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
          
          switch (filters.expirationStatus) {
            case 'expired':
              return expDate < today;
            case 'expiring_soon':
              return expDate <= thirtyDaysFromNow && expDate >= today;
            case 'valid':
              return expDate > thirtyDaysFromNow;
            default:
              return true;
          }
        });
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
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = {
    total: documents.length,
    pending: documents.filter(doc => doc.status === 'pending').length,
    submitted: documents.filter(doc => doc.status === 'submitted').length,
    approved: documents.filter(doc => doc.status === 'approved').length,
    rejected: documents.filter(doc => doc.status === 'rejected').length,
    expiringSoon: documents.filter(doc => {
      const upload = doc.document_uploads?.[0];
      if (!upload?.expiration_date) return false;
      const expDate = new Date(upload.expiration_date);
      const today = new Date();
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      return expDate <= thirtyDaysFromNow && expDate >= today;
    }).length,
    expired: documents.filter(doc => {
      const upload = doc.document_uploads?.[0];
      if (!upload?.expiration_date) return false;
      return new Date(upload.expiration_date) < new Date();
    }).length
  };

  // Generate timeline events
  const timelineEvents = documents.slice(0, 10).map(doc => ({
    id: doc.id,
    type: doc.status as 'created' | 'submitted' | 'approved' | 'rejected' | 'expired' | 'reminder',
    title: `Document ${doc.status}`,
    description: `${doc.title} - ${doc.buyers?.company_name || 'Unknown Buyer'}`,
    date: doc.updated_at || doc.created_at,
    documentTitle: doc.title
  }));

  // Generate roadmap items with proper status mapping
  const roadmapItems = documents
    .filter(doc => doc.status !== 'approved')
    .map(doc => {
      let roadmapStatus: 'pending' | 'completed' | 'in_progress' | 'overdue';
      
      switch (doc.status) {
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
        description: `${doc.document_type} for ${doc.buyers?.company_name || 'Unknown Buyer'}`,
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
        <Badge variant="outline" className="bg-green-100 text-green-800">
          Supplier Portal
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
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
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
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
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.expiringSoon}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList>
          <TabsTrigger value="documents">All Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="expiring">Expiring Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-6">
          <DocumentsFilter 
            filters={filters}
            onFiltersChange={setFilters}
            showExpirationFilter={true}
          />
          
          <Card>
            <CardHeader>
              <CardTitle>Document Requests ({documents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length > 0 ? (
                <div className="grid gap-6">
                  {documents.map(doc => (
                    <DocumentCard
                      key={doc.id}
                      document={{
                        ...doc,
                        buyer: doc.buyers,
                        ...(doc.document_uploads?.[0] && {
                          file_name: doc.document_uploads[0].file_name,
                          file_size: doc.document_uploads[0].file_size,
                          expiration_date: doc.document_uploads[0].expiration_date,
                          uploader: doc.document_uploads[0].uploader
                        })
                      }}
                      userRole="supplier"
                      onView={() => console.log('View document:', doc.id)}
                      onDownload={() => console.log('Download document:', doc.id)}
                      onUpload={() => console.log('Upload document:', doc.id)}
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
                      : "You don't have any document requests yet."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <DocumentTimeline events={timelineEvents} />
        </TabsContent>

        <TabsContent value="roadmap">
          <DocumentRoadmap 
            items={roadmapItems}
            title="Document Submission Progress"
          />
        </TabsContent>

        <TabsContent value="expiring">
          <Card>
            <CardHeader>
              <CardTitle>Expiring & Expired Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.filter(doc => {
                const upload = doc.document_uploads?.[0];
                if (!upload?.expiration_date) return false;
                const expDate = new Date(upload.expiration_date);
                const today = new Date();
                const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                return expDate <= thirtyDaysFromNow;
              }).length > 0 ? (
                <div className="grid gap-6">
                  {documents
                    .filter(doc => {
                      const upload = doc.document_uploads?.[0];
                      if (!upload?.expiration_date) return false;
                      const expDate = new Date(upload.expiration_date);
                      const today = new Date();
                      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                      return expDate <= thirtyDaysFromNow;
                    })
                    .map(doc => (
                      <DocumentCard
                        key={doc.id}
                        document={{
                          ...doc,
                          buyer: doc.buyers,
                          ...(doc.document_uploads?.[0] && {
                            file_name: doc.document_uploads[0].file_name,
                            file_size: doc.document_uploads[0].file_size,
                            expiration_date: doc.document_uploads[0].expiration_date,
                            uploader: doc.document_uploads[0].uploader
                          })
                        }}
                        userRole="supplier"
                        onView={() => console.log('View document:', doc.id)}
                        onDownload={() => console.log('Download document:', doc.id)}
                        onUpload={() => console.log('Upload document:', doc.id)}
                      />
                    ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Expiring Documents</h3>
                  <p className="text-gray-500">All your documents are up to date!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupplierDocumentsDashboard;
