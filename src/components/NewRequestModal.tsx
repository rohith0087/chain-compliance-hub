import React, { useState, useMemo } from 'react';
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
import { getComplianceDocuments, ComplianceDocument } from './requests/ComplianceDocuments';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBranchSupplierConnections } from '@/hooks/useBranchSupplierConnections';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRequest: (request: any) => void;
  userType: string;
  currentBranch?: { id: string; branch_name: string } | null;
}

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

  const { user } = useAuth();
  const { toast } = useToast();
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

  const handleCreateRequests = async (sampleDocument?: { file?: File; libraryDoc?: any; source: 'device' | 'library' | null }) => {
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

          // Call the callback to update the parent component
          onCreateRequest(request);
          totalRequestsCreated++;

          // Trigger new request email notification to SUPPLIER (fire and forget)
          supabase.functions.invoke('send-new-request-email', {
            body: { requestId: request.id, supplierId: supplierId }
          }).catch(err => console.error('Failed to send new request email:', err));
        }
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

  const resetForm = () => {
    setStep(1);
    setSelectedDocuments([]);
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Select Entity Type & Compliance Documents' : 'Create Document Requests'}
            {currentBranch && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                for {currentBranch.branch_name}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? `Select the entity type and compliance documents required for audit or compliance purposes`
              : `Configure the batch request details for ${selectedDocuments.length} document(s)`
            }
            {currentBranch && step === 2 && (
              <span className="block mt-1 text-sm">
                Requests will be sent to entities assigned to {currentBranch.branch_name}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6">
            {/* Entity Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="entity-type">Entity Type</Label>
              <Select 
                value={selectedSupplierType} 
                onValueChange={(value) => {
                  setSelectedSupplierType(value);
                  setSelectedDocuments([]); // Clear selected documents when entity type changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="General Supplier">General Supplier</SelectItem>
                <SelectItem value="Egg Processing">Egg Processing / Hatchery</SelectItem>
              </SelectContent>
              </Select>
            </div>

            {/* Document Selection */}
            <DocumentSelectionStep
              complianceDocuments={allDocuments}
              selectedDocuments={selectedDocuments}
              onDocumentToggle={handleDocumentToggle}
              onRemoveSelected={removeSelectedDocument}
              onNext={() => setStep(2)}
              buyerId={buyerProfile?.id}
            />
          </div>
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
            onCancel={onClose}
            loading={loading}
            connectedSuppliers={connectedSuppliers}
            buyerId={buyerProfile?.id}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewRequestModal;
