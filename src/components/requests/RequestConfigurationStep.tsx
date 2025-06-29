
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, ArrowLeft } from 'lucide-react';
import { ComplianceDocument, suppliers } from './ComplianceDocuments';

interface RequestConfigurationStepProps {
  selectedDocuments: ComplianceDocument[];
  formData: {
    supplier: string;
    priority: string;
    dueDate: string;
    notes: string;
  };
  onFormDataChange: (field: string, value: string) => void;
  onBack: () => void;
  onCreateRequests: () => void;
  onCancel: () => void;
}

const RequestConfigurationStep = ({
  selectedDocuments,
  formData,
  onFormDataChange,
  onBack,
  onCreateRequests,
  onCancel
}: RequestConfigurationStepProps) => {
  return (
    <div className="space-y-6">
      {/* Selected Documents Preview */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="mr-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
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
            <Select 
              value={formData.supplier} 
              onValueChange={(value) => onFormDataChange('supplier', value)}
            >
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
            <Select 
              value={formData.priority} 
              onValueChange={(value) => onFormDataChange('priority', value)}
            >
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
              onChange={(e) => onFormDataChange('dueDate', e.target.value)}
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
          onChange={(e) => onFormDataChange('notes', e.target.value)}
          rows={4}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={onCreateRequests}
          disabled={!formData.supplier || !formData.dueDate || selectedDocuments.length === 0}
          className="bg-green-600 hover:bg-green-700"
        >
          <Send className="w-4 h-4 mr-2" />
          Create {selectedDocuments.length} Request(s)
        </Button>
      </div>
    </div>
  );
};

export default RequestConfigurationStep;
