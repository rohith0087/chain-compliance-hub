import { useEffect, useMemo, useState } from 'react';
import logger from '@/utils/logger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  RefreshCw,
  Check,
  Calendar,
  User,
  Download,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Link as LinkIcon,
  Ban,
  MessageSquare,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  LayoutGrid,
  List,
  Sparkles,
  SlidersHorizontal,
  X,
  Pin,
  PinOff,
} from 'lucide-react';
import DocumentCardWithSelection from './DocumentCardWithSelection';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DocumentLinkModal } from './DocumentLinkModal';
import { resolveStoragePath } from '@/utils/storagePath';
import { BulkDownloadOptionsDialog } from './BulkDownloadOptionsDialog';
import { BulkDownloadOverlay } from './BulkDownloadOverlay';
import ApprovedDocumentSummaryModal from './ApprovedDocumentSummaryModal';
import { DocumentNotesModal } from './DocumentNotesModal';
import DocumentPreviewModal from './DocumentPreviewModal';
import ReviewPagination from './ReviewPagination';
import { STATUS_BADGE_CONFIG, CATEGORY_BADGE_CLASS } from './buyerReviewDesignSystem';

interface BuyerDocumentsManagerProps {
  documents: any[];
  onApprove: (documentId: string) => Promise<void>;
  onDecline: (documentId: string) => void;
  onWithdraw: (documentId: string, documentTitle: string) => void;
  onRefresh: () => Promise<void>;
  approveLoading?: string | null;
  declineLoading?: string | null;
  withdrawLoading?: string | null;
}

type StatusTab = 'all' | 'pending_approval' | 'approved' | 'declined' | 'pinned';
type SortKey = 'created_at' | 'title' | 'supplier';

// No taxonomy column exists for this second badge -- derive a reasonable
// classification label from the document type/title rather than fabricate
// a new schema field.
function classifyDocument(doc: any): string {
  const haystack = `${doc.document_type || ''} ${doc.template_type || ''} ${doc.title || ''}`.toLowerCase();
  if (haystack.includes('certificat')) return 'Certification';
  if (haystack.includes('questionnaire')) return 'Questionnaire';
  if (haystack.includes('polic')) return 'Policy';
  if (haystack.includes('report')) return 'Report';
  if (haystack.includes('invoice')) return 'Invoice';
  if (haystack.includes('permit') || haystack.includes('licens')) return 'License';
  return 'Document';
}

