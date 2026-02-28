import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FileImage, 
  Upload, 
  Trash2, 
  Eye, 
  Search, 
  FileText, 
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Edit2,
  Loader2,
  ExternalLink,
  Filter,
  FolderOpen,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getComplianceDocuments } from '@/components/requests/ComplianceDocuments';
import { SampleTemplateUploadModal } from './SampleTemplateUploadModal';
import { useDocumentSets } from '@/hooks/useDocumentSets';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SampleTemplate {
  id: string;
  buyer_id: string;
  document_type: string;
  sample_file_path: string;
  sample_file_name: string;
  sample_file_size: number | null;
  sample_mime_type: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// Helper component for template preview with signed URL
function TemplatePreviewContent({ template }: { template: SampleTemplate }) {
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSignedUrl = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('sample-documents')
        .createSignedUrl(template.sample_file_path, 300);

      if (error) throw error;
      setSignedUrl(data.signedUrl);
      return data.signedUrl;
    } catch (err) {
      console.error('Error fetching signed URL:', err);
      toast({
        title: 'Error',
        description: 'Failed to load preview',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const url = signedUrl || await fetchSignedUrl();
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = template.sample_file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenInNewTab = async () => {
    const url = signedUrl || await fetchSignedUrl();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPreviewable = template.sample_mime_type?.startsWith('image/') || template.sample_mime_type === 'application/pdf';

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleOpenInNewTab} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
          Open in New Tab
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          Download
        </Button>
      </div>
      {!signedUrl && isPreviewable && (
        <Button variant="ghost" size="sm" onClick={fetchSignedUrl} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
          Load Preview
        </Button>
      )}
      {signedUrl && template.sample_mime_type?.startsWith('image/') && (
        <img src={signedUrl} alt="Preview" className="max-w-full h-auto rounded-lg border" />
      )}
      {signedUrl && template.sample_mime_type === 'application/pdf' && (
        <iframe src={signedUrl} className="w-full h-[400px] rounded-lg border" title="PDF Preview" />
      )}
    </div>
  );
}

interface SampleTemplateManagerProps {
  buyerId: string;
}

export function SampleTemplateManager({ buyerId }: SampleTemplateManagerProps) {
  const [templates, setTemplates] = useState<SampleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<SampleTemplate | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<SampleTemplate | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<SampleTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // New filter states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRegulatoryBody, setSelectedRegulatoryBody] = useState('all');
  const [selectedSetId, setSelectedSetId] = useState('all');
  const [uploadStatus, setUploadStatus] = useState<'all' | 'uploaded' | 'not-uploaded'>('all');
  
  const { toast } = useToast();
  const { documentSets } = useDocumentSets(buyerId);

  // Get all available document types
  const allDocumentTypes = useMemo(() => {
    const generalDocs = getComplianceDocuments('General Supplier');
    const eggDocs = getComplianceDocuments('Egg Processing');
    
    // Combine and deduplicate by title
    const combined = [...generalDocs, ...eggDocs];
    const unique = combined.reduce((acc, doc) => {
      if (!acc.find(d => d.title === doc.title)) {
        acc.push(doc);
      }
      return acc;
    }, [] as typeof combined);
    
    return unique.sort((a, b) => a.title.localeCompare(b.title));
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('buyer_sample_templates')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('document_type');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching sample templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sample templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (buyerId) {
      fetchTemplates();
    }
  }, [buyerId]);

  const handleUploadClick = (docType: string) => {
    setSelectedDocType(docType);
    setEditingTemplate(null);
    setUploadModalOpen(true);
  };

  const handleEditClick = (template: SampleTemplate) => {
    setSelectedDocType(template.document_type);
    setEditingTemplate(template);
    setUploadModalOpen(true);
  };

  const handleDeleteClick = (template: SampleTemplate) => {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;
    
    setDeleting(true);
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('sample-documents')
        .remove([templateToDelete.sample_file_path]);

      if (storageError) {
        console.warn('Storage delete warning:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('buyer_sample_templates')
        .delete()
        .eq('id', templateToDelete.id);

      if (dbError) throw dbError;

      toast({
        title: 'Template Deleted',
        description: `Sample template for "${templateToDelete.document_type}" has been removed.`,
      });

      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete sample template',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleUploadSuccess = () => {
    setUploadModalOpen(false);
    setSelectedDocType(null);
    setEditingTemplate(null);
    fetchTemplates();
  };

  // Get template for a document type
  const getTemplateForDocType = (docType: string) => {
    return templates.find(t => t.document_type === docType);
  };

  // Extract unique categories and regulatory bodies
  const filterOptions = useMemo(() => {
    const categories = [...new Set(allDocumentTypes.map(d => d.category))].sort();
    const regulatoryBodies = [...new Set(allDocumentTypes.map(d => d.regulatoryBody))].sort();
    return { categories, regulatoryBodies };
  }, [allDocumentTypes]);

  // Enhanced filtering logic
  const filteredDocTypes = useMemo(() => {
    let filtered = allDocumentTypes;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(query) ||
        doc.category.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(doc => doc.category === selectedCategory);
    }

    // Regulatory body filter
    if (selectedRegulatoryBody !== 'all') {
      filtered = filtered.filter(doc => doc.regulatoryBody === selectedRegulatoryBody);
    }

    // Document set filter
    if (selectedSetId !== 'all') {
      const selectedSet = documentSets?.find(s => s.id === selectedSetId);
      if (selectedSet) {
        const docIds = Array.isArray(selectedSet.document_ids) 
          ? selectedSet.document_ids 
          : [];
        filtered = filtered.filter(doc => docIds.includes(doc.id));
      }
    }

    // Upload status filter
    if (uploadStatus === 'uploaded') {
      filtered = filtered.filter(doc => !!getTemplateForDocType(doc.title));
    } else if (uploadStatus === 'not-uploaded') {
      filtered = filtered.filter(doc => !getTemplateForDocType(doc.title));
    }

    return filtered;
  }, [allDocumentTypes, searchQuery, selectedCategory, selectedRegulatoryBody, selectedSetId, documentSets, uploadStatus, templates]);

  // Stats - based on filtered results
  const stats = useMemo(() => {
    const total = allDocumentTypes.length;
    const configured = templates.length;
    const filteredTotal = filteredDocTypes.length;
    const filteredConfigured = filteredDocTypes.filter(doc => !!getTemplateForDocType(doc.title)).length;
    return { 
      total, 
      configured, 
      remaining: total - configured,
      filteredTotal,
      filteredConfigured,
      filteredRemaining: filteredTotal - filteredConfigured
    };
  }, [allDocumentTypes, templates, filteredDocTypes]);

  // Check if any filters are active
  const hasActiveFilters = selectedCategory !== 'all' || 
    selectedRegulatoryBody !== 'all' || 
    selectedSetId !== 'all' || 
    uploadStatus !== 'all' ||
    searchQuery.trim() !== '';

  const clearAllFilters = () => {
    setSelectedCategory('all');
    setSelectedRegulatoryBody('all');
    setSelectedSetId('all');
    setUploadStatus('all');
    setSearchQuery('');
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Sample Templates</h2>
          <p className="text-muted-foreground">
            Upload sample documents for each document type. These will be automatically attached to new requests.
          </p>
        </div>
        <Button onClick={() => fetchTemplates()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Document Types</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.configured}</p>
                <p className="text-sm text-muted-foreground">Templates Uploaded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <XCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.remaining}</p>
                <p className="text-sm text-muted-foreground">Without Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card className="border-border/50">
        <CardContent className="pt-6 space-y-4">
          {/* Filter Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
                <X className="h-3 w-3 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          {/* Filter Dropdowns Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Category Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {filterOptions.categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Regulatory Body Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Regulatory Body</label>
              <Select value={selectedRegulatoryBody} onValueChange={setSelectedRegulatoryBody}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Regulatory Bodies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regulatory Bodies</SelectItem>
                  {filterOptions.regulatoryBodies.map(reg => (
                    <SelectItem key={reg} value={reg}>{reg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Document Sets Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                Document Set
              </label>
              <Select value={selectedSetId} onValueChange={setSelectedSetId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Document Sets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Document Sets</SelectItem>
                  {documentSets?.map(set => (
                    <SelectItem key={set.id} value={set.id}>
                      {set.set_name}
                      {set.is_default && (
                        <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Upload Status Tabs */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Upload Status</label>
            <Tabs value={uploadStatus} onValueChange={(v) => setUploadStatus(v as typeof uploadStatus)}>
              <TabsList className="grid w-full grid-cols-3 h-9">
                <TabsTrigger value="all" className="text-xs">
                  All ({stats.total})
                </TabsTrigger>
                <TabsTrigger value="uploaded" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Uploaded ({stats.configured})
                </TabsTrigger>
                <TabsTrigger value="not-uploaded" className="text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  Needs Template ({stats.remaining})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search document types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9"
            />
          </div>

          {/* Filter Results Summary */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1 border-t">
              <span>Showing <span className="font-medium text-foreground">{stats.filteredTotal}</span> of {stats.total} document types</span>
              {stats.filteredConfigured > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {stats.filteredConfigured} with templates
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Type List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            Document Types
          </CardTitle>
          <CardDescription>
            Click "Upload Sample" to add a reference document for suppliers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-lg" />
                    <div className="space-y-2">
                      <div className="w-40 h-4 bg-muted rounded" />
                      <div className="w-24 h-3 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="w-24 h-8 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : filteredDocTypes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No document types match your search
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocTypes.map(doc => {
                const template = getTemplateForDocType(doc.title);
                const hasTemplate = !!template;
                const Icon = doc.icon || FileText;

                return (
                  <div 
                    key={doc.id} 
                    className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                      hasTemplate ? 'bg-green-500/5 border-green-500/20' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-lg ${hasTemplate ? 'bg-green-500/10' : 'bg-muted'}`}>
                        <Icon className={`h-5 w-5 ${hasTemplate ? 'text-green-500' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{doc.title}</p>
                          {hasTemplate && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Template Set
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {hasTemplate 
                            ? `${template.sample_file_name} • ${formatFileSize(template.sample_file_size)}`
                            : doc.category
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {hasTemplate ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingTemplate(template)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(template)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(template)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUploadClick(doc.title)}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Sample
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <SampleTemplateUploadModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setSelectedDocType(null);
          setEditingTemplate(null);
        }}
        onSuccess={handleUploadSuccess}
        buyerId={buyerId}
        documentType={selectedDocType || ''}
        existingTemplate={editingTemplate}
      />

      {/* Preview Modal */}
      <Dialog open={!!viewingTemplate} onOpenChange={() => setViewingTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {viewingTemplate?.sample_file_name}
            </DialogTitle>
          </DialogHeader>
          {viewingTemplate && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{viewingTemplate.sample_file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(viewingTemplate.sample_file_size)} • {viewingTemplate.document_type}
                  </p>
                </div>
              </div>
              {viewingTemplate.notes && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Guidance Notes:</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingTemplate.notes}</p>
                </div>
              )}
              <TemplatePreviewContent template={viewingTemplate} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sample Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the sample template for "{templateToDelete?.document_type}". 
              New requests for this document type will no longer have an auto-attached sample.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SampleTemplateManager;
