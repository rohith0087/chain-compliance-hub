
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
import DocumentsFilter from './DocumentsFilter';
import DocumentCard from './DocumentCard';
import DocumentTimeline from './DocumentTimeline';
import DocumentRoadmap from './DocumentRoadmap';

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
    rejected: documents.filter(doc => doc.status === 'rejected').length
  };

  // Generate timeline events
  const timelineEvents = documents.slice(0, 10).map(doc => ({
    id: doc.id,
    type: doc.status as 'created' | 'submitted' | 'approved' | 'rejected' | 'expired' | 'reminder',
    title: `Document ${doc.status}`,
    description: `${doc.title} - ${doc.suppliers?.company_name || 'Unknown Supplier'}`,
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
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
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
      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList>
          <TabsTrigger value="documents">All Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-6">
          <DocumentsFilter 
            filters={filters}
            onFiltersChange={setFilters}
            showExpirationFilter={false}
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
