import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import DocumentsFilter from './DocumentsFilter';
import DocumentCard from './DocumentCard';
import DocumentActivityDashboard from './DocumentActivityDashboard';

import BuyerDocumentsManager from './BuyerDocumentsManager';
import DocumentDeclineDialog from './DocumentDeclineDialog';
import DocumentWithdrawDialog from './DocumentWithdrawDialog';
import { resolveStoragePath } from '@/utils/storagePath';
import { useBranchContext } from '@/contexts/BranchContext';

const BuyerDocumentsDashboard = () => {
  const { currentBranch, allBranchesView } = useBranchContext();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveLoading, setApproveLoading] = useState<string | null>(null);
  const [declineLoading, setDeclineLoading] = useState<string | null>(null);
  const [withdrawLoading, setWithdrawLoading] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("documents");
  const [highlightedDocId, setHighlightedDocId] = useState<string | null>(null);
  const [declineDialog, setDeclineDialog] = useState<{
    isOpen: boolean;
    documentId: string;
    documentTitle: string;
  }>({
    isOpen: false,
    documentId: '',
    documentTitle: ''
  });
  const [withdrawDialog, setWithdrawDialog] = useState<{
    isOpen: boolean;
    documentId: string;
    documentTitle: string;
  }>({
    isOpen: false,
    documentId: '',
    documentTitle: ''
  });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category: '',
    documentType: '',
    supplier: '',
    expirationStatus: '',
    dateRange: ''
  });
  const [availableSuppliers, setAvailableSuppliers] = useState<any[]>([]);
  const [availableFacilities, setAvailableFacilities] = useState<any[]>([]);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const loadTimeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  // Check for pre-set filters from dashboard navigation
  useEffect(() => {
    const presetStatus = sessionStorage.getItem('buyer_docs_filter_status');
    const presetExpiration = sessionStorage.getItem('buyer_docs_filter_expiration');
    const presetSearch = sessionStorage.getItem('buyer_docs_filter_search');
    const presetSupplier = sessionStorage.getItem('buyer_docs_filter_supplier');
    
    const newFilters: Partial<typeof filters> = {};
    
    if (presetStatus) {
      newFilters.status = presetStatus;
      sessionStorage.removeItem('buyer_docs_filter_status');
    }
    if (presetExpiration) {
      newFilters.expirationStatus = presetExpiration;
      sessionStorage.removeItem('buyer_docs_filter_expiration');
    }
    if (presetSearch) {
      newFilters.search = presetSearch;
      sessionStorage.removeItem('buyer_docs_filter_search');
    }
    if (presetSupplier) {
      // Validate supplier ID format (UUID) to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(presetSupplier)) {
        newFilters.supplier = presetSupplier;
      }
      sessionStorage.removeItem('buyer_docs_filter_supplier');
    }
    
    if (Object.keys(newFilters).length > 0) {
      setFilters(prev => ({ ...prev, ...newFilters }));
    }
  }, []);

  // Check for deep-link highlight from notification
  useEffect(() => {
    const highlightId = sessionStorage.getItem('highlight_document_request_id');
    if (highlightId && documents.length > 0) {
      setHighlightedDocId(highlightId);
      sessionStorage.removeItem('highlight_document_request_id');
      setActiveTab('documents');
      
      // Scroll to highlighted document after render
      setTimeout(() => {
        const element = document.getElementById(`doc-card-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Clear highlight after 5 seconds
        setTimeout(() => setHighlightedDocId(null), 5000);
      }, 100);
    }
  }, [documents]);

  const debouncedLoadDocuments = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    
    loadTimeoutRef.current = setTimeout(() => {
      loadDocuments();
    }, 150);
  }, []);

  useEffect(() => {
    if (user) {
      loadConnectedSuppliers();
      debouncedLoadDocuments();
    }
  }, [user, filters, currentBranch, allBranchesView, debouncedLoadDocuments]);

  const loadConnectedSuppliers = async () => {
    try {
      // Step 1: Check if user is a team member
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', user?.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .maybeSingle();

      // Step 2: Resolve buyer ID
      const resolvedBuyerId = teamMember?.company_id || user?.id;
      setBuyerId(resolvedBuyerId);

      // Step 3: Get buyer profile using resolved ID
      const { data: buyerProfile, error: buyerError } = await supabase
        .from('buyers')
        .select('id')
        .eq('id', resolvedBuyerId)
        .single();

      if (buyerError || !buyerProfile) {
        console.error('Error fetching buyer profile:', buyerError);
        return;
      }

      // Load ALL suppliers that have documents for this buyer
      const { data: documentsData } = await supabase
        .from('document_requests')
        .select(`
          supplier_id,
          branch_id,
          suppliers!inner (
            id,
            company_name
          ),
          branch:company_branches!branch_id (
            id,
            branch_name,
            location
          )
        `)
        .eq('buyer_id', buyerProfile.id);

      if (!documentsData) return;

      // Create a map to count documents per supplier
      const supplierMap = new Map<string, { id: string; company_name: string; documentCount: number }>();
      
      documentsData.forEach((doc) => {
        if (doc.suppliers) {
          const existing = supplierMap.get(doc.supplier_id);
          if (existing) {
            existing.documentCount++;
          } else {
            supplierMap.set(doc.supplier_id, {
              id: doc.supplier_id,
              company_name: doc.suppliers.company_name,
              documentCount: 1
            });
          }
        }
      });

      // Convert map to array and sort by company name
      const suppliersArray = Array.from(supplierMap.values()).sort((a, b) => 
        a.company_name.localeCompare(b.company_name)
      );

      setAvailableSuppliers(suppliersArray);

      // Extract unique facilities
      const facilityMap = new Map<string, { id: string; name: string; location: string; documentCount: number }>();
      
      documentsData.forEach((doc) => {
        if (doc.branch && doc.branch.id) {
          const existing = facilityMap.get(doc.branch.id);
          if (existing) {
            existing.documentCount++;
          } else {
            facilityMap.set(doc.branch.id, {
              id: doc.branch.id,
              name: doc.branch.branch_name,
              location: doc.branch.location || '',
              documentCount: 1
            });
          }
        }
      });

      const facilitiesArray = Array.from(facilityMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      );

      setAvailableFacilities(facilitiesArray);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadDocuments = async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setLoading(true);
    try {
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
      const { data: buyerProfile, error: buyerError } = await supabase
        .from('buyers')
        .select('id')
        .eq('id', buyerId)
        .single();

      if (buyerError || !buyerProfile) {
        console.error('Error fetching buyer profile:', buyerError);
        return;
      }

      // Load documents with uploads and supplier info
      let query = supabase
        .from('document_requests')
        .select(`
          *,
          suppliers (
            company_name,
            industry,
            profile_id
          ),
          branch:company_branches!branch_id (
            id,
            branch_name,
            location,
            address
          ),
          document_uploads (
            id,
            file_name,
            file_path,
            file_size,
            mime_type,
            status,
            version,
            created_at,
            expiration_date,
            reviewer_notes,
            content_summary,
            content_extraction_status,
            content_extracted_at,
            uploader:uploader_id (
              full_name
            )
          )
        `)
        .eq('buyer_id', buyerProfile.id);

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
      if (filters.supplier) {
        query = query.eq('supplier_id', filters.supplier);
      }

      // Filter by branch if not viewing all branches - include company-wide docs (NULL branch_id)
      if (!allBranchesView && currentBranch) {
        query = query.or(`branch_id.eq.${currentBranch.id},branch_id.is.null`);
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
        // Determine the effective status with priority logic
        let effectiveStatus = doc.status;
        
        if (doc.document_uploads && doc.document_uploads.length > 0) {
          // Sort by version DESC, then created_at DESC as tiebreaker for same versions
          const sortedUploads = [...doc.document_uploads].sort((a: any, b: any) => {
            const versionDiff = (b.version || 0) - (a.version || 0);
            if (versionDiff !== 0) return versionDiff;
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
          });
          const latestUpload = sortedUploads[0];
          
          // PRIORITY 1: Check if latest upload needs review (renewal submitted)
          if (latestUpload.status === 'submitted' || latestUpload.status === 'pending_review') {
            effectiveStatus = 'submitted';
          } 
          // PRIORITY 2: If latest upload is approved, show approved
          else if (latestUpload.status === 'approved') {
            effectiveStatus = 'approved';
          } 
          // PRIORITY 3: If latest upload is rejected, show rejected
          else if (latestUpload.status === 'rejected') {
            effectiveStatus = 'rejected';
          }
        }
        // PRIORITY 4: No uploads - use request status (fallback)
        
        return {
          ...doc,
          effectiveStatus,
          // Pass the effective status as the main status for DocumentCard
          status: effectiveStatus
        };
      });

      // Fetch template_submissions for custom template documents to get file info
      const customTemplateDocIds = processedDocuments
        .filter(doc => doc.template_type === 'custom' && doc.status === 'submitted')
        .map(doc => doc.id);

      if (customTemplateDocIds.length > 0) {
        const { data: templateSubmissions } = await supabase
          .from('template_submissions')
          .select('request_id, submission_file_name, submission_file_path, submission_file_size, submission_mime_type')
          .in('request_id', customTemplateDocIds);

        if (templateSubmissions && templateSubmissions.length > 0) {
          const submissionMap = new Map(templateSubmissions.map(s => [s.request_id, s]));
          processedDocuments = processedDocuments.map(doc => {
            const submission = submissionMap.get(doc.id);
            if (submission) {
              return {
                ...doc,
                file_name: submission.submission_file_name,
                file_path: submission.submission_file_path,
                file_size: submission.submission_file_size,
                mime_type: submission.submission_mime_type,
                has_template_submission: true
              };
            }
            return doc;
          });
        }
      }

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
    setApproveLoading(documentId);
    try {
      // Find the document for display purposes
      const document = documents.find(doc => doc.id === documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Use the secure approval function
      const { data, error } = await supabase.rpc('approve_document_request', {
        p_request_id: documentId,
        p_notes: null
      });

      if (error) {
        throw new Error(`Failed to approve document: ${error.message}`);
      }

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to approve document');
      }

    // Log the approval activity
    const upload = document.document_uploads?.[0];
    if (upload?.id && user?.id) {
      const { error: logError } = await supabase.from('document_activity_logs').insert({
        document_upload_id: upload.id,
        document_request_id: documentId,
        action_type: 'approved',
        user_id: user.id,
        notes: 'Document approved'
      });
      
      if (logError) {
        console.error('Failed to log approval activity:', logError);
      }
    }

      toast({
        title: "Document Approved",
        description: `"${document.document_type}" has been successfully approved.`,
      });

      // Reload documents to reflect the change
      await loadDocuments();
    } catch (error) {
      console.error('Error approving document:', error);
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve the document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setApproveLoading(null);
    }
  };

  const handleDeclineDocument = async (documentId: string, reason: string) => {
    setDeclineLoading(documentId);
    try {
      // Find the document for display purposes
      const document = documents.find(doc => doc.id === documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Use the secure rejection function
      const { data, error } = await supabase.rpc('reject_document_request', {
        p_request_id: documentId,
        p_reason: reason
      });

      if (error) {
        throw new Error(`Failed to reject document: ${error.message}`);
      }

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to reject document');
      }

      // Log the rejection activity
      const upload = document.document_uploads?.[0];
      if (upload?.id && user?.id) {
        const { error: logError } = await supabase.from('document_activity_logs').insert({
          document_upload_id: upload.id,
          document_request_id: documentId,
          action_type: 'rejected',
          user_id: user.id,
          notes: reason
        });
        
        if (logError) {
          console.error('Failed to log decline activity:', logError);
        }
      }

      toast({
        title: "Document Declined",
        description: `"${document.document_type}" has been declined.`,
      });

      // Close decline dialog and reload documents
      setDeclineDialog({ isOpen: false, documentId: '', documentTitle: '' });
      await loadDocuments();
    } catch (error) {
      console.error('Error declining document:', error);
      toast({
        title: "Decline Failed",
        description: error instanceof Error ? error.message : "Failed to decline the document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeclineLoading(null);
    }
  };

  const openDeclineDialog = (documentId: string, documentTitle: string) => {
    setDeclineDialog({
      isOpen: true,
      documentId,
      documentTitle
    });
  };

  const openWithdrawDialog = (documentId: string, documentTitle: string) => {
    setWithdrawDialog({
      isOpen: true,
      documentId,
      documentTitle
    });
  };

  const handleWithdrawDocument = async (documentId: string, note: string) => {
    setWithdrawLoading(documentId);
    try {
      const document = documents.find(doc => doc.id === documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Update the request status to withdrawn
      const { error: updateError } = await supabase
        .from('document_requests')
        .update({ 
          status: 'withdrawn',
          notes: note,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (updateError) {
        throw new Error(`Failed to withdraw request: ${updateError.message}`);
      }

      // Log the withdrawal activity
      if (user?.id) {
        const { error: logError } = await supabase.from('document_activity_logs').insert({
          document_request_id: documentId,
          user_id: user.id,
          action_type: 'withdrawn',
          notes: note,
          metadata: { reason: note }
        });
        
        if (logError) {
          console.error('Failed to log withdrawal activity:', logError);
        }
      }

      toast({
        title: "Request Withdrawn",
        description: `"${document.document_type}" has been withdrawn and will no longer be visible to the supplier.`,
      });

      // Close dialog and reload documents
      setWithdrawDialog({ isOpen: false, documentId: '', documentTitle: '' });
      await loadDocuments();
    } catch (error) {
      console.error('Error withdrawing document:', error);
      toast({
        title: "Withdrawal Failed",
        description: error instanceof Error ? error.message : "Failed to withdraw the request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setWithdrawLoading(null);
    }
  };

// Robust view logic using signed URLs and popup-safe flow
const handleViewDocumentFile = async (doc: any) => {
  let preOpenedTab: Window | null = null;
  try {
    const uploads = doc.document_uploads || [];
    const latest = uploads.length > 1
      ? uploads.slice().sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]
      : uploads[0];

    if (!latest?.file_path) {
      try {
        if (doc.template_type === 'custom') {
          const { data: subs } = await supabase
            .from('template_submissions')
            .select('submission_file_path, submission_file_name, submission_mime_type')
            .eq('request_id', doc.id)
            .limit(1);
          const sub = subs && subs[0];
          if (sub?.submission_file_path) {
            const { data, error } = await supabase.functions.invoke('secure-document-url', {
              body: { filePath: sub.submission_file_path, expiresIn: 3600 }
            });
            if (error || !data?.success) throw new Error(data?.error || 'Failed to get secure URL');
            window.open(data.url, '_blank', 'noopener,noreferrer');
            return;
          }
        }
      } catch (e) {
        console.error('Custom submission view fallback failed', e);
      }
      toast({
        title: 'No File',
        description: 'No file available for viewing',
        variant: 'destructive',
      });
      return;
    }

    const isImage = latest.mime_type?.startsWith('image/');
    const isPdf = latest.mime_type === 'application/pdf' || latest.file_name?.toLowerCase().endsWith('.pdf');
    const isViewable = isImage || isPdf;

    // Only pre-open tab for viewable types to avoid stuck tabs
    if (isViewable) {
      preOpenedTab = window.open('', '_blank', 'noopener,noreferrer');
      if (preOpenedTab) preOpenedTab.document.write('Loading document...');
    }

    const resolved = resolveStoragePath(latest.file_path);
    if (!resolved) throw new Error('Invalid file path');

    const { data, error } = await supabase.storage
      .from(resolved.bucket)
      .createSignedUrl(resolved.key, 60);

    if (error || !data?.signedUrl) {
      throw error || new Error('Could not generate a signed URL');
    }

    if (isViewable) {
      if (preOpenedTab) preOpenedTab.location.href = data.signedUrl;
      else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Non-previewable types: trigger download instead
      await handleDownloadDocumentFile(doc);
    }
  } catch (err) {
    console.error('View error:', err);
    if (preOpenedTab) {
      try { preOpenedTab.close(); } catch {}
    }
    toast({
      title: 'View Failed',
      description: 'Failed to open the document',
      variant: 'destructive',
    });
  }
};

  // Robust download logic with signed URL first, blob fallback
  const handleDownloadDocumentFile = async (doc: any) => {
    try {
      const uploads = doc.document_uploads || [];
      const latest = uploads.length > 1
        ? uploads.slice().sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]
        : uploads[0];

      if (!latest?.file_path) {
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
        toast({
          title: 'No File',
          description: 'No file available for download',
          variant: 'destructive',
        });
        return;
      }

// Try signed URL with download param
const resolved = resolveStoragePath(latest.file_path);
if (!resolved) throw new Error('Invalid file path');

const { data: signed, error: signedErr } = await supabase.storage
  .from(resolved.bucket)
  .createSignedUrl(resolved.key, 60, { download: latest.file_name });

if (!signedErr && signed?.signedUrl) {
  const a = window.document.createElement('a');
  a.href = signed.signedUrl;
  a.download = latest.file_name || 'download';
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);

  // Log download activity with error handling
  if (user?.id && latest.id) {
    try {
      const { error: logError } = await supabase.from('document_activity_logs').insert({
        document_upload_id: latest.id,
        document_request_id: doc.id,
        user_id: user.id,
        action_type: 'downloaded',
        notes: `Downloaded: ${latest.file_name}`,
        metadata: { file_name: latest.file_name }
      });
      if (logError) console.error('Failed to log download activity:', logError);
    } catch (logErr) {
      console.error('Error logging download activity:', logErr);
    }
  }
  return;
}

// Fallback: download blob
const { data: blob, error } = await supabase.storage
  .from(resolved.bucket)
  .download(resolved.key);
if (error) throw error;

const url = URL.createObjectURL(blob);
const a2 = window.document.createElement('a');
a2.href = url;
a2.download = latest.file_name || 'download';
window.document.body.appendChild(a2);
a2.click();
window.document.body.removeChild(a2);
URL.revokeObjectURL(url);

// Log download activity (fallback path) with error handling
if (user?.id && latest.id) {
  try {
    const { error: logError } = await supabase.from('document_activity_logs').insert({
      document_upload_id: latest.id,
      document_request_id: doc.id,
      user_id: user.id,
      action_type: 'downloaded',
      notes: `Downloaded: ${latest.file_name}`,
      metadata: { file_name: latest.file_name }
    });
    if (logError) console.error('Failed to log download activity (fallback):', logError);
  } catch (logErr) {
    console.error('Error logging download activity (fallback):', logErr);
  }
}
    } catch (err) {
      console.error('Download error:', err);
      toast({
        title: 'Download Failed',
        description: 'Failed to download the document',
        variant: 'destructive',
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

  // Fetch activity events from database with user attribution
  const [activityEvents, setActivityEvents] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchActivities = async () => {
      if (!buyerId) return;
      
      // Fetch activities linked directly to requests OR via uploads
      const { data, error } = await supabase
        .from('document_activity_logs')
        .select(`
          *,
          user:profiles!document_activity_logs_user_id_fkey(full_name, email),
          document_request:document_requests!document_activity_logs_document_request_id_fkey(
            id,
            document_type,
            category,
            priority,
            buyer_id,
            supplier:suppliers!document_requests_supplier_id_fkey(company_name)
          ),
          document_upload:document_uploads!document_activity_logs_document_upload_id_fkey(
            id,
            file_name,
            request_id,
            document_request:document_requests!document_uploads_request_id_fkey(
              id,
              document_type,
              category,
              priority,
              buyer_id,
              supplier:suppliers!document_requests_supplier_id_fkey(company_name)
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('Error fetching activities:', error);
        return;
      }
      
      // Filter to only show activities for this buyer
      const filteredData = (data || []).filter(log => {
        const directRequestBuyerId = log.document_request?.buyer_id;
        const uploadRequestBuyerId = log.document_upload?.document_request?.buyer_id;
        return directRequestBuyerId === buyerId || uploadRequestBuyerId === buyerId;
      });
      
      const formattedEvents = filteredData.map(log => {
        // Get document info from either direct request or via upload
        const docRequest = log.document_request || log.document_upload?.document_request;
        const requestId = log.document_request_id || log.document_upload?.request_id;
        
        return {
          id: log.id,
          type: log.action_type as any,
          title: `Document ${log.action_type.charAt(0).toUpperCase() + log.action_type.slice(1)}`,
          description: `${docRequest?.document_type || 'Document'} - ${docRequest?.supplier?.company_name || 'Unknown Supplier'}`,
          date: log.created_at,
          documentTitle: docRequest?.document_type,
          supplier: docRequest?.supplier?.company_name,
          priority: docRequest?.priority as 'high' | 'medium' | 'low',
          category: docRequest?.category,
          userName: log.user?.full_name,
          userEmail: log.user?.email,
          documentRequestId: requestId,
          documentUploadId: log.document_upload_id,
          notes: log.notes
        };
      });
      
      setActivityEvents(formattedEvents);
    };
    
    fetchActivities();
  }, [buyerId, documents]);


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

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="inline-flex h-12 items-center gap-1 rounded-full bg-white border border-border/40 p-1.5 justify-start shadow-sm">
          <TabsTrigger 
            value="documents"
            className="rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none hover:text-foreground"
          >
            Document Manager
          </TabsTrigger>
          <TabsTrigger 
            value="timeline"
            className="rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none hover:text-foreground"
          >
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <BuyerDocumentsManager 
            documents={documents}
            onApprove={handleApproveDocument}
            onDecline={(documentId) => {
              const doc = documents.find(d => d.id === documentId);
              openDeclineDialog(documentId, doc?.document_type || 'Document');
            }}
            onWithdraw={(documentId, documentTitle) => {
              openWithdrawDialog(documentId, documentTitle);
            }}
            onRefresh={loadDocuments}
            approveLoading={approveLoading}
            declineLoading={declineLoading}
            withdrawLoading={withdrawLoading}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <DocumentActivityDashboard events={activityEvents} documents={documents} />
        </TabsContent>
      </Tabs>

      {/* Decline Dialog */}
      <DocumentDeclineDialog
        isOpen={declineDialog.isOpen}
        onClose={() => setDeclineDialog({ isOpen: false, documentId: '', documentTitle: '' })}
        onConfirm={(reason) => handleDeclineDocument(declineDialog.documentId, reason)}
        documentTitle={declineDialog.documentTitle}
        loading={declineLoading === declineDialog.documentId}
      />

      {/* Withdraw Dialog */}
      <DocumentWithdrawDialog
        isOpen={withdrawDialog.isOpen}
        onClose={() => setWithdrawDialog({ isOpen: false, documentId: '', documentTitle: '' })}
        onConfirm={(note) => handleWithdrawDocument(withdrawDialog.documentId, note)}
        documentTitle={withdrawDialog.documentTitle}
        loading={withdrawLoading === withdrawDialog.documentId}
      />
    </div>
  );
};

export default BuyerDocumentsDashboard;
