
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Upload, File, X, Calendar as CalendarIcon, AlertTriangle, Cloud, HardDrive, Search, Check, FileText, Info, Link2, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSupplierItems, ITEM_CATEGORIES } from '@/hooks/useSupplierItems';
import { cn } from '@/lib/utils';
import { parseISO, format } from 'date-fns';
import SampleDocumentViewer from '@/components/shared/SampleDocumentViewer';
import { useWorkspaceProfile } from '@/hooks/useWorkspaceProfile';
import { useCanonicalEvidenceFeature } from '@/hooks/useCanonicalEvidenceFeature';
import { useOrganizationFeature } from '@/hooks/useOrganizationFeature';

interface LibraryDocument {
  id: string;
  document_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
  expiration_date: string | null;
  version: number;
  created_at: string;
}

interface DocumentUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  onUploadSuccess: () => void;
}

const DocumentUploadDialog = ({ isOpen, onClose, request, onUploadSuccess }: DocumentUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(undefined);
  const [noExpirationDate, setNoExpirationDate] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updateMetadataOnly, setUpdateMetadataOnly] = useState(false);
  const [linkedItemIds, setLinkedItemIds] = useState<string[]>([]);
  const [supplierCompanyName, setSupplierCompanyName] = useState<string>('');
  
  // Library document selection state
  const [uploadSource, setUploadSource] = useState<'machine' | 'library'>('machine');
  const [libraryDocuments, setLibraryDocuments] = useState<LibraryDocument[]>([]);
  const [selectedLibraryDoc, setSelectedLibraryDoc] = useState<LibraryDocument | null>(null);
  const [librarySearchTerm, setLibrarySearchTerm] = useState('');
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { t: wsT } = useWorkspaceProfile();
  const { enabled: canonicalEvidenceEnabled } = useCanonicalEvidenceFeature(request.supplier_id, 'supplier');
  const { enabled: transactionalUploadEnabled } = useOrganizationFeature('transactional_supplier_upload_v1', request.supplier_id, 'supplier');

  const isResubmission = request.status === 'rejected';
  const latestUpload = request.document_uploads?.[0];
  const { items, loading: itemsLoading } = useSupplierItems(request.supplier_id);

  // Fetch supplier company name for default document name
  useEffect(() => {
    const fetchSupplierName = async () => {
      if (!request.supplier_id) return;
      
      const { data, error } = await supabase
        .from('suppliers')
        .select('company_name')
        .eq('id', request.supplier_id)
        .single();
      
      if (!error && data) {
        setSupplierCompanyName(data.company_name || '');
      }
    };
    
    if (isOpen) {
      fetchSupplierName();
    }
  }, [request.supplier_id, isOpen]);

  // Generate default document name when dialog opens or relevant data changes
  useEffect(() => {
    if (isOpen && supplierCompanyName && request.document_type) {
      const currentYear = new Date().getFullYear();
      const defaultName = `${supplierCompanyName} - ${request.document_type} - ${currentYear}`;
      setDocumentName(defaultName);
    }
  }, [isOpen, supplierCompanyName, request.document_type]);

  // Fetch library documents when source changes to 'library'
  useEffect(() => {
    if (uploadSource === 'library' && request.supplier_id && isOpen) {
      fetchLibraryDocuments();
    }
  }, [uploadSource, request.supplier_id, isOpen]);

  const fetchLibraryDocuments = async () => {
    setLoadingLibrary(true);
    try {
      const { data, error } = await supabase
        .from('supplier_document_library')
        .select('id, document_name, file_path, file_size, mime_type, category, expiration_date, version, created_at')
        .eq('supplier_id', request.supplier_id)
        .eq('is_current_version', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLibraryDocuments(data || []);
    } catch (error) {
      console.error('Error fetching library documents:', error);
      toast({
        title: "Error",
        description: "Failed to load document library.",
        variant: "destructive",
      });
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleSelectLibraryDoc = (doc: LibraryDocument) => {
    setSelectedLibraryDoc(doc);
    // Pre-fill expiration date from library document if available
    if (doc.expiration_date) {
      setExpirationDate(parseISO(doc.expiration_date));
    }
    // Clear file selection when choosing from library
    setFile(null);
  };

  const filteredLibraryDocs = libraryDocuments.filter(doc =>
    doc.document_name.toLowerCase().includes(librarySearchTerm.toLowerCase()) ||
    (doc.category && doc.category.toLowerCase().includes(librarySearchTerm.toLowerCase()))
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.info('[UploadDialog] File input change', {
      filesLength: e.target.files?.length,
      fromMobile: /Mobi|Android/i.test(navigator.userAgent)
    });
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      console.info('[UploadDialog] Selected file', { name: selectedFile.name, size: selectedFile.size, type: selectedFile.type });
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select a file smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      // Clear library selection when uploading from machine
      setSelectedLibraryDoc(null);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) return;
    
    // Validate metadata-only update has existing upload to update
    if (updateMetadataOnly && !latestUpload) {
      toast({
        title: "Cannot Update Metadata",
        description: "No existing document found to update. Please upload a new document file.",
        variant: "destructive",
      });
      return;
    }
    
    // For resubmission, either file or metadata update is required
    if (isResubmission && !file && !updateMetadataOnly) {
      toast({
        title: "Action Required",
        description: "Please either upload a new document or update the metadata (expiration date/notes).",
        variant: "destructive",
      });
      return;
    }
    
    // For new uploads, file or library document is required
    if (!isResubmission && !file && !selectedLibraryDoc) {
      toast({
        title: "Document Required",
        description: "Please select a document from your machine or library.",
        variant: "destructive",
      });
      return;
    }

    // Validate expiration date is set OR no-expiration checkbox is checked
    if (!expirationDate && !noExpirationDate) {
      toast({
        title: "Expiration Date Required",
        description: "Please select an expiration date or check 'This document does not expire'.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      if (transactionalUploadEnabled && file && uploadSource === 'machine' && !updateMetadataOnly) {
        const idempotencyKey = crypto.randomUUID();
        const { data: session, error: sessionError } = await supabase.functions.invoke('create-supplier-upload-session-v1', {
          body: {
            request_id: request.id, idempotency_key: idempotencyKey, file_name: file.name,
            mime_type: file.type || 'application/octet-stream', file_size: file.size,
            expiration_date: expirationDate ? format(expirationDate, 'yyyy-MM-dd') : null,
            no_expiration: noExpirationDate, document_name: documentName.trim() || null,
            notes: notes || null, linked_item_ids: linkedItemIds,
          },
        });
        if (sessionError || !session?.path || !session?.token) throw sessionError || new Error('Upload session could not be created');
        const { error: uploadError } = await supabase.storage.from('compliance-documents')
          .uploadToSignedUrl(session.path, session.token, file, { contentType: file.type || 'application/octet-stream', upsert: false });
        if (uploadError) throw uploadError;
        const { error: finalizeError } = await supabase.functions.invoke('finalize-transactional-upload-v1', { body: { session_id: session.session_id } });
        if (finalizeError) throw finalizeError;
        toast({ title: isResubmission ? 'Resubmission Successful' : 'Upload Successful', description: 'Your document was validated and submitted for review.' });
        onUploadSuccess();
        return;
      }

      let filePath = latestUpload?.file_path;
      let fileName = latestUpload?.file_name;
      let fileSize = latestUpload?.file_size;
      let mimeType = latestUpload?.mime_type;
      let canonicalSourceId: string | null = updateMetadataOnly ? latestUpload?.id || null : null;

      // If using library document - no need to upload, use existing file
      if (uploadSource === 'library' && selectedLibraryDoc) {
        filePath = selectedLibraryDoc.file_path;
        fileName = selectedLibraryDoc.document_name;
        fileSize = selectedLibraryDoc.file_size;
        mimeType = selectedLibraryDoc.mime_type;
      }
      // If uploading a new file from machine
      else if (file) {
        const fileExt = file.name.split('.').pop();
        
        // Use the friendly documentName (e.g. "Test Client - GST Registration - 2026")
        // Clean it up to be a safe filename
        const safeDocName = documentName.trim() 
          ? documentName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '_').replace(/\s+/g, ' ').trim() 
          : request.document_type.replace(/[^a-zA-Z0-9_\-\s]/g, '_');
          
        fileName = `${safeDocName}.${fileExt}`;

        // Resolve supplier ID (prefer from request, fallback to lookup by profile_id)
        let resolvedSupplierId: string | null = request?.supplier_id || null;
        if (!resolvedSupplierId) {
          const { data: supplierRow, error: supplierLookupError } = await supabase
            .from('suppliers')
            .select('id')
            .eq('profile_id', user.id)
            .single();
          if (supplierLookupError || !supplierRow) {
            console.error('Supplier lookup failed:', supplierLookupError);
            throw new Error('Supplier profile not found');
          }
          resolvedSupplierId = supplierRow.id;
        }

        // Store key without bucket prefix under supplier namespace to satisfy RLS.
        // Include a timestamp to ensure the storage path is unique.
        const fileKey = `${resolvedSupplierId}/${Date.now()}_${fileName.replace(/\s+/g, '_')}`;
        filePath = fileKey;
        fileSize = file.size;
        mimeType = file.type;

        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('compliance-documents')
          .upload(fileKey, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }
      }

      // Determine version number for new upload
      let version = 1;
      if (isResubmission && latestUpload) {
        version = (latestUpload.version || 1) + 1;
      }

      // Handle metadata-only updates vs new file uploads
      if (updateMetadataOnly && latestUpload) {
        // Update existing upload record for metadata-only changes
        const { error: updateError } = await supabase
          .from('document_uploads')
          .update({
            document_name: documentName.trim() || null,
            reviewer_notes: notes || null,
            expiration_date: expirationDate ? format(expirationDate, 'yyyy-MM-dd') : null,
            status: 'pending_review'
          })
          .eq('id', latestUpload.id);

        if (updateError) throw updateError;
      } else {
        // Create new upload record for new file uploads
        const { data: insertedUpload, error: insertError } = await supabase
          .from('document_uploads')
          .insert({
            request_id: request.id,
            uploader_id: user.id,
            file_name: fileName,
            file_path: filePath,
            file_size: fileSize,
            mime_type: mimeType,
            document_name: documentName.trim() || null,
            status: 'pending_review',
            reviewer_notes: notes || null,
            expiration_date: expirationDate ? format(expirationDate, 'yyyy-MM-dd') : null,
            version: version,
            linked_item_ids: linkedItemIds.length > 0 ? linkedItemIds : null
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        canonicalSourceId = insertedUpload.id;
      }

      // Update the request status back to submitted
      const { error: updateError } = await supabase
        .from('document_requests')
        .update({ status: 'submitted' })
        .eq('id', request.id);

      if (updateError) throw updateError;

      if (canonicalEvidenceEnabled && canonicalSourceId) {
        const { error: finalizeError } = await supabase.functions.invoke('finalize-canonical-upload-v1', {
          body: {
            source_type: 'document_upload', source_id: canonicalSourceId,
            document_type: request.document_type, display_name: documentName.trim() || fileName,
            logical_identity_key: null, fields: [],
            metadata: {
              expiry_date: expirationDate ? format(expirationDate, 'yyyy-MM-dd') : null,
              covered_product_ids: linkedItemIds,
              covered_facility_ids: request.supplier_branch_id ? [request.supplier_branch_id] : [],
              schema_version: 1,
            },
          },
        });
        if (finalizeError) console.error('Canonical evidence finalization failed:', finalizeError);
      }

      // Create notification for the buyer
      const notificationTitle = isResubmission ? 'Document Resubmitted' : 'Document Submitted';
      const notificationMessage = isResubmission 
        ? `${request.title} has been resubmitted after corrections` 
        : `${request.title} has been submitted for review`;

      if (request.buyer_id) {
        await supabase.rpc('create_notification', {
          p_user_id: request.buyers?.profile_id || request.requester_id,
          p_title: notificationTitle,
          p_message: notificationMessage,
          p_type: isResubmission ? 'document_resubmitted' : 'document_submitted',
          p_reference_id: request.id
        });
      }

      // Legacy buyers keep the existing agent path. Canonical evidence buyers
      // use the single extraction/finalization pipeline instead.
      if (!canonicalEvidenceEnabled) try {
        console.info('Triggering buyer agent for supplier upload...');
        const { data: agentData, error: agentError } = await supabase.functions.invoke('agent-coordinator', {
          body: { action: 'trigger_buyer' }
        });
        if (agentError) {
          console.error('Agent coordinator error:', agentError);
        } else {
          console.info('Agent coordinator response:', agentData);
        }
      } catch (err) {
        console.error('Error invoking agent coordinator:', err);
      }

      toast({
        title: isResubmission ? "Resubmission Successful" : "Upload Successful",
        description: isResubmission 
          ? "Your document has been resubmitted for review." 
          : "Your document has been submitted for review.",
      });

      onUploadSuccess();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        title: isResubmission ? "Resubmission Failed" : "Upload Failed",
        description: error.message || "Failed to process document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setNotes('');
    setDocumentName('');
    setExpirationDate(undefined);
    setNoExpirationDate(false);
    setIsCalendarOpen(false);
    setUpdateMetadataOnly(false);
    setUploadSource('machine');
    setSelectedLibraryDoc(null);
    setLibrarySearchTerm('');
    setLinkedItemIds([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                {isResubmission ? 'Resubmit Document' : 'Upload Document'}
              </DialogTitle>
              <DialogDescription id="upload-dialog-desc" className="text-sm">
                Provide or update the requested document and optional metadata.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="px-6 py-5">
            {/* Two-column grid layout for desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* LEFT COLUMN - Context & Reference */}
              <div className="space-y-4">
                {/* Sample Document Reference Section */}
                {request.sample_file_path && (
                  <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Reference Document</h3>
                    </div>
                    <SampleDocumentViewer
                      requestId={request.id}
                      fileName={request.sample_file_name}
                      fileSize={request.sample_file_size}
                      mimeType={request.sample_mime_type}
                      uploadedAt={request.sample_uploaded_at}
                      notes={request.notes}
                    />
                  </div>
                )}

                {/* Request Info Section */}
                <div className={cn(
                  "rounded-xl border p-4 shadow-sm",
                  isResubmission 
                    ? "border-warning/20 bg-warning/10" 
                    : "border-border/60 bg-muted/40"
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className={cn("h-4 w-4", isResubmission ? "text-warning" : "text-muted-foreground")} />
                    <h3 className={cn(
                      "text-sm font-semibold uppercase tracking-wide",
                      isResubmission ? "text-warning" : "text-foreground/80"
                    )}>Request Details</h3>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-medium text-foreground">{request.title}</h4>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-md bg-background border text-muted-foreground">
                        Type: {request.document_type}
                      </span>
                      <span className="px-2 py-1 rounded-md bg-background border text-muted-foreground">
                        Category: {request.category}
                      </span>
                    </div>
                    {isResubmission && (
                      <p className="text-xs text-warning mt-2 font-medium flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Document was rejected - please review feedback and resubmit
                      </p>
                    )}
                  </div>
                </div>

                {/* Rejection Feedback */}
                {isResubmission && latestUpload?.reviewer_notes && (
                  <div className="rounded-xl border border-danger/20 bg-danger/10 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-danger/15 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-4 h-4 text-danger" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-danger mb-1">Rejection Feedback</p>
                        <p className="text-sm text-danger">{latestUpload.reviewer_notes}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resubmission Options */}
                {isResubmission && (
                  <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-primary mb-3">Resubmission Options</p>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-3 text-sm cursor-pointer p-2 rounded-lg hover:bg-primary/15 transition-colors">
                        <input
                          type="radio"
                          name="resubmit-type"
                          checked={!updateMetadataOnly}
                          onChange={() => setUpdateMetadataOnly(false)}
                          className="text-primary h-4 w-4"
                        />
                        <span className="text-primary">Upload new document file</span>
                      </label>
                      <label className={cn(
                        "flex items-center space-x-3 text-sm p-2 rounded-lg transition-colors",
                        !latestUpload ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-primary/15'
                      )}>
                        <input
                          type="radio"
                          name="resubmit-type"
                          checked={updateMetadataOnly}
                          onChange={() => latestUpload && setUpdateMetadataOnly(true)}
                          disabled={!latestUpload}
                          className="text-primary h-4 w-4"
                        />
                        <span className="text-primary">Update expiration date and notes only</span>
                        {!latestUpload && <span className="text-xs text-muted-foreground">(no existing file)</span>}
                      </label>
                    </div>
                  </div>
                )}

                {/* Current Document Info for Resubmission */}
                {isResubmission && updateMetadataOnly && latestUpload && (
                  <div className="rounded-xl border border-border/60 bg-muted/40 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-foreground/80 mb-2">Current Document</p>
                    <div className="flex items-center space-x-2">
                      <File className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{latestUpload.file_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      You are updating metadata for this document without replacing the file
                    </p>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN - Upload & Input */}
              <div className="space-y-4">
                {/* Document Source Selection */}
                {(!isResubmission || !updateMetadataOnly) && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Upload className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-semibold text-foreground uppercase tracking-wide">
                        {isResubmission ? 'Select New Document *' : 'Select Document *'}
                      </Label>
                    </div>
                    
                    <Tabs value={uploadSource} onValueChange={(v) => setUploadSource(v as 'machine' | 'library')} className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-3">
                        <TabsTrigger value="machine" className="flex items-center gap-2 text-xs">
                          <HardDrive className="w-3.5 h-3.5" />
                          From Device
                        </TabsTrigger>
                        <TabsTrigger value="library" className="flex items-center gap-2 text-xs">
                          <Cloud className="w-3.5 h-3.5" />
                          From Library
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="machine" className="mt-0">
                        <div>
                          <Input
                            id="file-upload"
                            type="file"
                            onClick={(e) => e.stopPropagation()}
                            onChange={handleFileChange}
                            accept="image/*,application/pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                            multiple={false}
                            className="cursor-pointer bg-background"
                          />
                          <p className="text-xs text-muted-foreground mt-1.5">
                            PDF, DOC, DOCX, JPG, PNG, TXT (Max 10MB)
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="library" className="mt-0">
                        <div className="space-y-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              placeholder="Search library documents..."
                              value={librarySearchTerm}
                              onChange={(e) => setLibrarySearchTerm(e.target.value)}
                              className="pl-9 bg-background"
                            />
                          </div>

                          {loadingLibrary ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              Loading library...
                            </div>
                          ) : filteredLibraryDocs.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg bg-background">
                              {libraryDocuments.length === 0 
                                ? "No documents in your library yet. Upload documents to your library first."
                                : "No documents match your search."
                              }
                            </div>
                          ) : (
                            <ScrollArea className="h-32 border rounded-lg bg-background">
                              <div className="p-2 space-y-1">
                                {filteredLibraryDocs.map((doc) => (
                                  <div
                                    key={doc.id}
                                    onClick={() => handleSelectLibraryDoc(doc)}
                                    className={cn(
                                      "p-2.5 rounded-lg cursor-pointer transition-colors border",
                                      selectedLibraryDoc?.id === doc.id
                                        ? 'bg-primary/10 border-primary'
                                        : 'hover:bg-muted/50 border-transparent'
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-2 flex-1 min-w-0">
                                        <File className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium truncate">{doc.document_name}</p>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {doc.category && <span className="bg-muted px-1.5 py-0.5 rounded">{doc.category}</span>}
                                            <span>v{doc.version}</span>
                                          </div>
                                        </div>
                                      </div>
                                      {selectedLibraryDoc?.id === doc.id && (
                                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>

                    {/* Selected File Display (from machine) */}
                    {file && uploadSource === 'machine' && (
                      <div className="flex items-center justify-between p-3 mt-3 bg-background rounded-lg border border-primary/30">
                        <div className="flex items-center space-x-2 min-w-0">
                          <HardDrive className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB • From device
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFile(null)}
                          className="flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    {/* Selected Library Document Display */}
                    {selectedLibraryDoc && uploadSource === 'library' && (
                      <div className="flex items-center justify-between p-3 mt-3 bg-background rounded-lg border border-primary/30">
                        <div className="flex items-center space-x-2 min-w-0">
                          <Cloud className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{selectedLibraryDoc.document_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedLibraryDoc.file_size ? `${(selectedLibraryDoc.file_size / 1024 / 1024).toFixed(2)} MB • ` : ''}
                              From library • v{selectedLibraryDoc.version}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLibraryDoc(null)}
                          className="flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Document Details Section */}
                <div className="rounded-xl border border-warning/20 bg-warning/10 p-4 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-warning" />
                    <h3 className="text-sm font-semibold text-warning uppercase tracking-wide">Document Details</h3>
                  </div>

                  {/* Document Display Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="document-name" className="text-xs font-medium text-foreground">
                      Document Display Name
                    </Label>
                    <Input
                      id="document-name"
                      value={documentName}
                      onChange={(e) => setDocumentName(e.target.value)}
                      placeholder={`${supplierCompanyName || wsT.supplier} - ${request.document_type || 'Document'} - ${new Date().getFullYear()}`}
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">
                      A clear name helps {wsT.buyers.toLowerCase()} identify your document easily
                    </p>
                  </div>

                  {/* Expiration Date */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <CalendarIcon className="w-3.5 h-3.5 text-warning" />
                      Expiration Date <span className="text-destructive">*</span>
                    </Label>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={noExpirationDate}
                          className={cn(
                            "w-full justify-start text-left font-normal bg-background",
                            !expirationDate && "text-muted-foreground",
                            noExpirationDate && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {noExpirationDate 
                            ? "No expiration date" 
                            : expirationDate 
                              ? format(expirationDate, "PPP") 
                              : "Select expiration date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={expirationDate}
                          onSelect={(date) => {
                            setExpirationDate(date);
                            setIsCalendarOpen(false);
                          }}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    {expirationDate && !noExpirationDate && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setExpirationDate(undefined)}
                        className="text-xs h-7 px-2"
                      >
                        Clear date
                      </Button>
                    )}
                    <div className="flex items-center space-x-2 pt-1">
                      <Checkbox
                        id="no-expiration"
                        checked={noExpirationDate}
                        onCheckedChange={(checked) => {
                          setNoExpirationDate(checked === true);
                          if (checked) {
                            setExpirationDate(undefined);
                          }
                        }}
                      />
                      <label
                        htmlFor="no-expiration"
                        className="text-xs text-muted-foreground cursor-pointer"
                      >
                        This document does not expire
                      </label>
                    </div>
                  </div>
                </div>

                {/* Additional Options Section */}
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">Additional Options</h3>
                  </div>

                  {/* Link Items */}
                  {items.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">Link to Items (Optional)</Label>
                      <div className="max-h-28 overflow-y-auto border rounded-lg p-3 bg-background">
                        {ITEM_CATEGORIES.map(category => {
                          const categoryItems = items.filter(i => i.item_category === category.value);
                          if (categoryItems.length === 0) return null;
                          return (
                            <div key={category.value} className="mb-2 last:mb-0">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                {category.icon} {category.label}
                              </p>
                              {categoryItems.map(item => (
                                <label key={item.id} className="flex items-center gap-2 text-sm pl-4 cursor-pointer hover:bg-muted/50 rounded py-1">
                                  <Checkbox
                                    checked={linkedItemIds.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setLinkedItemIds([...linkedItemIds, item.id]);
                                      } else {
                                        setLinkedItemIds(linkedItemIds.filter(id => id !== item.id));
                                      }
                                    }}
                                  />
                                  {item.item_name}
                                </label>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                      Additional Notes (Optional)
                    </Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any additional information about this document..."
                      rows={2}
                      className="bg-background text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Actions - Fixed at bottom */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/30 flex-shrink-0">
          <Button variant="outline" onClick={handleClose} className="px-5">
            Cancel
          </Button>
          <Button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(e);
            }}
            disabled={
              (!file && !selectedLibraryDoc && !isResubmission) || 
              (isResubmission && !file && !updateMetadataOnly) ||
              uploading
            }
            className="min-w-[140px]"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {isResubmission ? 'Resubmitting...' : 'Submitting...'}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                {isResubmission 
                  ? (updateMetadataOnly ? 'Update Metadata' : 'Resubmit Document') 
                  : 'Submit Document'
                }
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentUploadDialog;
