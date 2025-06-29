
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
import { Checkbox } from '@/components/ui/checkbox';
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
  Send,
  X,
  Plus
} from 'lucide-react';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRequest: (request: any) => void;
  userType: string;
}

const NewRequestModal = ({ isOpen, onClose, onCreateRequest, userType }: NewRequestModalProps) => {
  const [step, setStep] = useState(1);
  const [selectedDocuments, setSelectedDocuments] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    supplier: '',
    priority: 'medium',
    dueDate: '',
    notes: '',
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

  const handleDocumentToggle = (doc: any, checked: boolean) => {
    if (checked) {
      setSelectedDocuments(prev => [...prev, doc]);
    } else {
      setSelectedDocuments(prev => prev.filter(d => d.id !== doc.id));
    }
  };

  const removeSelectedDocument = (docId: string) => {
    setSelectedDocuments(prev => prev.filter(d => d.id !== docId));
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

  const complianceDocuments = getComplianceDocuments();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
          <div className="space-y-6">
            {/* Selected Documents Summary */}
            {selectedDocuments.length > 0 && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-blue-600" />
                    Selected Documents ({selectedDocuments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {selectedDocuments.map((doc) => (
                      <Badge 
                        key={doc.id} 
                        variant="secondary" 
                        className="flex items-center gap-1 px-3 py-1"
                      >
                        {doc.title}
                        <X 
                          className="w-3 h-3 cursor-pointer hover:text-red-600" 
                          onClick={() => removeSelectedDocument(doc.id)}
                        />
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button 
                      onClick={() => setStep(2)}
                      disabled={selectedDocuments.length === 0}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Configure Requests
                      <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Document Selection Grid */}
            <div className="grid gap-4">
              {complianceDocuments.map((doc) => (
                <Card 
                  key={doc.id} 
                  className={`cursor-pointer transition-all border-l-4 ${
                    selectedDocuments.find(d => d.id === doc.id) 
                      ? 'border-l-blue-500 bg-blue-50 shadow-md' 
                      : 'border-l-gray-300 hover:shadow-md hover:border-l-blue-400'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={!!selectedDocuments.find(d => d.id === doc.id)}
                          onCheckedChange={(checked) => handleDocumentToggle(doc, checked as boolean)}
                        />
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

        {step === 2 && (
          <div className="space-y-6">
            {/* Selected Documents Preview */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-600" />
                  Creating {selectedDocuments.length} Document Request(s)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                      <doc.icon className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">{doc.title}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Request Configuration */}
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
                  <Label>Batch Request Summary</Label>
                  <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                    {selectedDocuments.map((doc, index) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                        <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                          {index + 1}
                        </span>
                        <span className="flex-1">{doc.title}</span>
                        <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Additional Notes (Applied to all requests)</Label>
              <Textarea
                id="notes"
                placeholder="Add any specific requirements, deadlines, or instructions that apply to all selected documents..."
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
                onClick={handleCreateRequests}
                disabled={!formData.supplier || !formData.dueDate || selectedDocuments.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Create {selectedDocuments.length} Request(s)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewRequestModal;
