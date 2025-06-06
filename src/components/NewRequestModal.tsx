
import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, 
  Shield, 
  Truck, 
  Building2, 
  Users, 
  ClipboardCheck,
  AlertTriangle,
  Calendar,
  ArrowLeft,
  Send
} from 'lucide-react';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRequest: (request: any) => void;
  userType: string;
}

const NewRequestModal = ({ isOpen, onClose, onCreateRequest, userType }: NewRequestModalProps) => {
  const [step, setStep] = useState(1);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [formData, setFormData] = useState({
    supplier: '',
    priority: 'medium',
    dueDate: '',
    notes: '',
    documentType: '',
    templateData: {}
  });

  // Industry-specific compliance documents
  const getComplianceDocuments = () => {
    if (userType === 'Chicken Processor Co') {
      return [
        {
          id: 'haccp-plan',
          title: 'HACCP Plan',
          category: 'FDA Compliance',
          description: 'Hazard Analysis and Critical Control Points plan for food safety',
          icon: Shield,
          required: true,
          regulatoryBody: 'FDA',
          template: {
            sections: [
              { name: 'Hazard Analysis', required: true },
              { name: 'Critical Control Points', required: true },
              { name: 'Critical Limits', required: true },
              { name: 'Monitoring Procedures', required: true },
              { name: 'Corrective Actions', required: true },
              { name: 'Verification Procedures', required: true },
              { name: 'Record Keeping', required: true }
            ]
          }
        },
        {
          id: 'ssop',
          title: 'Sanitation SOPs',
          category: 'USDA/FSIS',
          description: 'Sanitation Standard Operating Procedures',
          icon: ClipboardCheck,
          required: true,
          regulatoryBody: 'USDA/FSIS',
          template: {
            sections: [
              { name: 'Pre-operational Sanitation', required: true },
              { name: 'Operational Sanitation', required: true },
              { name: 'Cleaning Procedures', required: true },
              { name: 'Sanitizing Procedures', required: true }
            ]
          }
        },
        {
          id: 'supplier-verification',
          title: 'Supplier Verification Program',
          category: 'FSMA',
          description: 'Supplier verification and approval documentation',
          icon: Users,
          required: true,
          regulatoryBody: 'FDA/FSMA',
          template: {
            sections: [
              { name: 'Supplier Approval Process', required: true },
              { name: 'Risk Assessment', required: true },
              { name: 'Verification Activities', required: true },
              { name: 'Corrective Actions', required: true }
            ]
          }
        },
        {
          id: 'pathogen-testing',
          title: 'Pathogen Testing Records',
          category: 'FSIS',
          description: 'Salmonella and other pathogen testing documentation',
          icon: AlertTriangle,
          required: true,
          regulatoryBody: 'FSIS',
          template: {
            sections: [
              { name: 'Testing Schedule', required: true },
              { name: 'Sample Collection Procedures', required: true },
              { name: 'Test Results', required: true },
              { name: 'Corrective Actions', required: true }
            ]
          }
        },
        {
          id: 'transport-temp',
          title: 'Temperature Control Records',
          category: 'Transportation',
          description: 'Cold chain maintenance and temperature monitoring',
          icon: Truck,
          required: true,
          regulatoryBody: 'FDA',
          template: {
            sections: [
              { name: 'Temperature Monitoring Plan', required: true },
              { name: 'Equipment Calibration', required: true },
              { name: 'Transport Records', required: true },
              { name: 'Deviation Reports', required: true }
            ]
          }
        },
        {
          id: 'facility-registration',
          title: 'FDA Facility Registration',
          category: 'FDA Registration',
          description: 'Current FDA facility registration certificate',
          icon: Building2,
          required: true,
          regulatoryBody: 'FDA',
          template: {
            sections: [
              { name: 'Registration Number', required: true },
              { name: 'Facility Information', required: true },
              { name: 'Process Categories', required: true },
              { name: 'Renewal Date', required: true }
            ]
          }
        }
      ];
    }
    
    // Default templates for other industries
    return [
      {
        id: 'iso-certificate',
        title: 'ISO 9001 Certificate',
        category: 'Quality Management',
        description: 'Current ISO 9001 quality management certification',
        icon: Shield,
        required: true,
        regulatoryBody: 'ISO',
        template: {
          sections: [
            { name: 'Certificate Details', required: true },
            { name: 'Scope of Certification', required: true },
            { name: 'Validity Period', required: true }
          ]
        }
      },
      {
        id: 'insurance',
        title: 'Liability Insurance',
        category: 'Insurance',
        description: 'General and product liability insurance coverage',
        icon: FileText,
        required: true,
        regulatoryBody: 'Insurance Provider',
        template: {
          sections: [
            { name: 'Policy Number', required: true },
            { name: 'Coverage Amount', required: true },
            { name: 'Effective Dates', required: true }
          ]
        }
      }
    ];
  };

  const suppliers = [
    'Premium Farms LLC',
    'FreshSource Distributors',
    'Quality Feed Solutions',
    'Organic Valley Suppliers',
    'Regional Transport Co.'
  ];

  const handleDocumentSelect = (doc: any) => {
    setSelectedDocument(doc);
    setFormData(prev => ({ ...prev, documentType: doc.id }));
    setStep(2);
  };

  const handleCreateRequest = () => {
    const request = {
      id: Date.now(),
      supplier: formData.supplier,
      documentType: selectedDocument.title,
      category: selectedDocument.category,
      priority: formData.priority,
      dueDate: formData.dueDate,
      status: 'pending',
      notes: formData.notes,
      createdAt: new Date().toISOString(),
      template: selectedDocument.template
    };
    
    onCreateRequest(request);
    onClose();
    setStep(1);
    setSelectedDocument(null);
    setFormData({
      supplier: '',
      priority: 'medium',
      dueDate: '',
      notes: '',
      documentType: '',
      templateData: {}
    });
  };

  const complianceDocuments = getComplianceDocuments();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                className="mr-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {step === 1 ? 'Select Compliance Document' : 'Create Document Request'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? `Select the required compliance document for ${userType} industry standards`
              : `Configure the request details for ${selectedDocument?.title}`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6">
            <div className="grid gap-4">
              {complianceDocuments.map((doc) => (
                <Card 
                  key={doc.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                  onClick={() => handleDocumentSelect(doc)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <doc.icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{doc.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">{doc.category}</Badge>
                            <Badge variant="outline">{doc.regulatoryBody}</Badge>
                            {doc.required && (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-3">{doc.description}</p>
                    <div className="text-sm text-gray-500">
                      <strong>Template includes:</strong> {doc.template.sections.map(s => s.name).join(', ')}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedDocument && (
          <div className="space-y-6">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <selectedDocument.icon className="w-6 h-6 text-blue-600" />
                  <div>
                    <CardTitle>{selectedDocument.title}</CardTitle>
                    <p className="text-sm text-gray-600">{selectedDocument.description}</p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="supplier">Select Supplier *</Label>
                  <Select value={formData.supplier} onValueChange={(value) => setFormData(prev => ({ ...prev, supplier: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(supplier => (
                        <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Priority Level</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="dueDate">Due Date *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Required Template Sections</Label>
                  <div className="space-y-2 mt-2">
                    {selectedDocument.template.sections.map((section: any, index: number) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <ClipboardCheck className="w-4 h-4 text-green-600" />
                        <span className="text-sm">{section.name}</span>
                        {section.required && (
                          <Badge variant="destructive" className="text-xs ml-auto">Required</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any specific requirements, deadlines, or instructions for the supplier..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateRequest}
                disabled={!formData.supplier || !formData.dueDate}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Create Request
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewRequestModal;
