
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, 
  Search, 
  Filter, 
  Calendar,
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import DocumentCard from './DocumentCard';

interface BuyerDocumentsManagerProps {
  documents: any[];
  onApprove: (documentId: string) => void;
  onDecline: (documentId: string) => void;
  onRefresh: () => void;
}

const BuyerDocumentsManager = ({ 
  documents, 
  onApprove, 
  onDecline, 
  onRefresh 
}: BuyerDocumentsManagerProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedDocumentType, setSelectedDocumentType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expirationFilter, setExpirationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Get unique suppliers from documents
  const suppliers = useMemo(() => {
    const uniqueSuppliers = Array.from(
      new Set(
        documents
          .filter(doc => doc.suppliers?.company_name)
          .map(doc => doc.suppliers.company_name)
      )
    ).sort();
    return uniqueSuppliers;
  }, [documents]);

  // Get unique document types
  const documentTypes = useMemo(() => {
    const uniqueTypes = Array.from(
      new Set(documents.map(doc => doc.document_type))
    ).sort();
    return uniqueTypes;
  }, [documents]);

  // Get unique categories
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(documents.map(doc => doc.category))
    ).sort();
    return uniqueCategories;
  }, [documents]);

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let filtered = documents.filter(doc => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          doc.title.toLowerCase().includes(searchLower) ||
          doc.document_type.toLowerCase().includes(searchLower) ||
          doc.suppliers?.company_name?.toLowerCase().includes(searchLower) ||
          doc.category.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Supplier filter
      if (selectedSupplier !== 'all' && doc.suppliers?.company_name !== selectedSupplier) {
        return false;
      }

      // Document type filter
      if (selectedDocumentType !== 'all' && doc.document_type !== selectedDocumentType) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && doc.category !== selectedCategory) {
        return false;
      }

      // Expiration filter
      if (expirationFilter !== 'all' && doc.document_uploads?.[0]?.expiration_date) {
        const expirationDate = new Date(doc.document_uploads[0].expiration_date);
        const today = new Date();
        const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        switch (expirationFilter) {
          case 'expired':
            if (expirationDate >= today) return false;
            break;
          case 'expiring_soon':
            if (expirationDate < today || expirationDate > thirtyDaysFromNow) return false;
            break;
          case 'valid':
            if (expirationDate < today) return false;
            break;
        }
      }

      return true;
    });

    // Sort documents
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'title':
          aValue = a.title;
          bValue = b.title;
          break;
        case 'supplier':
          aValue = a.suppliers?.company_name || '';
          bValue = b.suppliers?.company_name || '';
          break;
        case 'document_type':
          aValue = a.document_type;
          bValue = b.document_type;
          break;
        case 'expiration_date':
          aValue = a.document_uploads?.[0]?.expiration_date || '9999-12-31';
          bValue = b.document_uploads?.[0]?.expiration_date || '9999-12-31';
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default: // created_at
          aValue = a.created_at;
          bValue = b.created_at;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [documents, searchTerm, selectedSupplier, selectedDocumentType, selectedCategory, expirationFilter, sortBy, sortOrder]);

  // Group documents by status
  const documentsByStatus = useMemo(() => {
    return {
      pending: filteredDocuments.filter(doc => doc.status === 'pending'),
      submitted: filteredDocuments.filter(doc => doc.status === 'submitted'),
      approved: filteredDocuments.filter(doc => doc.status === 'approved'),
      rejected: filteredDocuments.filter(doc => doc.status === 'rejected')
    };
  }, [filteredDocuments]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedSupplier('all');
    setSelectedDocumentType('all');
    setSelectedCategory('all');
    setExpirationFilter('all');
  };

  const DocumentSection = ({ docs, title, statusColor }: { docs: any[], title: string, statusColor: string }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title} ({docs.length})</span>
          <Badge variant="outline" className={statusColor}>
            {docs.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {docs.length > 0 ? (
          <div className="space-y-4">
            {docs.map(doc => (
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
                onApprove={() => onApprove(doc.id)}
                onDecline={() => onDecline(doc.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No {title.toLowerCase()} documents</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Document Manager</h2>
        <Button variant="outline" onClick={onRefresh} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Advanced Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Advanced Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Supplier Filter */}
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger>
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier} value={supplier}>
                    {supplier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Document Type Filter */}
            <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="All Document Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Document Types</SelectItem>
                {documentTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Expiration Filter */}
            <Select value={expirationFilter} onValueChange={setExpirationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Expiration Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Documents</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon (30 days)</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Options */}
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Date Created</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="document_type">Document Type</SelectItem>
                  <SelectItem value="expiration_date">Expiration Date</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>

          {/* Clear Filters */}
          <div className="flex justify-end">
            <Button variant="ghost" onClick={clearFilters}>
              Clear All Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents by Status Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">
            All ({filteredDocuments.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pending ({documentsByStatus.pending.length})
          </TabsTrigger>
          <TabsTrigger value="submitted" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Awaiting Review ({documentsByStatus.submitted.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Approved ({documentsByStatus.approved.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Rejected ({documentsByStatus.rejected.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Documents ({filteredDocuments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredDocuments.length > 0 ? (
                <div className="space-y-4">
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
                      onView={() => console.log('View document:', doc.id)}
                      onDownload={() => console.log('Download document:', doc.id)}
                      onApprove={() => onApprove(doc.id)}
                      onDecline={() => onDecline(doc.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Found</h3>
                  <p className="text-gray-500">
                    No documents match your current filters.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <DocumentSection 
            docs={documentsByStatus.pending} 
            title="Pending Documents" 
            statusColor="text-yellow-600" 
          />
        </TabsContent>

        <TabsContent value="submitted">
          <DocumentSection 
            docs={documentsByStatus.submitted} 
            title="Documents Awaiting Review" 
            statusColor="text-blue-600" 
          />
        </TabsContent>

        <TabsContent value="approved">
          <DocumentSection 
            docs={documentsByStatus.approved} 
            title="Approved Documents" 
            statusColor="text-green-600" 
          />
        </TabsContent>

        <TabsContent value="rejected">
          <DocumentSection 
            docs={documentsByStatus.rejected} 
            title="Rejected Documents" 
            statusColor="text-red-600" 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BuyerDocumentsManager;
