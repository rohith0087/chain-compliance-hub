import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Calendar,
  Upload,
  Search,
  Filter,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBranchContext } from '@/contexts/BranchContext';
import DocumentCard from './DocumentCard';
import DocumentTimeline from './DocumentTimeline';
import DocumentUploadDialog from '@/components/supplier/DocumentUploadDialog';


// Helper to get the latest upload from an array (sorted by created_at descending)
const getLatestUpload = (uploads: any[]) => {
  if (!uploads?.length) return null;
  return [...uploads].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
};

const SupplierDocumentsDashboard = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('documents');
  const [highlightedDocId, setHighlightedDocId] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [uploadDialogDoc, setUploadDialogDoc] = useState<any>(null);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category: '',
    documentType: '',
    buyer: '',
    expirationStatus: '',
    dateRange: ''
  });
  
  const { user } = useAuth();
  const { currentBranch, allBranchesView } = useBranchContext();

  // Check for pre-set filters from dashboard navigation
  useEffect(() => {
    const presetStatus = sessionStorage.getItem('supplier_docs_filter_status');
    
    if (presetStatus) {
      setFilters(prev => ({ ...prev, status: presetStatus }));
      sessionStorage.removeItem('supplier_docs_filter_status');
    }
  }, []);

  // Handle URL params for subtab and document highlighting
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const subtab = urlParams.get('subtab');
    const highlightDoc = urlParams.get('highlightDoc');
    
    if (subtab === 'expiring') {
      setActiveSubTab('expiring');
    }
    
    if (highlightDoc) {
      setHighlightedDocId(highlightDoc);
      // Scroll to document after render
      setTimeout(() => {
        const element = document.getElementById(`doc-${highlightDoc}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      
      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightedDocId(null);
        // Clean up URL params
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('subtab');
        cleanUrl.searchParams.delete('highlightDoc');
        window.history.replaceState({}, '', cleanUrl.toString());
      }, 3000);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user, filters, currentBranch?.id, allBranchesView]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Check if user is a team member first (company ID resolution pattern)
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', user?.id)
        .eq('company_type', 'supplier')
        .eq('status', 'active')
        .maybeSingle();

      let supplierId: string | null = null;

      if (teamMember) {
        supplierId = teamMember.company_id;
      } else {
        // Get the supplier profile for company owner
        const { data: supplierProfile } = await supabase
          .from('suppliers')
          .select('id')
          .eq('profile_id', user?.id)
          .single();

        if (!supplierProfile) return;
        supplierId = supplierProfile.id;
      }

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
        .eq('supplier_id', supplierId);

      // Apply branch filter if specific branch selected (include NULL for non-branch-specific docs)
      if (!allBranchesView && currentBranch?.id) {
        query = query.or(`supplier_branch_id.eq.${currentBranch.id},supplier_branch_id.is.null`);
      }

      query = query.order('created_at', { ascending: false });

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

      // Apply buyer filter
      if (filters.buyer) {
        processedDocuments = processedDocuments.filter(doc =>
          doc.buyers?.company_name?.toLowerCase().includes(filters.buyer.toLowerCase())
        );
      }

      // Apply expiration filter using latest upload
      if (filters.expirationStatus) {
        processedDocuments = processedDocuments.filter(doc => {
          const upload = getLatestUpload(doc.document_uploads);
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
      
      // Load activity logs for timeline
      await loadActivityLogs(supplierId);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load actual activity logs from database
  const loadActivityLogs = async (supplierId: string) => {
    try {
      // Get all document upload IDs for this supplier's requests
      const { data: uploads } = await supabase
        .from('document_uploads')
        .select(`
          id,
          document_requests!inner (supplier_id)
        `)
        .eq('document_requests.supplier_id', supplierId);

      if (!uploads?.length) {
        setActivityLogs([]);
        return;
      }

      const uploadIds = uploads.map(u => u.id);

      // Fetch activity logs for these uploads
      const { data: logs, error } = await supabase
        .from('document_activity_logs')
        .select(`
          id,
          action_type,
          created_at,
          notes,
          metadata,
          document_upload_id,
          document_request_id
        `)
        .or(`document_upload_id.in.(${uploadIds.join(',')}),document_request_id.is.not.null`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && logs) {
        setActivityLogs(logs);
      }
    } catch (error) {
      console.error('Error loading activity logs:', error);
    }
  };

  // Calculate stats using latest upload for expiration checks
  const stats = {
    total: documents.length,
    pending: documents.filter(doc => doc.status === 'pending').length,
    submitted: documents.filter(doc => doc.status === 'submitted').length,
    approved: documents.filter(doc => doc.status === 'approved').length,
    rejected: documents.filter(doc => doc.status === 'rejected').length,
    expiringSoon: documents.filter(doc => {
      const upload = getLatestUpload(doc.document_uploads);
      if (!upload?.expiration_date || upload.status !== 'approved') return false;
      const expDate = new Date(upload.expiration_date);
      const today = new Date();
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      return expDate <= thirtyDaysFromNow && expDate >= today;
    }).length,
    expired: documents.filter(doc => {
      const upload = getLatestUpload(doc.document_uploads);
      if (!upload?.expiration_date || upload.status !== 'approved') return false;
      return new Date(upload.expiration_date) < new Date();
    }).length
  };

  // Get unique buyers for filter options
  const uniqueBuyers = Array.from(
    new Set(
      documents
        .map(doc => doc.buyers?.company_name)
        .filter(Boolean)
    )
  ).sort();

  // Handle stat card clicks to filter documents
  const handleStatClick = (filterType: string) => {
    switch (filterType) {
      case 'total':
        setFilters(prev => ({
          ...prev,
          status: '',
          expirationStatus: ''
        }));
        break;
      case 'pending':
        setFilters(prev => ({
          ...prev,
          status: 'pending',
          expirationStatus: ''
        }));
        break;
      case 'submitted':
        setFilters(prev => ({
          ...prev,
          status: 'submitted',
          expirationStatus: ''
        }));
        break;
      case 'approved':
        setFilters(prev => ({
          ...prev,
          status: 'approved',
          expirationStatus: ''
        }));
        break;
      case 'rejected':
        setFilters(prev => ({
          ...prev,
          status: 'rejected',
          expirationStatus: ''
        }));
        break;
      case 'expiring_soon':
        setFilters(prev => ({
          ...prev,
          status: '',
          expirationStatus: 'expiring_soon'
        }));
        break;
      case 'expired':
        setFilters(prev => ({
          ...prev,
          status: '',
          expirationStatus: 'expired'
        }));
        break;
    }
  };

  // Calculate active filters count for badge
  const activeFiltersCount = Object.values(filters).filter(value => value !== '').length - (filters.search ? 1 : 0); // Exclude search from count

  // Handle search input separately from other filters
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value }));
  };

  // Map action types to timeline event types
  const mapActionToEventType = (actionType: string): 'created' | 'submitted' | 'approved' | 'rejected' | 'expired' | 'reminder' => {
    switch (actionType) {
      case 'requested': return 'created';
      case 'uploaded': return 'submitted';
      case 'approved': return 'approved';
      case 'rejected': return 'rejected';
      case 'downloaded': return 'reminder';
      case 'link_created': return 'reminder';
      case 'renewed': return 'submitted';
      default: return 'created';
    }
  };

  const formatActionTitle = (actionType: string): string => {
    switch (actionType) {
      case 'requested': return 'Document Requested';
      case 'uploaded': return 'Document Uploaded';
      case 'approved': return 'Document Approved';
      case 'rejected': return 'Document Rejected';
      case 'downloaded': return 'Document Downloaded';
      case 'link_created': return 'Share Link Created';
      case 'renewed': return 'Document Renewed';
      default: return `Document ${actionType}`;
    }
  };

  // Generate timeline events from actual activity logs
  const timelineEvents = activityLogs.map(log => {
    // Find the related document for context
    const relatedDoc = documents.find(doc => 
      doc.document_uploads?.some((u: any) => u.id === log.document_upload_id) ||
      doc.id === log.document_request_id
    );

    return {
      id: log.id,
      type: mapActionToEventType(log.action_type),
      title: formatActionTitle(log.action_type),
      description: relatedDoc 
        ? `${relatedDoc.title} - ${relatedDoc.buyers?.company_name || 'Unknown Buyer'}`
        : log.notes || 'Document activity',
      date: log.created_at,
      documentTitle: relatedDoc?.title || 'Unknown Document'
    };
  });

  // Handle upload button click - opens upload dialog
  const handleUpload = (doc: any) => {
    setUploadDialogDoc(doc);
  };

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
        <Card 
          className="cursor-pointer hover:bg-accent transition-colors" 
          onClick={() => handleStatClick('total')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:bg-accent transition-colors" 
          onClick={() => handleStatClick('pending')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:bg-accent transition-colors" 
          onClick={() => handleStatClick('submitted')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:bg-accent transition-colors" 
          onClick={() => handleStatClick('approved')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:bg-accent transition-colors" 
          onClick={() => handleStatClick('rejected')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:bg-accent transition-colors" 
          onClick={() => handleStatClick('expiring_soon')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.expiringSoon}</div>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:bg-accent transition-colors" 
          onClick={() => handleStatClick('expired')}
        >
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
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="documents">All Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="expiring">Expiring Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-6">
          {/* Collapsible Filters Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Search document requests..."
                    value={filters.search}
                    onChange={handleSearchChange}
                    className="pl-10"
                    autoComplete="off"
                  />
                </div>
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-white text-green-600">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </div>
              
              {showFilters && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Status Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select 
                        value={filters.status || 'all'} 
                        onValueChange={(value) => setFilters(prev => ({ 
                          ...prev, 
                          status: value === 'all' ? '' : value 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Category Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <Select 
                        value={filters.category || 'all'} 
                        onValueChange={(value) => setFilters(prev => ({ 
                          ...prev, 
                          category: value === 'all' ? '' : value 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="compliance">Compliance</SelectItem>
                          <SelectItem value="certification">Certification</SelectItem>
                          <SelectItem value="insurance">Insurance</SelectItem>
                          <SelectItem value="quality">Quality</SelectItem>
                          <SelectItem value="safety">Safety</SelectItem>
                          <SelectItem value="financial">Financial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Document Type Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Document Type</label>
                      <Select 
                        value={filters.documentType || 'all'} 
                        onValueChange={(value) => setFilters(prev => ({ 
                          ...prev, 
                          documentType: value === 'all' ? '' : value 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="certificate">Certificate</SelectItem>
                          <SelectItem value="license">License</SelectItem>
                          <SelectItem value="permit">Permit</SelectItem>
                          <SelectItem value="policy">Policy</SelectItem>
                          <SelectItem value="report">Report</SelectItem>
                          <SelectItem value="invoice">Invoice</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Range Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date Range</label>
                      <Select 
                        value={filters.dateRange || 'all'} 
                        onValueChange={(value) => setFilters(prev => ({ 
                          ...prev, 
                          dateRange: value === 'all' ? '' : value 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                          <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                          <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                          <SelectItem value="this_year">This Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Buyer and Expiration Status Filters - Separate row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Buyer</label>
                      <Select 
                        value={filters.buyer || 'all'} 
                        onValueChange={(value) => setFilters(prev => ({ 
                          ...prev, 
                          buyer: value === 'all' ? '' : value 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All buyers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Buyers</SelectItem>
                          {uniqueBuyers.map((buyer) => (
                            <SelectItem key={buyer} value={buyer}>
                              {buyer}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Expiration Status</label>
                      <Select 
                        value={filters.expirationStatus || 'all'} 
                        onValueChange={(value) => setFilters(prev => ({ 
                          ...prev, 
                          expirationStatus: value === 'all' ? '' : value 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All documents" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Documents</SelectItem>
                          <SelectItem value="expiring_soon">Expiring Soon (30 days)</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="valid">Valid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {activeFiltersCount > 0 && (
                    <div className="flex justify-end pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setFilters({
                          search: filters.search, // Keep search value
                          status: '',
                          category: '',
                          documentType: '',
                          buyer: '',
                          expirationStatus: '',
                          dateRange: ''
                        })}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Document Requests ({documents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length > 0 ? (
                <div className="grid gap-6">
                  {documents.map(doc => {
                    const latestUpload = getLatestUpload(doc.document_uploads);
                    return (
                      <DocumentCard
                        key={doc.id}
                        document={{
                          ...doc,
                          buyer: doc.buyers,
                          ...(latestUpload && {
                            file_name: latestUpload.file_name,
                            file_size: latestUpload.file_size,
                            expiration_date: latestUpload.expiration_date,
                            uploader: latestUpload.uploader
                          })
                        }}
                        userRole="supplier"
                        onView={() => console.log('View document:', doc.id)}
                        onDownload={() => console.log('Download document:', doc.id)}
                        onUpload={() => handleUpload(doc)}
                        onRenewalSuccess={loadDocuments}
                      />
                    );
                  })}
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

        <TabsContent value="expiring">
          <Card>
            <CardHeader>
              <CardTitle>Expiring & Expired Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.filter(doc => {
                const upload = getLatestUpload(doc.document_uploads);
                if (!upload?.expiration_date || upload.status !== 'approved') return false;
                const expDate = new Date(upload.expiration_date);
                const today = new Date();
                const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                return expDate <= thirtyDaysFromNow;
              }).length > 0 ? (
                <div className="grid gap-6">
                  {documents
                    .filter(doc => {
                      const upload = getLatestUpload(doc.document_uploads);
                      if (!upload?.expiration_date || upload.status !== 'approved') return false;
                      const expDate = new Date(upload.expiration_date);
                      const today = new Date();
                      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                      return expDate <= thirtyDaysFromNow;
                    })
                    .map(doc => {
                      const latestUpload = getLatestUpload(doc.document_uploads);
                      return (
                        <div 
                          key={doc.id}
                          id={`doc-${doc.id}`}
                          className={`transition-all duration-500 ${
                            highlightedDocId === doc.id 
                              ? 'ring-2 ring-primary ring-offset-2 rounded-lg' 
                              : ''
                          }`}
                        >
                          <DocumentCard
                            document={{
                              ...doc,
                              buyer: doc.buyers,
                              ...(latestUpload && {
                                file_name: latestUpload.file_name,
                                file_size: latestUpload.file_size,
                                expiration_date: latestUpload.expiration_date,
                                uploader: latestUpload.uploader
                              })
                            }}
                            userRole="supplier"
                            onView={() => console.log('View document:', doc.id)}
                            onDownload={() => console.log('Download document:', doc.id)}
                            onUpload={() => handleUpload(doc)}
                            onRenewalSuccess={loadDocuments}
                          />
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Expiring Documents</h3>
                  <p className="text-muted-foreground">All your documents are up to date!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      {uploadDialogDoc && (
        <DocumentUploadDialog
          isOpen={!!uploadDialogDoc}
          onClose={() => setUploadDialogDoc(null)}
          request={uploadDialogDoc}
          onUploadSuccess={() => {
            setUploadDialogDoc(null);
            loadDocuments();
          }}
        />
      )}
    </div>
  );
};

export default SupplierDocumentsDashboard;