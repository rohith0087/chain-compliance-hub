import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileText } from 'lucide-react';
import DocumentSelectionStep from './requests/DocumentSelectionStep';
import RequestConfigurationStep from './requests/RequestConfigurationStep';
import RequestReusePreflightStep, {
  type RequestPreflightResult,
  type RequestReuseResolution,
} from './requests/RequestReusePreflightStep';
import RequestReviewStep from './requests/RequestReviewStep';
import { getComplianceDocuments, ComplianceDocument } from './requests/ComplianceDocuments';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBranchSupplierConnections } from '@/hooks/useBranchSupplierConnections';
import { getWorkspaceProfileForIndustry } from '@/config/workspaceProfiles';
import { useCanonicalEvidenceFeature } from '@/hooks/useCanonicalEvidenceFeature';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRequest: (request: any) => void;
  userType: string;
  currentBranch?: { id: string; branch_name: string } | null;
}

interface SampleDocumentSelection {
  file?: File;
  libraryDoc?: {
    id: string;
    file_path: string;
    document_name: string;
    file_size: number | null;
    mime_type: string | null;
    category: string | null;
  };
  source: 'device' | 'library' | null;
}

interface CanonicalRequestResult {
  request_id: string | null;
  fulfillment_status: string;
  qualification?: string;
}

const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

