import React, { useState, useEffect } from 'react';
import { useSuppliers } from '@/hooks/useSuppliers';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Search, Filter, Plus, Download, Eye, Trash2 } from 'lucide-react';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentContentViewer } from './DocumentContentViewer';
import { useBranchContext } from '@/contexts/BranchContext';
import { toast } from 'sonner';

interface SupplierDocument {
  id: string;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size: number;
  category: string;
  tags: string[];
  description: string;
  version: number;
  is_current_version: boolean;
  extraction_status: string;
  content_extracted: string;
  content_summary: string;
  created_at: string;
  updated_at: string;
}

interface SupplierDocumentLibraryProps {
  supplierId: string;
}

export const SupplierDocumentLibrary: React.FC<SupplierDocumentLibraryProps> = ({
  supplierId
}) => {
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<SupplierDocument | null>(null);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const { currentBranch, allBranchesView } = useBranchContext();

  useEffect(() => {
    fetchDocuments();
  }, [supplierId, currentBranch?.id, allBranchesView]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      
      // Build query with branch filter if needed
      const branchFilter = !allBranchesView && currentBranch?.id 
        ? { branch_id: currentBranch.id }
        : {};

      const { data, error } = await supabase
        .from('supplier_document_library')
        .select('*')
        .eq('supplier_id', supplierId)
        .eq('is_current_version', true)
        .match(branchFilter)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        toast.error('Failed to load documents');
        return;
      }

      setDocuments(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = () => {
    setShowUploadModal(false);
    fetchDocuments();
    toast.success('Document uploaded successfully');
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('supplier_document_library')
        .delete()
        .eq('id', documentId);

      if (error) {
        console.error('Error deleting document:', error);
        toast.error('Failed to delete document');
        return;
      }

      setDocuments(docs => docs.filter(doc => doc.id !== documentId));
      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleViewContent = (document: SupplierDocument) => {
    setSelectedDocument(document);
    setShowContentViewer(true);
  };

  const handleDownload = async (document: SupplierDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-documents')
        .download(document.file_path);

      if (error) {
        console.error('Error downloading file:', error);
        toast.error('Failed to download document');
        return;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.document_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to download document');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-muted text-foreground';
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.document_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || doc.extraction_status === filterStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = Array.from(new Set(documents.map(doc => doc.category).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Document Library</h2>
          <p className="text-muted-foreground">
            Manage and organize your company documents
          </p>
        </div>
        <Button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Processed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">No documents found</h3>
              <p className="text-muted-foreground">
                {documents.length === 0 
                  ? "Upload your first document to get started"
                  : "Try adjusting your search or filter criteria"
                }
              </p>
            </div>
            {documents.length === 0 && (
              <Button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Document
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((document) => (
            <Card key={document.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-base font-medium line-clamp-2">
                      {document.document_name}
                    </CardTitle>
                    {document.description && (
                      <CardDescription className="mt-1 line-clamp-2">
                        {document.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge 
                    variant="secondary"
                    className={`ml-2 ${getStatusColor(document.extraction_status)}`}
                  >
                    {document.extraction_status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1">
                  {document.category && (
                    <Badge variant="outline" className="text-xs">
                      {document.category}
                    </Badge>
                  )}
                  {document.tags?.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                
                {document.content_summary && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {document.content_summary}
                  </p>
                )}
                
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>v{document.version}</span>
                  <span>{new Date(document.created_at).toLocaleDateString()}</span>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewContent(document)}
                    className="flex-1"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(document)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteDocument(document.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <DocumentUploadModal
          supplierId={supplierId}
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={handleUploadComplete}
        />
      )}

      {/* Content Viewer */}
      {showContentViewer && selectedDocument && (
        <DocumentContentViewer
          document={selectedDocument}
          onClose={() => setShowContentViewer(false)}
        />
      )}
    </div>
  );
};