// No human-readable supplier number exists in the schema (only a UUID) --
// this is a stable, deterministic per-supplier display label, not a real ID.
function supplierShortId(supplierId?: string): string {
  if (!supplierId) return '—';
  return `SUP-${supplierId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isExpiringSoon(expirationDate?: string): boolean {
  if (!expirationDate) return false;
  const expDate = new Date(expirationDate);
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  return expDate <= thirtyDaysFromNow && expDate >= today;
}

function isExpired(expirationDate?: string): boolean {
  if (!expirationDate) return false;
  return new Date(expirationDate) < new Date();
}

function aiInsight(doc: any, expirationDate?: string): { label: string; description: string } {
  if (isExpired(expirationDate)) {
    return { label: 'AI: High priority', description: 'This document is overdue. Recommend requesting renewal immediately from the supplier to maintain compliance.' };
  }
  if (isExpiringSoon(expirationDate)) {
    return { label: 'AI: Renew now', description: `This document expires on ${formatDate(expirationDate)}. Recommended action: send a renewal request to the supplier now.` };
  }
  if (doc.status === 'pending' || doc.status === 'submitted') {
    return { label: 'AI: Review recommended', description: 'Recommend manual review before approval.' };
  }
  return { label: 'AI: Summary', description: `This ${doc.document_type} is approved and linked to ${doc.suppliers?.company_name || 'the supplier'}. No immediate action is required.` };
}

// Helper to get the latest upload (most recent by created_at)
const getLatestUpload = (uploads: any[] | undefined) => {
  if (!uploads || uploads.length === 0) return null;
  if (uploads.length === 1) return uploads[0];
  return uploads.slice().sort((a, b) =>
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )[0];
};

const BuyerDocumentsManager = ({
  documents,
  onApprove,
  onDecline,
  onWithdraw,
  onRefresh,
  approveLoading,
  declineLoading,
  withdrawLoading
}: BuyerDocumentsManagerProps) => {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category: '',
    documentType: '',
    supplier: '',
    expirationStatus: '',
    uploadDateRange: '',
    specificYear: '',
    facilityLocation: ''
  });
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const [downloading, setDownloading] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [downloadMode, setDownloadMode] = useState<'current' | 'all'>('current');
  const [organizeFolders, setOrganizeFolders] = useState(true);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryDocument, setSummaryDocument] = useState<any>(null);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [selectedNotesDocument, setSelectedNotesDocument] = useState<any>(null);
  const [pendingDownloadIds, setPendingDownloadIds] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [pinnedAt, setPinnedAt] = useState<Map<string, string>>(new Map());
  const [pinBusy, setPinBusy] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadPins = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any).from('document_pins').select('request_id, pinned_at').eq('user_id', user.id);
      if (data) {
        setPinnedIds(new Set(data.map((p: any) => p.request_id as string)));
        setPinnedAt(new Map(data.map((p: any) => [p.request_id as string, p.pinned_at as string])));
      }
    };
    void loadPins();
  }, []);

  const handlePin = async (docId: string) => {
    setPinBusy(docId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const now = new Date().toISOString();
      const { error } = await (supabase as any).from('document_pins').insert({ user_id: user.id, request_id: docId, pinned_at: now });
      if (error) throw error;
      setPinnedIds((prev) => new Set([...prev, docId]));
      setPinnedAt((prev) => new Map([...prev, [docId, now]]));
      toast({ title: 'Pinned', description: 'Document added to your Pinned tab.' });
    } catch {
      toast({ title: 'Pin failed', variant: 'destructive' });
    } finally {
      setPinBusy(null);
    }
  };

  const handleUnpin = async (docId: string) => {
    setPinBusy(docId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await (supabase as any).from('document_pins').delete().eq('user_id', user.id).eq('request_id', docId);
      if (error) throw error;
      setPinnedIds((prev) => { const n = new Set(prev); n.delete(docId); return n; });
      setPinnedAt((prev) => { const n = new Map(prev); n.delete(docId); return n; });
      toast({ title: 'Unpinned', description: 'Document removed from your Pinned tab.' });
    } catch {
      toast({ title: 'Unpin failed', variant: 'destructive' });
    } finally {
      setPinBusy(null);
    }
  };

  // Status-tab counts are computed over all documents, not the filtered set,
  // so a tab's count doesn't change just because another filter is active.
  const statusCounts = useMemo(() => ({
    all: documents.length,
    pending_approval: documents.filter((doc) => doc.status === 'pending' || doc.status === 'submitted').length,
    approved: documents.filter((doc) => doc.status === 'approved').length,
    declined: documents.filter((doc) => doc.status === 'rejected').length,
    pinned: pinnedIds.size,
  }), [documents, pinnedIds]);

  const matchesStatusTab = (doc: any) => {
    if (statusTab === 'all') return true;
    if (statusTab === 'pending_approval') return doc.status === 'pending' || doc.status === 'submitted';
    if (statusTab === 'approved') return doc.status === 'approved';
    if (statusTab === 'pinned') return pinnedIds.has(doc.id);
    return doc.status === 'rejected';
  };

  // Enhanced filter logic with new filter options
  const filteredDocuments = documents.filter(doc => {
    if (!matchesStatusTab(doc)) return false;

    const searchTerm = filters.search.toLowerCase();
    const matchesSearch = !searchTerm ||
      doc.title?.toLowerCase().includes(searchTerm) ||
      doc.document_type.toLowerCase().includes(searchTerm) ||
      doc.category?.toLowerCase().includes(searchTerm) ||
      doc.suppliers?.company_name?.toLowerCase().includes(searchTerm);

    const matchesStatus = !filters.status || doc.status === filters.status;
    const matchesCategory = !filters.category || doc.category === filters.category;
    const matchesDocumentType = !filters.documentType || doc.document_type === filters.documentType;
    const matchesSupplier = !filters.supplier || doc.supplier_id === filters.supplier;
    const matchesFacility = !filters.facilityLocation || doc.branch_id === filters.facilityLocation;

    let matchesUploadDateRange = true;
    if (filters.uploadDateRange) {
      const docDate = new Date(doc.created_at);
      const now = new Date();
      switch (filters.uploadDateRange) {
        case 'last_7_days':
          matchesUploadDateRange = docDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last_30_days':
          matchesUploadDateRange = docDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'last_90_days':
          matchesUploadDateRange = docDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'this_year':
          matchesUploadDateRange = docDate.getFullYear() === now.getFullYear();
          break;
        default:
          matchesUploadDateRange = true;
      }
    }

    let matchesSpecificYear = true;
    if (filters.specificYear) {
      const docYear = new Date(doc.created_at).getFullYear();
      switch (filters.specificYear) {
        case '2025': matchesSpecificYear = docYear === 2025; break;
        case '2024': matchesSpecificYear = docYear === 2024; break;
        case '2023': matchesSpecificYear = docYear === 2023; break;
        case '2024-2025': matchesSpecificYear = docYear === 2024 || docYear === 2025; break;
        case '2023-2024': matchesSpecificYear = docYear === 2023 || docYear === 2024; break;
        default: matchesSpecificYear = true;
      }
    }

    let matchesExpirationStatus = true;
    if (filters.expirationStatus) {
      const upload = getLatestUpload(doc.document_uploads);
      if (upload?.expiration_date) {
        const expirationDate = new Date(upload.expiration_date);
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        switch (filters.expirationStatus) {
          case 'expiring_soon': matchesExpirationStatus = expirationDate <= thirtyDaysFromNow && expirationDate >= now; break;
          case 'expired': matchesExpirationStatus = expirationDate < now; break;
          case 'valid': matchesExpirationStatus = expirationDate >= now; break;
          default: matchesExpirationStatus = true;
        }
      }
    }

    return matchesSearch && matchesStatus && matchesCategory &&
      matchesDocumentType && matchesSupplier && matchesUploadDateRange &&
      matchesSpecificYear && matchesExpirationStatus && matchesFacility;
  });

  const sortedDocuments = useMemo(() => {
    const arr = [...filteredDocuments];
    if (statusTab === 'pinned') {
      // LIFO: last pinned shows first
      arr.sort((a, b) => (pinnedAt.get(b.id) || '').localeCompare(pinnedAt.get(a.id) || ''));
      return arr;
    }
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortKey === 'title') cmp = (a.title || a.document_type || '').localeCompare(b.title || b.document_type || '');
      else cmp = (a.suppliers?.company_name || '').localeCompare(b.suppliers?.company_name || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredDocuments, sortKey, sortDir, statusTab, pinnedAt]);

  useEffect(() => { setPage(1); }, [statusTab, filters, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedDocuments.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pageDocuments = sortedDocuments.slice(pageStart, pageStart + rowsPerPage);

  const activeFilterCount = Object.values(filters).filter((value) => value !== '').length + (statusTab !== 'all' ? 0 : 0);

  const clearAllFilters = () => {
    setFilters({
      search: '', status: '', category: '', documentType: '', supplier: '',
      expirationStatus: '', uploadDateRange: '', specificYear: '', facilityLocation: ''
    });
    setStatusTab('all');
  };

  // Create available suppliers list from documents - extract actual supplier data
  const availableSuppliers = Array.from(
    new Map(
      documents
        .filter(doc => doc.suppliers && doc.supplier_id)
        .map(doc => [doc.supplier_id, {
          id: doc.supplier_id,
          company_name: doc.suppliers.company_name,
          documentCount: documents.filter(d => d.supplier_id === doc.supplier_id).length
        }])
    ).values()
  ).sort((a, b) => a.company_name.localeCompare(b.company_name));

  // Create available facilities list from documents
  const availableFacilities = Array.from(
    new Map(
      documents
        .filter(doc => doc.branch)
        .map(doc => [doc.branch.id, {
          id: doc.branch.id,
          name: doc.branch.branch_name,
          location: doc.branch.location || '',
          documentCount: documents.filter(d => d.branch_id === doc.branch.id).length
        }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const handleView = async (doc: any) => {
    const uploads = doc.document_uploads || [];
    const upload = getLatestUpload(uploads);

    if (upload?.file_path) {
      setPreviewDoc({ doc, upload });
      setPreviewOpen(true);
      return;
    }

    // Custom template submissions don't have a document_uploads row; resolve
    // the submission file into an upload-shaped object the modal can preview.
    try {
      if (doc.template_type === 'custom') {
        const { data: subs } = await supabase
          .from('template_submissions')
          .select('submission_file_path, submission_file_name, submission_mime_type')
          .eq('request_id', doc.id)
          .limit(1);
        const sub = subs && subs[0];
        if (sub?.submission_file_path) {
          setPreviewDoc({
            doc,
            upload: {
              file_path: sub.submission_file_path,
              file_name: sub.submission_file_name,
              mime_type: sub.submission_mime_type,
            },
          });
          setPreviewOpen(true);
          return;
        }
      }
    } catch (e) {
      console.error('Custom submission view fallback failed', e);
    }
    toast({ title: "Error", description: "No file available for viewing", variant: "destructive" });
  };

  const handleDownload = async (doc: any) => {
    const uploads = doc.document_uploads || [];
    const upload = getLatestUpload(uploads);

    if (!upload?.file_path) {
      try {
        if (doc.template_type === 'custom') {
          const { data: subs } = await supabase
            .from('template_submissions')
            .select('submission_file_path, submission_file_name')
            .eq('request_id', doc.id)
            .limit(1);
          const sub = subs && subs[0];
          if (sub?.submission_file_path) {
            const { data, error } = await supabase.functions.invoke('secure-document-url', {
              body: { filePath: sub.submission_file_path, expiresIn: 3600 }
            });
            if (error || !data?.success) throw new Error(data?.error || 'Failed to get secure URL');
            const a = window.document.createElement('a');
            a.href = data.url;
            a.download = sub.submission_file_name || 'download';
            window.document.body.appendChild(a);
            a.click();
            window.document.body.removeChild(a);
            return;
          }
        }
      } catch (e) {
        console.error('Custom submission download fallback failed', e);
      }
      toast({ title: "Error", description: "No file available for download", variant: "destructive" });
      return;
    }

    setDownloading(doc.id);
    try {
      const resolved = resolveStoragePath(upload.file_path);
      if (!resolved) {
        throw new Error('Invalid file path');
      }
      const { data: signed, error: signedErr } = await supabase.storage
        .from(resolved.bucket)
        .createSignedUrl(resolved.key, 60, { download: upload.file_name });

      if (!signedErr && signed?.signedUrl) {
        const a = window.document.createElement('a');
        a.href = signed.signedUrl;
        a.download = upload.file_name || 'download';
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);

        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id && upload.id) {
          try {
            const { error: logError } = await supabase.from('document_activity_logs').insert({
              document_upload_id: upload.id,
              document_request_id: doc.id,
              user_id: user.id,
              action_type: 'downloaded',
              notes: `Downloaded: ${upload.file_name}`,
              metadata: { file_name: upload.file_name }
            });
            if (logError) console.error('Failed to log download activity:', logError);
          } catch (logErr) {
            console.error('Error logging download activity:', logErr);
          }
        }

        toast({ title: "Download Started", description: `Downloading ${upload.file_name}` });
        return;
      }

      const { data: blob, error } = await supabase.storage
        .from(resolved.bucket)
        .download(resolved.key);

      if (error) {
        console.error('Storage download error:', error);
        throw error;
      }

      const url = URL.createObjectURL(blob);
      const a2 = window.document.createElement('a');
      a2.href = url;
      a2.download = upload.file_name || 'download';
      window.document.body.appendChild(a2);
      a2.click();
      window.document.body.removeChild(a2);
      URL.revokeObjectURL(url);

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id && upload.id) {
        try {
          const { error: logError } = await supabase.from('document_activity_logs').insert({
            document_upload_id: upload.id,
            document_request_id: doc.id,
            user_id: user.id,
            action_type: 'downloaded',
            notes: `Downloaded: ${upload.file_name}`,
            metadata: { file_name: upload.file_name }
          });
          if (logError) console.error('Failed to log download activity (fallback):', logError);
        } catch (logErr) {
          console.error('Error logging download activity (fallback):', logErr);
        }
      }

      toast({ title: "Download Started", description: `Downloading ${upload.file_name}` });
    } catch (error) {
      console.error('Download error:', error);
      toast({ title: "Download Failed", description: "Failed to download the document", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleCreateLink = (doc: any) => {
    setSelectedDocument(doc);
    setLinkModalOpen(true);
  };

  const handleOpenSummary = (doc: any) => {
    setSummaryDocument(doc);
    setSummaryModalOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedDocuments(new Set());
      return;
    }
    const newSelection = new Set<string>();
    pageDocuments.forEach(doc => {
      const upload = doc.document_uploads?.[0];
      if (upload?.file_path) newSelection.add(doc.id);
    });
    setSelectedDocuments(newSelection);
  };

  const handleDocumentSelectionChange = (documentId: string, selected: boolean) => {
    const newSelection = new Set(selectedDocuments);
    if (selected) newSelection.add(documentId);
    else newSelection.delete(documentId);
    setSelectedDocuments(newSelection);
  };

  const getMultiVersionCount = (ids: Set<string>) => {
    return Array.from(ids).filter(docId => {
      const doc = documents.find(d => d.id === docId);
      return doc?.document_uploads?.length > 1;
    }).length;
  };

  const handleBulkDownload = async () => {
    if (selectedDocuments.size === 0) {
      toast({ title: "Error", description: "No documents selected", variant: "destructive" });
      return;
    }
    setPendingDownloadIds(selectedDocuments);
    if (getMultiVersionCount(selectedDocuments) > 0) {
      setShowVersionDialog(true);
      return;
    }
    await executeBulkDownload('current', selectedDocuments);
  };

  const handleExport = async () => {
    const eligibleIds = new Set<string>();
    sortedDocuments.forEach(doc => {
      const upload = doc.document_uploads?.[0];
      if (upload?.file_path) eligibleIds.add(doc.id);
    });
    if (eligibleIds.size === 0) {
      toast({ title: "Nothing to export", description: "No documents with files in the current view." });
      return;
    }
    setPendingDownloadIds(eligibleIds);
    if (getMultiVersionCount(eligibleIds) > 0) {
      setShowVersionDialog(true);
      return;
    }
    await executeBulkDownload('current', eligibleIds);
  };

  const executeBulkDownload = async (mode: 'current' | 'all', ids: Set<string>) => {
    try {
      setShowVersionDialog(false);
      setIsBulkDownloading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session - please log in again');
      }

      const filterParts: string[] = [];
      if (filters.supplier) {
        const supplier = availableSuppliers.find(s => s.id === filters.supplier);
        if (supplier) filterParts.push(supplier.company_name);
      } else {
        filterParts.push("All_Suppliers");
      }
      if (filters.expirationStatus) filterParts.push(filters.expirationStatus.replace('_', ' '));
      if (filters.specificYear) filterParts.push(filters.specificYear);
      else if (filters.uploadDateRange) filterParts.push(filters.uploadDateRange.replace('_', ' '));
      if (filters.status) filterParts.push(filters.status);

      const filterDescription = filterParts.join('_') || 'Documents';

      let uploadIds: string[] = [];
      const documentMetadata: Array<{ title: string; uploadIds: string[] }> = [];

      Array.from(ids).forEach(docId => {
        const doc = documents.find(d => d.id === docId);
        if (!doc?.document_uploads?.length) return;

        const docUploadIds: string[] = [];
        if (mode === 'all') {
          doc.document_uploads.forEach((upload: any) => {
            if (upload?.id) {
              uploadIds.push(upload.id);
              docUploadIds.push(upload.id);
            }
          });
        } else if (doc.document_uploads[0]?.id) {
          uploadIds.push(doc.document_uploads[0].id);
          docUploadIds.push(doc.document_uploads[0].id);
        }

        if (docUploadIds.length > 0) {
          documentMetadata.push({ title: doc.title || doc.document_type || 'Documents', uploadIds: docUploadIds });
        }
      });

      if (uploadIds.length === 0) {
        throw new Error('No valid document uploads found for selected documents');
      }

      const response = await fetch('https://edwerzutsknhuplidhsj.supabase.co/functions/v1/bulk-document-downloader', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ documentIds: uploadIds, filterDescription, organizeFolders, documentMetadata })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Download failed: ${errorText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filterDescription}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ title: "Download Started", description: `ZIP download started with ${uploadIds.length} file${uploadIds.length !== 1 ? 's' : ''}` });
      setSelectedDocuments(new Set());
      setPendingDownloadIds(new Set());
    } catch (error: any) {
      console.error('Bulk download error:', error);
      toast({ title: "Download Failed", description: error.message || "Failed to download documents", variant: "destructive" });
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'created_at' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />;
  };

  const statusTabs: Array<{ value: StatusTab; label: string; pinned?: true }> = [
    { value: 'all', label: 'All' },
    { value: 'pending_approval', label: 'Pending Approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'declined', label: 'Declined' },
    { value: 'pinned', label: 'Pinned', pinned: true },
  ];

  const allPageSelected = pageDocuments.length > 0 && pageDocuments.every(doc => selectedDocuments.has(doc.id) || !doc.document_uploads?.[0]?.file_path);

  return (
    <div className="space-y-4">
      {/* Page Title Block */}
      <div className="pt-7 pb-5 flex justify-between items-start">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-bold text-foreground leading-none">All Documents</h1>
          <p className="text-[15px] text-muted-foreground">Manage and review supplier compliance documents</p>
        </div>
      </div>

      {isBulkDownloading && <BulkDownloadOverlay documentCount={pendingDownloadIds.size} />}

      <BulkDownloadOptionsDialog
        open={showVersionDialog}
        onOpenChange={setShowVersionDialog}
        multiVersionCount={getMultiVersionCount(pendingDownloadIds)}
        totalSelected={pendingDownloadIds.size}
        downloadMode={downloadMode}
        onDownloadModeChange={setDownloadMode}
        organizeFolders={organizeFolders}
        onOrganizeFoldersChange={setOrganizeFolders}
        onConfirm={() => executeBulkDownload(downloadMode, pendingDownloadIds)}
      />

      {/* Status tabs */}
      <div className="h-[56px] border-b border-border flex items-center gap-9">
        {statusTabs.map((tab) => {
          const isActive = statusTab === tab.value;
          const badgeColors = tab.pinned
            ? (isActive ? 'bg-amber-100 text-amber-700' : 'bg-amber-50 text-amber-600')
            : ({
                all: 'bg-[#EAF1FF] text-[#2563EB]',
                pending_approval: 'bg-muted text-foreground/80',
                approved: 'bg-[#ECFDF5] text-[#047857]',
                declined: 'bg-[#FEF2F2] text-[#DC2626]',
              }[tab.value] || 'bg-muted text-muted-foreground');
          const count =
            tab.value === 'all' ? statusCounts.all
            : tab.value === 'pending_approval' ? statusCounts.pending_approval
            : tab.value === 'approved' ? statusCounts.approved
            : tab.value === 'pinned' ? statusCounts.pinned
            : statusCounts.declined;

          return (
            <div key={tab.value} className="flex items-center gap-9 h-full">
              {tab.pinned && (
                <div className="h-5 w-px bg-muted flex-shrink-0 -ml-[18px]" />
              )}
              <button
                onClick={() => setStatusTab(tab.value)}
                className={`relative h-full flex items-center gap-2 text-[14px] font-semibold transition-colors ${
                  isActive
                    ? tab.pinned ? 'text-amber-600' : 'text-[#2563EB]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.pinned && <Pin className="h-3.5 w-3.5 flex-shrink-0" />}
                {tab.label}
                <span className={`h-[22px] min-w-[22px] rounded-full px-1.5 text-[12px] font-bold flex items-center justify-center ${badgeColors}`}>
                  {count}
                </span>
                {isActive && (
                  <div className={`absolute bottom-0 left-0 right-0 h-[3px] rounded-full ${tab.pinned ? 'bg-amber-500' : 'bg-[#2563EB]'}`} />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-[16px] mb-[20px]">
        <div className="flex flex-wrap items-center gap-[12px]">
          <Select value={filters.category || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value === 'all' ? '' : value }))}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Category: All</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="certification">Certification</SelectItem>
              <SelectItem value="insurance">Insurance</SelectItem>
              <SelectItem value="quality">Quality</SelectItem>
              <SelectItem value="safety">Safety</SelectItem>
              <SelectItem value="financial">Financial</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.supplier || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, supplier: value === 'all' ? '' : value }))}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Supplier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Supplier: All</SelectItem>
              {availableSuppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>{supplier.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.documentType || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, documentType: value === 'all' ? '' : value }))}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Type: All</SelectItem>
              <SelectItem value="certificate">Certificate</SelectItem>
              <SelectItem value="license">License</SelectItem>
              <SelectItem value="permit">Permit</SelectItem>
              <SelectItem value="policy">Policy</SelectItem>
              <SelectItem value="report">Report</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.status || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === 'all' ? '' : value }))}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>

          <Popover open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />More Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-3">
              <Input
                placeholder="Search documents..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
              <Select value={filters.expirationStatus || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, expirationStatus: value === 'all' ? '' : value }))}>
                <SelectTrigger><SelectValue placeholder="Validity status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All documents</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="expiring_soon">Expiring soon (30 days)</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.uploadDateRange || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, uploadDateRange: value === 'all' ? '' : value }))}>
                <SelectTrigger><SelectValue placeholder="Upload date" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="last_7_days">Last 7 days</SelectItem>
                  <SelectItem value="last_30_days">Last 30 days</SelectItem>
                  <SelectItem value="last_90_days">Last 90 days</SelectItem>
                  <SelectItem value="this_year">This year</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.facilityLocation || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, facilityLocation: value === 'all' ? '' : value }))}>
                <SelectTrigger><SelectValue placeholder="Facility" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All facilities</SelectItem>
                  {availableFacilities.map((facility) => (
                    <SelectItem key={facility.id} value={facility.id}>{facility.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          {(activeFilterCount > 0 || statusTab !== 'all') && (
            <Button variant="link" size="sm" className="h-9 text-muted-foreground" onClick={clearAllFilters}>
              Clear all
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={sortKey} onValueChange={(value) => toggleSort(value as SortKey)}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Sort by: Created date</SelectItem>
              <SelectItem value="title">Sort by: Document name</SelectItem>
              <SelectItem value="supplier">Sort by: Supplier</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-md border p-0.5">
            <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('table')}>
              <List className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')}>
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleRefresh} disabled={isRefreshing} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />Export
          </Button>
        </div>
      </div>

      {selectedDocuments.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Badge>{selectedDocuments.size} selected</Badge>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDocuments(new Set())}>
              <X className="w-3 h-3 mr-1" />Clear
            </Button>
          </div>
          <Button size="sm" onClick={handleBulkDownload}>
            <Download className="w-3.5 h-3.5 mr-1.5" />Download selected
          </Button>
        </div>
      )}

      {sortedDocuments.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-border rounded-[16px] bg-card">
          {statusTab === 'pinned' ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 mx-auto mb-3">
                <Pin className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-[15px] font-semibold text-foreground mb-1">No pinned documents yet</h3>
              <p className="text-[13px] text-muted-foreground max-w-xs mx-auto">Pin any document using the <Pin className="inline w-3.5 h-3.5 text-muted-foreground mx-0.5" /> button in the actions column — they'll appear here for quick access, newest first.</p>
            </>
          ) : (
            <>
              <FileText className="w-12 h-12 text-muted-foreground/70 mx-auto mb-3" />
              <h3 className="text-[15px] font-semibold text-foreground mb-1">No Documents Found</h3>
              <p className="text-[13px] text-muted-foreground">
                {activeFilterCount > 0 || statusTab !== 'all' ? "No documents match your current filters." : "No documents available."}
              </p>
            </>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="space-y-3">
          {pageDocuments.map(doc => (
            <DocumentCardWithSelection
              key={doc.id}
              document={{
                ...doc,
                supplier: doc.suppliers,
                ...(() => {
                  const latestUpload = getLatestUpload(doc.document_uploads);
                  return latestUpload ? {
                    file_name: latestUpload.file_name,
                    file_size: latestUpload.file_size,
                    expiration_date: latestUpload.expiration_date,
                    uploader: latestUpload.uploader
                  } : {};
                })()
              }}
              userRole="buyer"
              showActions={true}
              onView={() => handleView(doc)}
              onDownload={() => handleDownload(doc)}
              downloadLoading={downloading === doc.id}
              onApprove={() => onApprove(doc.id)}
              onDecline={() => onDecline(doc.id)}
              onWithdraw={() => onWithdraw(doc.id, doc.title || doc.document_type)}
              onCreateLink={() => handleCreateLink(doc)}
              onOpenSummary={doc.status === 'approved' ? () => handleOpenSummary(doc) : undefined}
              onEditNotes={() => { setSelectedNotesDocument(doc); setNotesModalOpen(true); }}
              approveLoading={approveLoading === doc.id}
              declineLoading={declineLoading === doc.id}
              withdrawLoading={withdrawLoading === doc.id}
              showSelection={true}
              isSelected={selectedDocuments.has(doc.id)}
              onSelectionChange={(selected) => handleDocumentSelectionChange(doc.id, selected)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)] w-full">
          <Table className="table-fixed w-full">
            <TableHeader className="h-[56px] bg-card border-b border-border">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[4%] px-3">
                  <Checkbox checked={allPageSelected} onCheckedChange={(checked) => handleSelectAll(checked === true)} />
                </TableHead>
                <TableHead className="text-[12px] font-bold tracking-[0.04em] uppercase text-muted-foreground px-3 w-[28%]">Document</TableHead>
                <TableHead className="text-[12px] font-bold tracking-[0.04em] uppercase text-muted-foreground px-3 w-[14%]">Supplier</TableHead>
                <TableHead className="text-[12px] font-bold tracking-[0.04em] uppercase text-muted-foreground px-3 w-[12%]">
                  <button className="flex items-center gap-1 truncate" onClick={() => toggleSort('created_at')}>
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">Date</span><SortIcon column="created_at" />
                  </button>
                </TableHead>
                <TableHead className="text-[12px] font-bold tracking-[0.04em] uppercase text-muted-foreground px-3 w-[10%]">Uploader</TableHead>
                <TableHead className="text-[12px] font-bold tracking-[0.04em] uppercase text-muted-foreground px-3 w-[6%]">Size</TableHead>
                <TableHead className="text-[12px] font-bold tracking-[0.04em] uppercase text-muted-foreground px-3 w-[10%]">Status</TableHead>
                <TableHead className="text-[12px] font-bold tracking-[0.04em] uppercase text-muted-foreground text-right px-3 w-[16%]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageDocuments.map((doc) => {
                const latestUpload = getLatestUpload(doc.document_uploads);
                const hasFile = Boolean(latestUpload?.file_path) || doc.template_type === 'custom' || doc.has_template_submission;
                const canApproveOrDecline = doc.status === 'submitted' && hasFile;
                const canCreateLink = doc.status === 'approved' && hasFile;
                const canWithdraw = doc.status === 'pending';
                const statusConfig = STATUS_BADGE_CONFIG[doc.status] || STATUS_BADGE_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                const insight = aiInsight(doc, latestUpload?.expiration_date);

                return (
                  <TableRow key={doc.id} className="h-[88px] border-b border-border hover:bg-muted/50">
                    <TableCell className="px-3 py-3">
                      <Checkbox
                        checked={selectedDocuments.has(doc.id)}
                        onCheckedChange={(checked) => handleDocumentSelectionChange(doc.id, checked === true)}
                        disabled={!latestUpload?.file_path}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 text-left transition-colors hover:opacity-80 disabled:cursor-default disabled:opacity-100"
                        onClick={() => handleView(doc)}
                        disabled={!hasFile}
                        title={hasFile ? 'Preview document' : undefined}
                      >
                        <div className="w-[40px] h-[40px] rounded-[10px] bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-[#2563EB]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className={`text-[14px] font-semibold text-foreground truncate ${hasFile ? 'hover:text-[#2563EB]' : ''}`} title={doc.title || doc.document_type}>{doc.title || doc.document_type}</p>
                            {pinnedIds.has(doc.id) && (
                              <Pin className="h-3 w-3 flex-shrink-0 text-amber-500 fill-amber-400" />
                            )}
                          </div>
                          <p className="text-[13px] text-muted-foreground">ID: {doc.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <div className="text-[14px] truncate">
                        <p className="font-medium text-foreground truncate" title={doc.suppliers?.company_name}>{doc.suppliers?.company_name || 'Unknown'}</p>
                        <p className="text-muted-foreground">{supplierShortId(doc.supplier_id)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-[13px] text-muted-foreground truncate">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                        <span className="truncate">{formatDate(doc.created_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-[13px] text-muted-foreground truncate">
                      <div className="flex items-center gap-1.5" title={latestUpload?.uploader?.full_name}>
                        <User className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                        <span className="truncate">{latestUpload?.uploader?.full_name || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-[13px] text-muted-foreground truncate">
                      <span className="truncate">{formatFileSize(latestUpload?.file_size)}</span>
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <div className="flex items-center gap-1.5 flex-nowrap">
                        <Badge variant="outline" className={`text-[12px] px-2 py-0.5 rounded-full font-medium border-0 flex items-center justify-center ${statusConfig.className}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />{statusConfig.label}
                        </Badge>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#E0E7FF] transition-colors border-0">
                              <Sparkles className="w-3 h-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-3 text-xs bg-card border-border shadow-[0_12px_24px_rgba(15,23,42,0.12)] rounded-[12px]">
                            <div className="flex items-start gap-2">
                              <Sparkles className="w-4 h-4 text-[#4F46E5] mt-0.5" />
                              <div>
                                <p className="font-semibold mb-1 text-foreground">{insight.label}</p>
                                <p className="text-muted-foreground leading-relaxed">{insight.description}</p>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                        {canApproveOrDecline ? (
                          <>
                            <Button size="icon" className="h-[36px] w-[36px] bg-[#10B981] hover:bg-[#059669] text-white rounded-[10px] shadow-sm flex-shrink-0" disabled={approveLoading === doc.id} onClick={() => onApprove(doc.id)} title="Approve">
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="outline" className="h-[36px] w-[36px] bg-card text-[#DC2626] border-[#FCA5A5] hover:bg-[#FEF2F2] rounded-[10px] shadow-sm flex-shrink-0" disabled={declineLoading === doc.id} onClick={() => onDecline(doc.id)} title="Decline">
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" className="h-[36px] px-[12px] bg-card text-foreground/80 border-border hover:bg-muted rounded-[10px] font-semibold shadow-sm" onClick={() => handleView(doc)}>
                            View
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-[36px] w-[36px] rounded-[10px] bg-card border border-transparent text-muted-foreground hover:bg-muted shadow-none">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-[12px] shadow-[0_12px_24px_rgba(15,23,42,0.12)] border-border">
                            <DropdownMenuItem onClick={() => pinnedIds.has(doc.id) ? handleUnpin(doc.id) : handlePin(doc.id)} disabled={pinBusy === doc.id}>
                              {pinnedIds.has(doc.id)
                                ? <><PinOff className="w-3.5 h-3.5 mr-2 text-amber-500" />Unpin</>
                                : <><Pin className="w-3.5 h-3.5 mr-2" />Pin</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedNotesDocument(doc); setNotesModalOpen(true); }}>
                              <MessageSquare className="w-3.5 h-3.5 mr-2" />Notes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(doc)} disabled={downloading === doc.id}>
                              <Download className="w-3.5 h-3.5 mr-2" />Download
                            </DropdownMenuItem>
                            {canCreateLink && (
                              <DropdownMenuItem onClick={() => handleCreateLink(doc)}>
                                <LinkIcon className="w-3.5 h-3.5 mr-2" />Create link
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-muted" />
                            {canWithdraw && (
                              <DropdownMenuItem onClick={() => onWithdraw(doc.id, doc.title || doc.document_type)} disabled={withdrawLoading === doc.id} className="text-[#DC2626] focus:text-[#DC2626]">
                                <Ban className="w-3.5 h-3.5 mr-2" />Withdraw request
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
        totalCount={sortedDocuments.length}
        itemLabel="documents"
        onPageChange={setPage}
        onPageSizeChange={setRowsPerPage}
      />

      {selectedDocument && (
        <DocumentLinkModal
          isOpen={linkModalOpen}
          onClose={() => { setLinkModalOpen(false); setSelectedDocument(null); }}
          documentUpload={getLatestUpload(selectedDocument.document_uploads)}
        />
      )}

      <ApprovedDocumentSummaryModal
        isOpen={summaryModalOpen}
        onClose={() => { setSummaryModalOpen(false); setSummaryDocument(null); }}
        document={summaryDocument ? { ...summaryDocument, supplier: summaryDocument.suppliers } : null}
        onView={() => { if (summaryDocument) handleView(summaryDocument); }}
        onDownload={() => { if (summaryDocument) handleDownload(summaryDocument); }}
        onCreateLink={() => {
          if (summaryDocument) {
            setSummaryModalOpen(false);
            handleCreateLink(summaryDocument);
          }
        }}
        onRefresh={onRefresh}
      />

      <DocumentNotesModal
        isOpen={notesModalOpen}
        onClose={() => setNotesModalOpen(false)}
        document={selectedNotesDocument}
        onNotesSaved={(docId, newNotes) => {
          const doc = documents.find(d => d.id === docId);
          if (doc) doc.notes = newNotes;
          if (onRefresh) onRefresh();
        }}
      />

      <DocumentPreviewModal
        open={previewOpen}
        onOpenChange={(open) => { setPreviewOpen(open); if (!open) setPreviewDoc(null); }}
        upload={previewDoc?.upload || null}
        title={previewDoc?.doc?.title || previewDoc?.doc?.document_type}
        status={previewDoc?.doc?.status}
        supplierName={previewDoc?.doc?.suppliers?.company_name || previewDoc?.doc?.suppliers?.name}
        documentId={previewDoc?.doc?.id}
        canDecide={previewDoc?.doc?.status === 'submitted'}
        approveBusy={approveLoading === previewDoc?.doc?.id}
        onApprove={onApprove}
        onDecline={onDecline}
      />
    </div>
  );
};

export default BuyerDocumentsManager;
