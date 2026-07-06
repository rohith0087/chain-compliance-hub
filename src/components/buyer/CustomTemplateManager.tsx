import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, FileText, Download, Eye, Trash2, CheckCircle, Ban, AlertTriangle, Calendar, type LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CustomTemplateUploadModal } from './CustomTemplateUploadModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  reviewActionButtonDangerClass,
  reviewActionButtonSecondaryClass,
  reviewCardContainerClass,
  reviewEmptyStateContainerClass,
  reviewPageSubtitleClass,
  reviewPageTitleClass,
  reviewSectionHeaderClass,
  reviewToolbarSelectTriggerClass,
} from '@/components/documents/buyerReviewDesignSystem';
import ReviewPagination from '@/components/documents/ReviewPagination';

interface CustomTemplate {
  id: string;
  template_name: string;
  description: string;
  document_type: string;
  category: string;
  file_path: string;
  file_name: string;
  file_size: number;
  template_version: number;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  usage_count: number;
}

interface TemplateStatusConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

// Template lifecycle status is distinct from document-submission status
// (STATUS_BADGE_CONFIG), so it gets its own small, page-local config.
const TEMPLATE_STATUS_CONFIG: Record<'active' | 'inactive' | 'expired', TemplateStatusConfig> = {
  active: { label: 'Active', icon: CheckCircle, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inactive: { label: 'Inactive', icon: Ban, className: 'bg-muted text-muted-foreground border-border' },
  expired: { label: 'Expired', icon: AlertTriangle, className: 'bg-red-50 text-red-700 border-red-200' },
};

// Template categories (Risk Control, Traceability, etc.) are a different
// taxonomy than CATEGORY_BADGE_CLASS's document categories, so they get
// their own color cycle here rather than falling through to a default gray.
const TEMPLATE_CATEGORY_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-pink-50 text-pink-700 border-pink-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
];

function getCategoryClass(category: string, allCategories: string[]): string {
  const index = Math.max(0, allCategories.indexOf(category));
  return TEMPLATE_CATEGORY_COLORS[index % TEMPLATE_CATEGORY_COLORS.length];
}

