import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Check, FileText } from 'lucide-react';
import DocumentSelectionStep from './DocumentSelectionStep';
import RequestConfigurationStep from './RequestConfigurationStep';
import RequestReusePreflightStep, {
  type RequestPreflightResult,
  type RequestReuseResolution,
} from './RequestReusePreflightStep';
import RequestReviewStep, { ReviewAiSummaryPanel } from './RequestReviewStep';
import RequestSummaryRail from './RequestSummaryRail';
import { getComplianceDocuments, ComplianceDocument } from './ComplianceDocuments';
import {
  cardClass,
  cardPadClass,
  pageTitleClass,
  sectionLabelClass,
  mutedBodyClass,
  emptyStateClass,
} from '@/design/system';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBranchSupplierConnections } from '@/hooks/useBranchSupplierConnections';
import { getWorkspaceProfileForIndustry } from '@/config/workspaceProfiles';
import { useCanonicalEvidenceFeature } from '@/hooks/useCanonicalEvidenceFeature';
import { useOrganizationFeature } from '@/hooks/useOrganizationFeature';

interface CreateRequestSectionProps {
  onCreateRequest: (request: any) => void;
  onDone: () => void;
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

const STEPS = [
  { n: 1, label: 'Select Documents' },
  { n: 2, label: 'Configure Request' },
  { n: 3, label: 'Review & Send' },
];

const CreateRequestSection = ({ onCreateRequest, onDone, currentBranch }: CreateRequestSectionProps) => {
  const [step, setStep] = useState(1);
  const [selectedSupplierType, setSelectedSupplierType] = useState<string>('General Supplier');
  const [selectedDocuments, setSelectedDocuments] = useState<ComplianceDocument[]>([]);
  const [formData, setFormData] = useState({
    suppliers: [] as string[],
    supplierBranches: {} as Record<string, string>,
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
  const { enabled: reliableDeliveryEnabled } = useOrganizationFeature('reliable_request_delivery_v1', buyerProfile?.id, 'buyer');
  const staticComplianceDocuments = useMemo(() => getComplianceDocuments(selectedSupplierType), [selectedSupplierType]);

  const { connections: branchSupplierConnections, loading: branchSuppliersLoading } = useBranchSupplierConnections(currentBranch?.id);
  const [allConnectedSuppliers, setAllConnectedSuppliers] = useState<any[]>([]);

  const connectedSuppliers = currentBranch
    ? branchSupplierConnections.map(conn => ({ id: conn.supplier_id, company_name: conn.supplier?.company_name || 'Supplier' }))
    : allConnectedSuppliers;

  useEffect(() => {
    if (user) fetchBuyerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Apply auditor workspace defaults: lock entity type to "Auditor"
  const wsProfile = getWorkspaceProfileForIndustry(buyerProfile?.industry);
  const wsFlags = wsProfile.flags;
  useEffect(() => {
    if (wsFlags.defaultEntityType && selectedSupplierType !== wsFlags.defaultEntityType) {
      setSelectedSupplierType(wsFlags.defaultEntityType);
      setSelectedDocuments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsFlags.defaultEntityType]);

  useEffect(() => {
    const transformedCustomTemplates: ComplianceDocument[] = customTemplates.map(template => ({
      id: `custom-${template.id}`,
      title: template.template_name,
      category: template.category,
      description: template.description || 'Custom template',
      icon: staticComplianceDocuments[0]?.icon || FileText,
      required: false,
      regulatoryBody: 'Custom Template',
      template: { sections: template.required_fields || [] },
      isCustomTemplate: true,
      customTemplateId: template.id,
    }));
    setAllDocuments([...staticComplianceDocuments, ...transformedCustomTemplates]);
  }, [staticComplianceDocuments, customTemplates]);

  const fetchBuyerData = async () => {
    try {
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', user?.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .maybeSingle();

      const buyerId = teamMember?.company_id || user?.id;

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

      if (!currentBranch) {
        const { data: connections, error: connectionsError } = await supabase
          .from('buyer_supplier_connections')
          .select(`*, suppliers (*)`)
          .eq('buyer_id', buyer.id)
          .eq('status', 'approved');

        if (connectionsError) {
          console.error('Error fetching connections:', connectionsError);
          return;
        }
        setAllConnectedSuppliers(connections?.map(conn => conn.suppliers) || []);
      }

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
      const newSupplierBranches = { ...prev.supplierBranches };
      Object.keys(newSupplierBranches).forEach(supplierId => {
        if (!suppliers.includes(supplierId)) delete newSupplierBranches[supplierId];
      });
      return { ...prev, suppliers, supplierBranches: newSupplierBranches };
    });
  };

  const handleSupplierBranchChange = (supplierId: string, branchId: string) => {
    setFormData(prev => ({
      ...prev,
      supplierBranches: { ...prev.supplierBranches, [supplierId]: branchId },
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
      toast({ title: 'Error', description: 'Please select at least one document and one supplier.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      let sampleData: Record<string, unknown> = {};

      if (sampleDocument?.source === 'device' && sampleDocument.file) {
        const file = sampleDocument.file;
        const fileExt = file.name.split('.').pop();
        const timestamp = Date.now();
        const fileKey = `${buyerProfile.id}/${crypto.randomUUID()}_${timestamp}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('sample-documents').upload(fileKey, file);
        if (uploadError) {
          console.error('Sample upload error:', uploadError);
          throw new Error('Failed to upload sample document');
        }
        sampleData = {
          sample_file_path: fileKey, sample_file_name: file.name, sample_file_size: file.size,
          sample_mime_type: file.type, sample_uploaded_by: user.id, sample_uploaded_at: new Date().toISOString(),
        };
      } else if (sampleDocument?.source === 'library' && sampleDocument.libraryDoc) {
        const libDoc = sampleDocument.libraryDoc;
        sampleData = {
          sample_file_path: libDoc.file_path, sample_file_name: libDoc.document_name, sample_file_size: libDoc.file_size,
          sample_mime_type: libDoc.mime_type, sample_uploaded_by: user.id, sample_uploaded_at: new Date().toISOString(),
        };
      }

      let totalRequestsCreated = 0;
      const requestsBySupplier: Record<string, string[]> = {};

      for (const doc of selectedDocuments) {
        for (const supplierId of formData.suppliers) {
          const supplierBranchId = formData.supplierBranches[supplierId] === 'all' ? null : (formData.supplierBranches[supplierId] || null);

          let finalSampleData = { ...sampleData };
          if (!sampleDocument?.source) {
            const { data: templateData } = await supabase
              .from('buyer_sample_templates')
              .select('*')
              .eq('buyer_id', buyerProfile.id)
              .eq('document_type', doc.title)
              .maybeSingle();
            if (templateData) {
              finalSampleData = {
                sample_file_path: templateData.sample_file_path, sample_file_name: templateData.sample_file_name,
                sample_file_size: templateData.sample_file_size, sample_mime_type: templateData.sample_mime_type,
                sample_uploaded_by: templateData.uploaded_by, sample_uploaded_at: templateData.created_at,
              };
            }
          }

          const insertData: any = {
            title: doc.title, description: doc.description, document_type: doc.title, category: doc.category,
            priority: formData.priority, due_date: formData.dueDate || null, supplier_id: supplierId,
            buyer_id: buyerProfile.id, requester_id: user.id, branch_id: currentBranch?.id || null,
            supplier_branch_id: supplierBranchId, notes: formData.notes || null,
            template_sections: doc.template || null, ...finalSampleData,
          };
          if ((doc as any).isCustomTemplate && (doc as any).customTemplateId) {
            insertData.custom_template_id = (doc as any).customTemplateId;
            insertData.template_type = 'custom';
          }

          const { data: request, error } = await supabase.from('document_requests').insert(insertData).select().single();
          if (error) {
            console.error('Error creating request:', error);
            throw error;
          }

          const supplier = connectedSuppliers.find(s => s.id === supplierId);
          if (supplier) {
            await supabase.rpc('create_notification', {
              p_user_id: supplier.profile_id, p_title: 'New Document Request',
              p_message: `You have received a new document request: ${doc.title}`,
              p_type: 'request_created', p_reference_id: request.id,
            });
          }

          if (!requestsBySupplier[supplierId]) requestsBySupplier[supplierId] = [];
          requestsBySupplier[supplierId].push(request.id);

          onCreateRequest(request);
          totalRequestsCreated++;
        }
      }

      if (!reliableDeliveryEnabled) {
        for (const [supplierId, requestIds] of Object.entries(requestsBySupplier)) {
          supabase.functions.invoke('send-batch-request-email', { body: { requestIds, supplierId } })
            .catch(err => console.error('Failed to send batch request email:', err));
        }
      }

      toast({
        title: 'Requests Created',
        description: `Successfully created ${totalRequestsCreated} document request(s) for ${formData.suppliers.length} supplier(s).`,
      });
      resetForm();
      onDone();
    } catch (error: any) {
      console.error('Error creating requests:', error);
      toast({ title: 'Error', description: error.message || 'Failed to create requests. Please try again.', variant: 'destructive' });
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
          required_standards: [], reuse_preference: resolution.choice, request_reason_code: resolution.reasonCode || null,
          request_reason_notes: resolution.reasonNotes || null, idempotency_key: crypto.randomUUID(),
          template_sections: doc.template || null, template_type: doc.isCustomTemplate ? 'custom' : 'standard',
          custom_template_id: doc.customTemplateId || null, ...sampleData,
        };
      });
      const { data, error } = await supabase.functions.invoke('create-document-requests-v2', { body: { requests } });
      if (error) throw error;
      const allResults = (data?.results || []) as CanonicalRequestResult[];
      const created = allResults.map((result, index) => ({ result, request: requests[index] })).filter(({ result }) => result.request_id);
      const bySupplier: Record<string, string[]> = {};
      created.forEach(({ result, request }) => {
        if (request.supplier_id && result.fulfillment_status !== 'fulfilled_existing') {
          (bySupplier[request.supplier_id] ||= []).push(result.request_id!);
        }
        onCreateRequest(result);
      });
      if (!reliableDeliveryEnabled) {
        for (const [supplierId, requestIds] of Object.entries(bySupplier)) {
          void supabase.functions.invoke('send-batch-request-email', { body: { requestIds, supplierId } });
        }
      }
      toast({
        title: 'Requests resolved',
        description: `${created.length} request(s) created or fulfilled; ${requests.length - created.length} duplicate request(s) cancelled.`,
      });
      resetForm();
      onDone();
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
    setPendingSampleDocument({ source: null });
    setFormData({ suppliers: [], supplierBranches: {}, priority: 'medium', dueDate: '', notes: '' });
  };

  // ── Guard states ────────────────────────────────────────────────────────────
  const Header = () => (
    <div className="space-y-1">
      <p className={sectionLabelClass}>New request</p>
      <h1 className={pageTitleClass}>Create Document Request</h1>
    </div>
  );

  if (buyerProfile === null) {
    // still loading, or profile missing — fetchBuyerData bails silently on error
    return (
      <div className="mx-auto w-full max-w-[1120px] space-y-6">
        <Header />
        <div className={emptyStateClass}>Loading your workspace…</div>
      </div>
    );
  }

  if (connectedSuppliers.length === 0 && !branchSuppliersLoading) {
    const message = currentBranch
      ? `No suppliers are assigned to the "${currentBranch.branch_name}" branch. Assign suppliers to this branch first.`
      : 'You need to connect with suppliers before creating document requests.';
    return (
      <div className="mx-auto w-full max-w-[1120px] space-y-6">
        <Header />
        <div className={emptyStateClass}>
          <p>{message}</p>
          <Button variant="outline" size="sm" onClick={onDone} className="mt-2">Back to requests</Button>
        </div>
      </div>
    );
  }

  // Steps 1-3 share the two-column layout; the right column holds the live
  // summary + AI guidance while building (1-2) and the AI send-summary on
  // review (3). The preflight step (4) is full-width.
  const twoColumn = step === 1 || step === 2 || step === 3;

  return (
    // Viewport-locked on lg+: the shell header is 72px and the shell main has
    // py-5 (40px), so the section claims the remaining height and pins its own
    // chrome — tall content scrolls internally instead of the page. Below lg
    // the section falls back to normal page flow (nested scrollbars are poor
    // UX on touch).
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 lg:h-[calc(100vh-112px)]">
      {/* Header + stepper */}
      <div className="flex shrink-0 flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <Header />
        <ol className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const state = step > s.n ? 'done' : step === s.n ? 'active' : 'todo';
            return (
              <React.Fragment key={s.n}>
                <li className="flex items-center gap-2">
                  <span
                    className={
                      'flex h-6 w-6 items-center justify-center rounded-full text-caption font-semibold ' +
                      (state === 'done'
                        ? 'bg-primary text-primary-foreground'
                        : state === 'active'
                          ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'bg-muted text-muted-foreground')
                    }
                  >
                    {state === 'done' ? <Check className="h-3.5 w-3.5" /> : s.n}
                  </span>
                  <span className={`text-small font-medium ${state === 'todo' ? 'text-muted-foreground' : 'text-foreground'} hidden md:inline`}>
                    {s.label}
                  </span>
                </li>
                {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" />}
              </React.Fragment>
            );
          })}
        </ol>
      </div>

      {/* Body — fills the remaining height; each step decides what scrolls. */}
      <div className={`flex-1 lg:min-h-0 ${twoColumn ? 'flex flex-col gap-6 lg:flex-row' : 'flex flex-col'}`}>
        <div
          className={
            step === 1
              // Step 1: chrome (entity type, AI strip, filters) stays pinned;
              // only the document list scrolls (inside DocumentSelectionStep).
              ? 'flex min-w-0 flex-1 flex-col gap-4 lg:min-h-0'
              // Steps 2-4: no single dominant list, so the whole working
              // column scrolls internally under the pinned header/footer.
              : 'min-w-0 flex-1 space-y-5 lg:min-h-0 lg:overflow-y-auto lg:pr-1'
          }
        >
          {step === 1 && (
            <>
              {/* Entity type */}
              <div className={`${cardClass} ${cardPadClass} flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4`}>
                <Label htmlFor="entity-type" className="text-small font-semibold text-foreground shrink-0">
                  {wsFlags.lockEntityType ? 'Engagement type' : 'Entity type'}
                </Label>
                <Select
                  value={selectedSupplierType}
                  onValueChange={(value) => { setSelectedSupplierType(value); setSelectedDocuments([]); }}
                  disabled={wsFlags.lockEntityType}
                >
                  <SelectTrigger className="h-10 sm:max-w-sm">
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

              <div className="flex-1 lg:min-h-0">
                <DocumentSelectionStep
                  complianceDocuments={allDocuments}
                  selectedDocuments={selectedDocuments}
                  onDocumentToggle={handleDocumentToggle}
                  onRemoveSelected={removeSelectedDocument}
                  onNext={() => setStep(2)}
                  buyerId={buyerProfile?.id}
                  entityType={selectedSupplierType}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <RequestConfigurationStep
              selectedDocuments={selectedDocuments}
              formData={formData}
              onFormDataChange={handleFormDataChange}
              onSuppliersChange={handleSuppliersChange}
              onSupplierBranchChange={handleSupplierBranchChange}
              onBack={() => setStep(1)}
              onCreateRequests={handleCreateRequests}
              onCancel={onDone}
              loading={loading}
              connectedSuppliers={connectedSuppliers}
              buyerId={buyerProfile?.id}
              entityType={selectedSupplierType}
            />
          )}

          {step === 3 && (
            <RequestReviewStep
              selectedDocuments={selectedDocuments}
              formData={formData}
              buyerId={buyerProfile?.id}
              entityType={selectedSupplierType}
              sampleDocument={pendingSampleDocument}
              setSampleDocument={setPendingSampleDocument}
            />
          )}

          {step === 4 && (
            <RequestReusePreflightStep
              results={preflightResults}
              suppliers={connectedSuppliers}
              resolutions={reuseResolutions}
              onResolutionChange={(clientKey, resolution) => setReuseResolutions((current) => ({ ...current, [clientKey]: resolution }))}
              onBack={() => setStep(3)}
              onSubmit={handleCanonicalRequests}
              loading={loading}
            />
          )}
        </div>

        {twoColumn && (
          <aside className="w-full shrink-0 lg:w-[320px] lg:min-h-0 lg:overflow-y-auto">
            {step === 3 ? (
              <ReviewAiSummaryPanel
                selectedDocuments={selectedDocuments}
                formData={formData}
                buyerId={buyerProfile?.id}
                entityType={selectedSupplierType}
              />
            ) : (
              <RequestSummaryRail
                entityType={selectedSupplierType}
                buyerId={buyerProfile?.id}
                selectedDocuments={selectedDocuments}
                formData={formData}
                onFormDataChange={handleFormDataChange}
              />
            )}
          </aside>
        )}
      </div>

      {/* Footer actions — pinned below the scroll area (hidden on the
          preflight step, which owns its own submit) */}
      {step !== 4 && (
        <div className="flex shrink-0 items-center justify-between border-t border-border pt-4">
          <Button variant="outline" onClick={onDone}>Cancel</Button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>
            )}
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && selectedDocuments.length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary-hover"
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={() => handleCreateRequests(pendingSampleDocument)}
                disabled={loading || selectedDocuments.length === 0 || formData.suppliers.length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary-hover"
              >
                {loading ? 'Sending…' : `Send ${selectedDocuments.length} request${selectedDocuments.length === 1 ? '' : 's'}`}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateRequestSection;
