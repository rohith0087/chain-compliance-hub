
import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import DocumentSelectionStep from './requests/DocumentSelectionStep';
import RequestConfigurationStep from './requests/RequestConfigurationStep';
import { getComplianceDocuments, ComplianceDocument } from './requests/ComplianceDocuments';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRequest: (request: any) => void;
  userType: string;
}

const NewRequestModal = ({ isOpen, onClose, onCreateRequest, userType }: NewRequestModalProps) => {
  const [step, setStep] = useState(1);
  const [selectedDocuments, setSelectedDocuments] = useState<ComplianceDocument[]>([]);
  const [formData, setFormData] = useState({
    supplier: '',
    priority: 'medium',
    dueDate: '',
    notes: '',
  });

  const complianceDocuments = getComplianceDocuments(userType);

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

  const handleCreateRequests = () => {
    // Create a separate request for each selected document
    selectedDocuments.forEach(doc => {
      const request = {
        id: Date.now() + Math.random(), // Ensure unique IDs
        supplier: formData.supplier,
        documentType: doc.title,
        category: doc.category,
        priority: formData.priority,
        dueDate: formData.dueDate,
        status: 'pending',
        notes: formData.notes,
        createdAt: new Date().toISOString(),
        template: doc.template
      };
      
      onCreateRequest(request);
    });
    
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setStep(1);
    setSelectedDocuments([]);
    setFormData({
      supplier: '',
      priority: 'medium',
      dueDate: '',
      notes: '',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Select Compliance Documents' : 'Create Document Requests'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? `Select multiple compliance documents for ${userType} industry standards`
              : `Configure the batch request details for ${selectedDocuments.length} document(s)`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <DocumentSelectionStep
            complianceDocuments={complianceDocuments}
            selectedDocuments={selectedDocuments}
            onDocumentToggle={handleDocumentToggle}
            onRemoveSelected={removeSelectedDocument}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <RequestConfigurationStep
            selectedDocuments={selectedDocuments}
            formData={formData}
            onFormDataChange={handleFormDataChange}
            onBack={() => setStep(1)}
            onCreateRequests={handleCreateRequests}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewRequestModal;
