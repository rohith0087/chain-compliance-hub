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
    supplier: '',
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
      // Get buyer profile
      const { data: buyer, error: buyerError } = await supabase
        .from('buyers')
        .select('*')
        .eq('profile_id', user?.id)
        .single();

      if (buyerError) {
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

  const handleCreateRequests = async () => {
    if (!user || !buyerProfile || selectedDocuments.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one document and ensure all fields are filled.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create a separate request for each selected document
      for (const doc of selectedDocuments) {
        const insertData: any = {
          title: doc.title,
          description: doc.description,
          document_type: doc.title,
          category: doc.category,
          priority: formData.priority,
          due_date: formData.dueDate || null,
          supplier_id: formData.supplier,
          buyer_id: buyerProfile.id,
          requester_id: user.id,
          branch_id: currentBranch?.id || null,
          notes: formData.notes || null,
          template_sections: doc.template || null,
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
        const supplier = connectedSuppliers.find(s => s.id === formData.supplier);
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
      }

      toast({
        title: "Requests Created",
        description: `Successfully created ${selectedDocuments.length} document request(s).`,
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
      supplier: '',
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
                <SelectItem value="Sushi Company">Sushi Company</SelectItem>
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
            onBack={() => setStep(1)}
            onCreateRequests={handleCreateRequests}
            onCancel={onClose}
            loading={loading}
            connectedSuppliers={connectedSuppliers}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewRequestModal;
