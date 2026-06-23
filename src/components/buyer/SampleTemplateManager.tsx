import { useState, useEffect, useMemo } from 'react';
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
  FolderOpen,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getComplianceDocuments } from '@/components/requests/ComplianceDocuments';
import { SampleTemplateUploadModal } from './SampleTemplateUploadModal';
import { useDocumentSets } from '@/hooks/useDocumentSets';
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
import {
  reviewActionButtonDangerClass,
  reviewActionButtonSecondaryClass,
  reviewCardContainerClass,
  reviewEmptyStateContainerClass,
  reviewMetricCardClass,
  reviewMetricIconCircleClass,
  reviewPageSubtitleClass,
  reviewPageTitleClass,
  reviewToolbarSelectTriggerClass,
} from '@/components/documents/buyerReviewDesignSystem';
import ReviewPagination from '@/components/documents/ReviewPagination';

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
        <Button variant="outline" size="sm" className="rounded-[10px]" onClick={handleOpenInNewTab} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
          Open in New Tab
        </Button>
        <Button variant="outline" size="sm" className="rounded-[10px]" onClick={handleDownload} disabled={loading}>
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
        <img src={signedUrl} alt="Preview" className="max-w-full h-auto rounded-[10px] border border-[#E5E7EB]" />
      )}
      {signedUrl && template.sample_mime_type === 'application/pdf' && (
        <iframe src={signedUrl} className="w-full h-[400px] rounded-[10px] border border-[#E5E7EB]" title="PDF Preview" />
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
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, selectedRegulatoryBody, selectedSetId, uploadStatus, searchQuery]);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalPages = Math.max(1, Math.ceil(filteredDocTypes.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pageDocTypes = filteredDocTypes.slice(pageStart, pageStart + rowsPerPage);

  const uploadStatusTabs: Array<{ value: 'all' | 'uploaded' | 'not-uploaded'; label: string; count: number; badgeClass: string }> = [
    { value: 'all', label: 'All', count: stats.total, badgeClass: 'bg-[#EAF1FF] text-[#2563EB]' },
    { value: 'uploaded', label: 'Uploaded', count: stats.configured, badgeClass: 'bg-[#ECFDF5] text-[#047857]' },
    { value: 'not-uploaded', label: 'Needs Template', count: stats.remaining, badgeClass: 'bg-[#F3F4F6] text-[#374151]' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pt-7 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className={reviewPageTitleClass}>Sample Templates</h2>
          <p className={reviewPageSubtitleClass}>
            Upload sample documents for each document type. These will be automatically attached to new requests.
          </p>
        </div>
        <Button onClick={() => fetchTemplates()} variant="outline" size="sm" className="rounded-[10px]">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={reviewMetricCardClass}>
          <div className={`${reviewMetricIconCircleClass} bg-[#EFF6FF]`}>
            <FileText className="h-5 w-5 text-[#2563EB]" />
          </div>
          <div>
            <p className="text-[20px] font-bold text-[#111827] leading-none">{stats.total}</p>
            <p className="text-[12px] text-[#6B7280]">Document Types</p>
          </div>
        </div>
        <div className={reviewMetricCardClass}>
          <div className={`${reviewMetricIconCircleClass} bg-[#F0FDF4]`}>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[20px] font-bold text-[#111827] leading-none">{stats.configured}</p>
            <p className="text-[12px] text-[#6B7280]">Templates Uploaded</p>
          </div>
        </div>
        <div className={reviewMetricCardClass}>
          <div className={`${reviewMetricIconCircleClass} bg-[#FFFBEB]`}>
            <XCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[20px] font-bold text-[#111827] leading-none">{stats.remaining}</p>
            <p className="text-[12px] text-[#6B7280]">Without Templates</p>
          </div>
        </div>
      </div>

      {/* Upload Status tabs */}
      <div className="h-[56px] border-b border-[#E5E7EB] flex items-center gap-9">
        {uploadStatusTabs.map((tab) => {
          const isActive = uploadStatus === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setUploadStatus(tab.value)}
              className={`relative h-full flex items-center gap-2 text-[14px] font-semibold transition-colors ${
                isActive ? 'text-[#2563EB]' : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              {tab.label}
              <span className={`h-[24px] min-w-[24px] rounded-full px-2 text-[13px] font-bold flex items-center justify-center ${tab.badgeClass}`}>
                {tab.count}
              </span>
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#2563EB] rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
          <Input
            placeholder="Search document types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-10 ${reviewToolbarSelectTriggerClass}`}
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className={`w-[170px] ${reviewToolbarSelectTriggerClass}`}>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {filterOptions.categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedRegulatoryBody} onValueChange={setSelectedRegulatoryBody}>
          <SelectTrigger className={`w-[190px] ${reviewToolbarSelectTriggerClass}`}>
            <SelectValue placeholder="All Regulatory Bodies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regulatory Bodies</SelectItem>
            {filterOptions.regulatoryBodies.map(reg => (
              <SelectItem key={reg} value={reg}>{reg}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedSetId} onValueChange={setSelectedSetId}>
          <SelectTrigger className={`w-[180px] ${reviewToolbarSelectTriggerClass}`}>
            <FolderOpen className="h-3.5 w-3.5 mr-1 text-[#9CA3AF]" />
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
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-[#6B7280]">
            <X className="h-3.5 w-3.5 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
          <span>Showing <span className="font-medium text-[#111827]">{stats.filteredTotal}</span> of {stats.total} document types</span>
          {stats.filteredConfigured > 0 && (
            <Badge variant="secondary" className="text-xs">
              {stats.filteredConfigured} with templates
            </Badge>
          )}
        </div>
      )}

      {/* Document Type List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-[88px] bg-gray-100 rounded-[16px] animate-pulse" />
          ))}
        </div>
      ) : filteredDocTypes.length === 0 ? (
        <div className={reviewEmptyStateContainerClass}>
          <FileImage className="mx-auto h-12 w-12 text-[#9CA3AF] mb-4" />
          <p className="text-[#6B7280]">No document types match your search</p>
        </div>
      ) : (
        <div className={reviewCardContainerClass}>
          {pageDocTypes.map((doc, index) => {
            const template = getTemplateForDocType(doc.title);
            const hasTemplate = !!template;
            const Icon = doc.icon || FileText;

            return (
              <div
                key={doc.id}
                className={`h-[88px] flex items-center justify-between px-4 ${
                  index !== pageDocTypes.length - 1 ? 'border-b border-[#EEF2F7]' : ''
                } ${hasTemplate ? 'bg-emerald-50/30' : 'hover:bg-gray-50/50'}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-[40px] h-[40px] rounded-[10px] flex items-center justify-center flex-shrink-0 ${hasTemplate ? 'bg-[#F0FDF4]' : 'bg-[#EFF6FF]'}`}>
                    <Icon className={`h-5 w-5 ${hasTemplate ? 'text-emerald-600' : 'text-[#2563EB]'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-[#111827] truncate">{doc.title}</p>
                      {hasTemplate && (
                        <Badge variant="outline" className="text-[12px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Template Set
                        </Badge>
                      )}
                    </div>
                    <p className="text-[13px] text-[#6B7280] truncate">
                      {hasTemplate
                        ? `${template.sample_file_name} · ${formatFileSize(template.sample_file_size)}`
                        : doc.category
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
                  {hasTemplate ? (
                    <>
                      <Button size="icon" variant="outline" className={reviewActionButtonSecondaryClass} onClick={() => setViewingTemplate(template)} title="Preview">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" className={reviewActionButtonSecondaryClass} onClick={() => handleEditClick(template)} title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" className={reviewActionButtonDangerClass} onClick={() => handleDeleteClick(template)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" className={reviewActionButtonSecondaryClass} onClick={() => handleUploadClick(doc.title)}>
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

      <ReviewPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageStart={pageStart}
        pageSize={rowsPerPage}
        totalCount={filteredDocTypes.length}
        itemLabel="document types"
        onPageChange={setPage}
        onPageSizeChange={setRowsPerPage}
      />

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
        <DialogContent className="max-w-2xl rounded-[16px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {viewingTemplate?.sample_file_name}
            </DialogTitle>
          </DialogHeader>
          {viewingTemplate && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 border border-[#E5E7EB] rounded-[12px] bg-gray-50/50">
                <FileText className="h-8 w-8 text-[#2563EB]" />
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