const NewRequestModal = ({ isOpen, onClose, onCreateRequest, userType, currentBranch }: NewRequestModalProps) => {
  const [step, setStep] = useState(1);
  const [selectedSupplierType, setSelectedSupplierType] = useState<string>('General Supplier');
  const [selectedDocuments, setSelectedDocuments] = useState<ComplianceDocument[]>([]);
  const [formData, setFormData] = useState({
    suppliers: [] as string[],
    supplierBranches: {} as Record<string, string>, // supplierId -> branchId
    priority: 'medium' as 'high' | 'medium' | 'low' | 'urgent',
    dueDate: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);
  const [allDocuments, setAllDocuments] = useState<ComplianceDocument[]>([]);
  const [preflightResults, setPreflightResults] = useState<RequestPreflightResult[]>([]);
  const [reuseResolutions, setReuseResolutions] = useState<Record<string, RequestReuseResolution>>({});
  const [pendingSampleDocument, setPendingSampleDocument] = useState<SampleDocumentSelection>({ source: null });

  const { user } = useAuth();
  const { toast } = useToast();
  const { enabled: canonicalEvidenceEnabled } = useCanonicalEvidenceFeature(buyerProfile?.id, 'buyer');
  const staticComplianceDocuments = useMemo(() => getComplianceDocuments(selectedSupplierType), [selectedSupplierType]);

  // Use branch-specific supplier connections if branch is provided, otherwise fall back to all connections
  const { 
    connections: branchSupplierConnections, 
    loading: branchSuppliersLoading 
  } = useBranchSupplierConnections(currentBranch?.id);
  
  const [allConnectedSuppliers, setAllConnectedSuppliers] = useState<any[]>([]);

  // Get the appropriate suppliers based on branch context
  const connectedSuppliers = currentBranch 
    ? branchSupplierConnections
        .map(conn => ({ id: conn.supplier_id, company_name: conn.supplier?.company_name || 'Supplier' }))
    : allConnectedSuppliers;

  // Fetch buyer data and connected suppliers when modal opens
  React.useEffect(() => {
    if (isOpen && user) {
      fetchBuyerData();
    }
  }, [isOpen, user]);

  // Apply auditor workspace defaults: lock entity type to "Auditor"
  const wsProfile = getWorkspaceProfileForIndustry(buyerProfile?.industry);
  const wsFlags = wsProfile.flags;
  React.useEffect(() => {
    if (wsFlags.defaultEntityType && selectedSupplierType !== wsFlags.defaultEntityType) {
      setSelectedSupplierType(wsFlags.defaultEntityType);
      setSelectedDocuments([]);
    }
  }, [wsFlags.defaultEntityType]);

  // Combine static documents with custom templates
  React.useEffect(() => {
    const transformedCustomTemplates: ComplianceDocument[] = customTemplates.map(template => ({
      id: `custom-${template.id}`,
      title: template.template_name,
      category: template.category,
      description: template.description || 'Custom template',
      icon: staticComplianceDocuments[0]?.icon || FileText,
      required: false,
      regulatoryBody: 'Custom Template',
      template: {
        sections: template.required_fields || []
      },
      isCustomTemplate: true,
      customTemplateId: template.id
    }));

    setAllDocuments([...staticComplianceDocuments, ...transformedCustomTemplates]);
  }, [staticComplianceDocuments, customTemplates]);

  const fetchBuyerData = async () => {
    try {
      // Step 1: Check if user is a team member
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', user?.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .maybeSingle();

      // Step 2: Resolve buyer ID (team member uses company_id, owner uses profile_id)
      const buyerId = teamMember?.company_id || user?.id;

      // Step 3: Get buyer profile using resolved ID
      const { data: buyer, error: buyerError } = await supabase
        .from('buyers')
        .select('*')
        .eq('id', buyerId)
        .single();

      if (buyerError || !buyer) {
        console.error('Error fetching buyer profile:', buyerError);
        return;
      }

      setBuyerProfile(buyer);

      // Only fetch all connected suppliers if no branch is selected (backward compatibility)
      if (!currentBranch) {
        const { data: connections, error: connectionsError } = await supabase
          .from('buyer_supplier_connections')
          .select(`
            *,
            suppliers (*)
          `)
          .eq('buyer_id', buyer.id)
          .eq('status', 'approved');

        if (connectionsError) {
          console.error('Error fetching connections:', connectionsError);
          return;
        }

        setAllConnectedSuppliers(connections?.map(conn => conn.suppliers) || []);
      }

      // Fetch custom templates
      const { data: templates, error: templatesError } = await supabase
        .from('custom_document_templates')
        .select('*')
        .eq('buyer_id', buyer.id)
        .eq('is_active', true);

      if (templatesError) {
        console.error('Error fetching custom templates:', templatesError);
      } else {
        setCustomTemplates(templates || []);
      }
    } catch (error) {
      console.error('Error in fetchBuyerData:', error);
    }
  };

  const handleDocumentToggle = (doc: ComplianceDocument, checked: boolean) => {
    if (checked) {
      setSelectedDocuments(prev => [...prev, doc]);
    } else {
      setSelectedDocuments(prev => prev.filter(d => d.id !== doc.id));
    }
  };

  const removeSelectedDocument = (docId: string) => {
    setSelectedDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const handleFormDataChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSuppliersChange = (suppliers: string[]) => {
    setFormData(prev => {
      // Clean up branch selections for removed suppliers
      const newSupplierBranches = { ...prev.supplierBranches };
      Object.keys(newSupplierBranches).forEach(supplierId => {
        if (!suppliers.includes(supplierId)) {
          delete newSupplierBranches[supplierId];
        }
      });
      return { ...prev, suppliers, supplierBranches: newSupplierBranches };
    });
  };

  const handleSupplierBranchChange = (supplierId: string, branchId: string) => {
    setFormData(prev => ({
      ...prev,
      supplierBranches: {
        ...prev.supplierBranches,
        [supplierId]: branchId
      }
    }));
  };

  const handleCreateRequests = async (sampleDocument?: SampleDocumentSelection) => {
    if (!canonicalEvidenceEnabled) {
      await handleLegacyCreateRequests(sampleDocument);
      return;
    }
    if (!buyerProfile || selectedDocuments.length === 0 || formData.suppliers.length === 0) return;
    setLoading(true);
    try {
      const items = selectedDocuments.flatMap((doc) => formData.suppliers.map((supplierId) => ({
        client_key: `${supplierId}:${doc.id}`,
        supplier_id: supplierId,
        document_type: doc.title,
        subject_type: 'supplier' as const,
        subject_id: supplierId,
        required_standards: [],
      })));
      const { data, error } = await supabase.functions.invoke('preflight-document-requests-v1', {
        body: { buyer_id: buyerProfile.id, items },
      });
      if (error) throw error;
      const results = (data?.results || []) as RequestPreflightResult[];
      const resolutions: Record<string, RequestReuseResolution> = {};
      for (const result of results) {
        const reasons = result.match.reasons || [];
        if (result.match.qualification === 'eligible' && result.match.evidence_version_id) {
          resolutions[result.client_key] = { choice: 'use_existing' };
        } else if (result.match.qualification === 'potential') {
          resolutions[result.client_key] = { choice: 'ask_supplier' };
        } else if (reasons.includes('no_match')) {
          resolutions[result.client_key] = { choice: 'create' };
        } else {
          resolutions[result.client_key] = {
            choice: 'request_new',
            reasonCode: reasons.includes('expired') ? 'renewal_required' : reasons.includes('insufficient_remaining_validity') ? 'expires_soon' : 'other',
          };
        }
      }
      setPreflightResults(results);
      setReuseResolutions(resolutions);
      setPendingSampleDocument(sampleDocument);
      setStep(4);
    } catch (error: unknown) {
      toast({ title: 'Evidence check failed', description: errorMessage(error, 'Could not check existing evidence.'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleLegacyCreateRequests = async (sampleDocument?: SampleDocumentSelection) => {
    if (!user || !buyerProfile || selectedDocuments.length === 0 || formData.suppliers.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one document and one supplier.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Upload sample document if provided
      let sampleData: {
        sample_file_path?: string;
        sample_file_name?: string;
        sample_file_size?: number;
        sample_mime_type?: string;
        sample_uploaded_by?: string;
        sample_uploaded_at?: string;
      } = {};

      if (sampleDocument?.source === 'device' && sampleDocument.file) {
        const file = sampleDocument.file;
        const fileExt = file.name.split('.').pop();
        const timestamp = Date.now();
        const fileKey = `${buyerProfile.id}/${crypto.randomUUID()}_${timestamp}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('sample-documents')
          .upload(fileKey, file);

        if (uploadError) {
          console.error('Sample upload error:', uploadError);
          throw new Error('Failed to upload sample document');
        }

        sampleData = {
          sample_file_path: fileKey,
          sample_file_name: file.name,
          sample_file_size: file.size,
          sample_mime_type: file.type,
          sample_uploaded_by: user.id,
          sample_uploaded_at: new Date().toISOString()
        };
      } else if (sampleDocument?.source === 'library' && sampleDocument.libraryDoc) {
        const libDoc = sampleDocument.libraryDoc;
        sampleData = {
          sample_file_path: libDoc.file_path,
          sample_file_name: libDoc.document_name,
          sample_file_size: libDoc.file_size,
          sample_mime_type: libDoc.mime_type,
          sample_uploaded_by: user.id,
          sample_uploaded_at: new Date().toISOString()
        };
      }

      let totalRequestsCreated = 0;
      
      // Collect request IDs per supplier for batch email
      const requestsBySupplier: Record<string, string[]> = {};
      
      // Create a separate request for each selected document AND each selected supplier
      for (const doc of selectedDocuments) {
        for (const supplierId of formData.suppliers) {
          const supplierBranchId = formData.supplierBranches[supplierId] === 'all' ? null : (formData.supplierBranches[supplierId] || null);
          
          // Auto-fetch sample template for this document type if not manually provided
          let finalSampleData = { ...sampleData };
          if (!sampleDocument?.source) {
            // Check for a saved sample template for this document type
            const { data: templateData } = await supabase
              .from('buyer_sample_templates')
              .select('*')
              .eq('buyer_id', buyerProfile.id)
              .eq('document_type', doc.title)
              .maybeSingle();

            if (templateData) {
              finalSampleData = {
                sample_file_path: templateData.sample_file_path,
                sample_file_name: templateData.sample_file_name,
                sample_file_size: templateData.sample_file_size,
                sample_mime_type: templateData.sample_mime_type,
                sample_uploaded_by: templateData.uploaded_by,
                sample_uploaded_at: templateData.created_at
              };
            }
          }
          
          const insertData: any = {
            title: doc.title,
            description: doc.description,
            document_type: doc.title,
            category: doc.category,
            priority: formData.priority,
            due_date: formData.dueDate || null,
            supplier_id: supplierId,
            buyer_id: buyerProfile.id,
            requester_id: user.id,
            branch_id: currentBranch?.id || null, // Buyer's branch
            supplier_branch_id: supplierBranchId, // Target supplier branch
            notes: formData.notes || null,
            template_sections: doc.template || null,
            ...finalSampleData // Include sample document data (manual or auto-attached)
          };

          // Add custom template ID if this is a custom template
          if ((doc as any).isCustomTemplate && (doc as any).customTemplateId) {
            insertData.custom_template_id = (doc as any).customTemplateId;
            insertData.template_type = 'custom';
          }

          const { data: request, error } = await supabase
            .from('document_requests')
            .insert(insertData)
            .select()
            .single();

          if (error) {
            console.error('Error creating request:', error);
            throw error;
          }

          // Create notification for supplier
          const supplier = connectedSuppliers.find(s => s.id === supplierId);
          if (supplier) {
            await supabase.rpc('create_notification', {
              p_user_id: supplier.profile_id,
              p_title: 'New Document Request',
              p_message: `You have received a new document request: ${doc.title}`,
              p_type: 'request_created',
              p_reference_id: request.id
            });
          }

          // Collect request ID for batch email
          if (!requestsBySupplier[supplierId]) {
            requestsBySupplier[supplierId] = [];
          }
          requestsBySupplier[supplierId].push(request.id);

          // Call the callback to update the parent component
          onCreateRequest(request);
          totalRequestsCreated++;
        }
      }

      // Send ONE batch email per supplier (instead of one per document)
      for (const [supplierId, requestIds] of Object.entries(requestsBySupplier)) {
        supabase.functions.invoke('send-batch-request-email', {
          body: { requestIds, supplierId }
        }).catch(err => console.error('Failed to send batch request email:', err));
      }

      toast({
        title: "Requests Created",
        description: `Successfully created ${totalRequestsCreated} document request(s) for ${formData.suppliers.length} supplier(s).`,
      });

      // Reset form and close modal
      resetForm();
      onClose();
    } catch (error: any) {
      console.error('Error creating requests:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create requests. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCanonicalRequests = async () => {
    if (!user || !buyerProfile) return;
    setLoading(true);
    try {
      let sampleData: Record<string, unknown> = {};
      if (pendingSampleDocument?.source === 'device' && pendingSampleDocument.file) {
        const file = pendingSampleDocument.file;
        const fileExt = file.name.split('.').pop();
        const fileKey = `${buyerProfile.id}/${crypto.randomUUID()}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('sample-documents').upload(fileKey, file);
        if (uploadError) throw new Error('Failed to upload sample document');
        sampleData = {
          sample_file_path: fileKey, sample_file_name: file.name, sample_file_size: file.size,
          sample_mime_type: file.type, sample_uploaded_by: user.id, sample_uploaded_at: new Date().toISOString(),
        };
      } else if (pendingSampleDocument?.source === 'library' && pendingSampleDocument.libraryDoc) {
        const doc = pendingSampleDocument.libraryDoc;
        sampleData = {
          sample_file_path: doc.file_path, sample_file_name: doc.document_name, sample_file_size: doc.file_size,
          sample_mime_type: doc.mime_type, sample_uploaded_by: user.id, sample_uploaded_at: new Date().toISOString(),
        };
      }

      const requests = preflightResults.map((result) => {
        const documentId = result.client_key.slice(result.client_key.indexOf(':') + 1);
        const doc = selectedDocuments.find((item) => item.id === documentId) || selectedDocuments.find((item) => item.title === result.document_type)!;
        const resolution = reuseResolutions[result.client_key] || { choice: 'create' as const };
        const supplierBranchId = formData.supplierBranches[result.supplier_id] === 'all' ? null : formData.supplierBranches[result.supplier_id] || null;
        return {
          buyer_id: buyerProfile.id, supplier_id: result.supplier_id, title: doc.title,
          document_type: doc.title, description: doc.description, category: doc.category,
          priority: formData.priority, due_date: formData.dueDate || null, notes: formData.notes || null,
          branch_id: currentBranch?.id || null, supplier_branch_id: supplierBranchId,
          subject_type: 'supplier', subject_id: result.supplier_id, jurisdiction: null,
          required_standards: [],
          reuse_preference: resolution.choice, request_reason_code: resolution.reasonCode || null,
          request_reason_notes: resolution.reasonNotes || null, idempotency_key: crypto.randomUUID(),
          template_sections: doc.template || null,
          template_type: doc.isCustomTemplate ? 'custom' : 'standard',
          custom_template_id: doc.customTemplateId || null,
          ...sampleData,
        };
      });
      const { data, error } = await supabase.functions.invoke('create-document-requests-v2', { body: { requests } });
      if (error) throw error;
      const allResults = (data?.results || []) as CanonicalRequestResult[];
      const created = allResults.map((result, index) => ({ result, request: requests[index] })).filter(({ result }) => result.request_id);
      const bySupplier: Record<string, string[]> = {};
      created.forEach(({ result, request }) => {
        if (request.supplier_id && result.fulfillment_status !== 'fulfilled_existing') {
          (bySupplier[request.supplier_id] ||= []).push(result.request_id);
        }
        onCreateRequest(result);
      });
      for (const [supplierId, requestIds] of Object.entries(bySupplier)) {
        void supabase.functions.invoke('send-batch-request-email', { body: { requestIds, supplierId } });
      }
      toast({
        title: 'Requests resolved',
        description: `${created.length} request(s) created or fulfilled; ${requests.length - created.length} duplicate request(s) cancelled.`,
      });
      resetForm();
      onClose();
    } catch (error: unknown) {
      toast({ title: 'Request creation failed', description: errorMessage(error, 'Could not create requests.'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedDocuments([]);
    setPreflightResults([]);
    setReuseResolutions({});
    setPendingSampleDocument(undefined);
    setFormData({
      suppliers: [],
      supplierBranches: {},
      priority: 'medium' as 'high' | 'medium' | 'low' | 'urgent',
      dueDate: '',
      notes: '',
    });
  };

  // Show setup message if buyer profile is not available
  if (isOpen && !buyerProfile) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Setup Required</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p>Please complete your buyer profile setup before creating document requests.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show connection message if no suppliers are connected
  if (isOpen && connectedSuppliers.length === 0 && !branchSuppliersLoading) {
    const message = currentBranch 
      ? `No suppliers are assigned to the "${currentBranch.branch_name}" branch. Please assign suppliers to this branch first.`
      : 'You need to connect with suppliers before creating document requests.';
    
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentBranch ? 'No Branch Suppliers' : 'No Connected Suppliers'}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p>{message}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1100px] h-[90vh] bg-[#F6F8FC] rounded-[20px] p-0 overflow-hidden border-0 shadow-2xl flex flex-col gap-0 backdrop-blur-sm">
        
        {/* Modal Header & Stepper */}
        <div className="bg-white border-b border-[#E4E7EC] px-8 py-5 flex items-center justify-between sticky top-0 z-10 shrink-0">
          <div>
            <DialogTitle className="text-[22px] font-bold text-[#111827] mb-1">
              Create Document Request
            </DialogTitle>
            <DialogDescription className="text-[#667085] text-[15px]">
              {step === 1 ? 'Choose the compliance documents you want to request from suppliers.' : step === 2 ? 'Configure who should receive this request and set the request details.' : 'Review the request details before sending it to suppliers.'}
              {currentBranch && (
                <span className="block mt-1">
                  Requests will be sent to entities assigned to {currentBranch.branch_name}
                </span>
              )}
            </DialogDescription>
          </div>
          
          {/* Stepper */}
          <div className="flex items-center gap-3 pr-8">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold ${step >= 1 ? 'bg-[#2F5BEA] text-white' : 'bg-[#F3F5F9] text-[#98A2B3]'}`}>1</div>
              <span className={`text-[14px] font-semibold ${step >= 1 ? 'text-[#2F5BEA]' : 'text-[#98A2B3]'}`}>Select Documents</span>
            </div>
            <div className="w-12 h-[1px] bg-[#E4E7EC]"></div>
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold ${step >= 2 ? 'bg-[#2F5BEA] text-white' : 'bg-[#F3F5F9] text-[#98A2B3]'}`}>2</div>
              <span className={`text-[14px] font-semibold ${step >= 2 ? 'text-[#2F5BEA]' : 'text-[#98A2B3]'}`}>Configure Request</span>
            </div>
            <div className="w-12 h-[1px] bg-[#E4E7EC]"></div>
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold ${step >= 3 ? 'bg-[#2F5BEA] text-white' : 'bg-[#F3F5F9] text-[#98A2B3]'}`}>3</div>
              <span className={`text-[14px] font-semibold ${step >= 3 ? 'text-[#2F5BEA]' : 'text-[#98A2B3]'}`}>Review & Send</span>
            </div>
          </div>
        </div>

        {/* Non-scrollable Body Container */}
        <div className="flex-1 flex flex-col overflow-hidden p-8">
          {step === 1 && (
          <div className="flex flex-col h-full space-y-6 overflow-hidden">
            {/* Entity Type Selection */}
            <div className="flex items-center gap-4 shrink-0">
              <Label htmlFor="entity-type" className="font-bold text-[#111827] text-[14px]">
                {wsFlags.lockEntityType ? 'Engagement Type' : 'Entity Type'}
              </Label>
              <Select 
                value={selectedSupplierType} 
                onValueChange={(value) => {
                  setSelectedSupplierType(value);
                  setSelectedDocuments([]); // Clear selected documents when entity type changes
                }}
                disabled={wsFlags.lockEntityType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
              <SelectContent>
                {wsFlags.lockEntityType ? (
                  <SelectItem value="Auditor">Auditor</SelectItem>
                ) : (
                  <>
                    <SelectItem value="General Supplier">General Supplier</SelectItem>
                    <SelectItem value="Egg Processing">Egg Processing / Hatchery</SelectItem>
                  </>
                )}
              </SelectContent>
              </Select>
            </div>


            <div className="flex-1 overflow-hidden min-h-[400px]">
              <DocumentSelectionStep
                complianceDocuments={allDocuments}
                selectedDocuments={selectedDocuments}
                onDocumentToggle={handleDocumentToggle}
                onRemoveSelected={removeSelectedDocument}
                onNext={() => setStep(2)}
                buyerId={buyerProfile?.id}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="overflow-y-auto h-full pr-2 custom-scrollbar">
            <RequestConfigurationStep
            selectedDocuments={selectedDocuments}
            formData={formData}
            onFormDataChange={handleFormDataChange}
            onSuppliersChange={handleSuppliersChange}
            onSupplierBranchChange={handleSupplierBranchChange}
            onBack={() => setStep(1)}
            onCreateRequests={handleCreateRequests}
            onCancel={onClose}
            loading={loading}
            connectedSuppliers={connectedSuppliers}
            buyerId={buyerProfile?.id}
          />
          </div>
        )}

        {step === 3 && (
          <div className="overflow-y-auto h-full pr-2 custom-scrollbar">
            <RequestReviewStep
            selectedDocuments={selectedDocuments}
            formData={formData}
            buyerId={buyerProfile?.id}
            sampleDocument={pendingSampleDocument}
            setSampleDocument={setPendingSampleDocument}
          />
          </div>
        )}

        {step === 4 && (
          <div className="overflow-y-auto h-full pr-2 custom-scrollbar">
            <RequestReusePreflightStep
            results={preflightResults}
            suppliers={connectedSuppliers}
            resolutions={reuseResolutions}
            onResolutionChange={(clientKey, resolution) => setReuseResolutions((current) => ({ ...current, [clientKey]: resolution }))}
            onBack={() => setStep(3)}
            onSubmit={handleCanonicalRequests}
            loading={loading}
          />
          </div>
        )}
        </div>

        {/* Sticky Footer */}
        {step !== 4 && (
        <div className="bg-white border-t border-[#E4E7EC] px-8 py-5 flex items-center justify-between sticky bottom-0 z-10 shrink-0">
          <Button variant="outline" className="border-[#E4E7EC] text-[#111827] bg-white rounded-[10px] h-11 px-6 font-semibold shadow-sm" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            {step > 1 && (
              <Button variant="outline" className="border-[#E4E7EC] text-[#111827] bg-white rounded-[10px] h-11 px-6 font-semibold shadow-sm" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button 
                className="bg-[#2F5BEA] hover:bg-[#1D4ED8] text-white rounded-[10px] h-11 px-8 font-semibold shadow-sm transition-colors" 
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && selectedDocuments.length === 0}
              >
                Continue
              </Button>
            ) : (
              <Button 
                className="bg-[#2F5BEA] hover:bg-[#1D4ED8] text-white rounded-[10px] h-11 px-8 font-semibold shadow-sm transition-colors" 
                onClick={() => handleCreateRequests(pendingSampleDocument)}
                disabled={loading || selectedDocuments.length === 0 || formData.suppliers.length === 0}
              >
                {loading ? 'Sending...' : `Send ${selectedDocuments.length} Requests`}
              </Button>
            )}
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewRequestModal;