export const CustomTemplateManager = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<CustomTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const categories = [
    'all',
    'Risk Control',
    'Traceability',
    'Onboarding/Approval',
    'Ethical Sourcing',
    'Audit Readiness',
    'Quality Management',
    'Health & Safety',
    'Environmental',
    'Financial',
    'Other'
  ];

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm, selectedCategory]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory]);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);

      // Step 1: Check if user is a team member
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', user?.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .maybeSingle();

      // Step 2: Resolve buyer ID
      const buyerId = teamMember?.company_id || user?.id;

      // Step 3: Get buyer profile using resolved ID
      const { data: buyerData, error: buyerError } = await supabase
        .from('buyers')
        .select('id')
        .eq('id', buyerId)
        .single();

      if (buyerError || !buyerData) {
        console.error('Error fetching buyer profile:', buyerError);
        throw new Error('Buyer profile not found');
      }

      // Fetch templates
      const { data, error } = await supabase
        .from('custom_document_templates')
        .select('*')
        .eq('buyer_id', buyerData.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to fetch templates');
    } finally {
      setIsLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = templates;

    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.document_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    setFilteredTemplates(filtered);
  };

  const handleDownloadTemplate = async (template: CustomTemplate) => {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-documents')
        .download(template.file_path);

      if (error) {
        throw error;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = template.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Template downloaded');
    } catch (error: any) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    }
  };

  const handlePreviewTemplate = async (template: CustomTemplate) => {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-documents')
        .createSignedUrl(template.file_path, 60);

      if (error) {
        throw error;
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      console.error('Error previewing template:', error);
      toast.error('Failed to preview template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      // Get the template's file path before deletion
      const templateToDelete = templates.find(t => t.id === templateId);

      // Set custom_template_id to NULL in related document_requests
      await supabase
        .from('document_requests')
        .update({ custom_template_id: null })
        .eq('custom_template_id', templateId);

      // Delete the template from the database
      const { error: deleteError } = await supabase
        .from('custom_document_templates')
        .delete()
        .eq('id', templateId);

      if (deleteError) {
        throw deleteError;
      }

      // Delete the file from storage
      if (templateToDelete?.file_path) {
        await supabase.storage
          .from('compliance-documents')
          .remove([templateToDelete.file_path]);
      }

      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isExpired = (expiresAt: string | null) => {
    return Boolean(expiresAt && new Date(expiresAt) < new Date());
  };

  const getTemplateStatus = (template: CustomTemplate): TemplateStatusConfig => {
    if (isExpired(template.expires_at)) return TEMPLATE_STATUS_CONFIG.expired;
    if (!template.is_active) return TEMPLATE_STATUS_CONFIG.inactive;
    return TEMPLATE_STATUS_CONFIG.active;
  };

  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pageTemplates = filteredTemplates.slice(pageStart, pageStart + rowsPerPage);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted rounded animate-pulse"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[88px] bg-muted rounded-[16px] animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pt-7 pb-5 flex justify-between items-start">
        <div>
          <h2 className={reviewPageTitleClass}>Custom Templates</h2>
          <p className={reviewPageSubtitleClass}>
            Manage your custom document templates for supplier requests
          </p>
        </div>
        <Button className="rounded-[10px]" onClick={() => setIsUploadModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Template
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-10 ${reviewToolbarSelectTriggerClass}`}
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className={`w-[180px] ${reviewToolbarSelectTriggerClass}`}>
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className={reviewEmptyStateContainerClass}>
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/70 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchTerm || selectedCategory !== 'all' ? 'No templates found' : 'No templates yet'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || selectedCategory !== 'all'
              ? 'Try adjusting your search criteria'
              : 'Upload your first custom template to get started'}
          </p>
          {!searchTerm && selectedCategory === 'all' && (
            <Button className="rounded-[10px]" onClick={() => setIsUploadModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Upload Template
            </Button>
          )}
        </div>
      ) : (
        <div className={reviewCardContainerClass}>
          <Table>
            <TableHeader>
              <TableRow className="h-[56px] bg-card border-b border-border hover:bg-card">
                <TableHead className={`px-3 ${reviewSectionHeaderClass}`}>Template</TableHead>
                <TableHead className={`px-3 ${reviewSectionHeaderClass}`}>Category</TableHead>
                <TableHead className={`px-3 ${reviewSectionHeaderClass}`}>Document Type</TableHead>
                <TableHead className={`px-3 ${reviewSectionHeaderClass}`}>Status</TableHead>
                <TableHead className={`px-3 ${reviewSectionHeaderClass}`}>Usage</TableHead>
                <TableHead className={`px-3 ${reviewSectionHeaderClass}`}>Created</TableHead>
                <TableHead className={`px-3 text-right ${reviewSectionHeaderClass}`}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageTemplates.map((template) => {
                const status = getTemplateStatus(template);
                const StatusIcon = status.icon;
                return (
                  <TableRow key={template.id} className="h-[88px] border-b border-border hover:bg-muted/50">
                    <TableCell className="px-3 py-3">
                      <div className="flex items-start gap-3">
                        <div className="w-[40px] h-[40px] rounded-[10px] bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-[#2563EB]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-foreground truncate" title={template.template_name}>{template.template_name}</p>
                          {template.description && (
                            <p className="text-[13px] text-muted-foreground truncate" title={template.description}>{template.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <Badge variant="outline" className={`text-[12px] px-2 py-0.5 rounded-full font-medium border ${getCategoryClass(template.category, categories)}`}>
                        {template.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-[13px] text-muted-foreground truncate">{template.document_type}</TableCell>
                    <TableCell className="px-3 py-3">
                      <Badge variant="outline" className={`text-[12px] px-2 py-0.5 rounded-full font-medium border flex items-center justify-center w-fit ${status.className}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />{status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-[13px] text-muted-foreground">
                      {formatFileSize(template.file_size)} · Used {template.usage_count}x
                    </TableCell>
                    <TableCell className="px-3 py-3 text-[13px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                        {new Date(template.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                        <Button
                          size="icon"
                          variant="outline"
                          className={reviewActionButtonSecondaryClass}
                          onClick={() => handlePreviewTemplate(template)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className={reviewActionButtonSecondaryClass}
                          onClick={() => handleDownloadTemplate(template)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className={reviewActionButtonDangerClass}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Template</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{template.template_name}"?
                                This action cannot be undone and will affect any pending requests using this template.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ReviewPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageStart={pageStart}
        pageSize={rowsPerPage}
        totalCount={filteredTemplates.length}
        itemLabel="templates"
        onPageChange={setPage}
        onPageSizeChange={setRowsPerPage}
      />

      <CustomTemplateUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={fetchTemplates}
      />
    </div>
  );
};

export default CustomTemplateManager;
