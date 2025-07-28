
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComplianceDocument } from './ComplianceDocuments';

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
  loading?: boolean;
  connectedSuppliers: any[];
}

const RequestConfigurationStep = ({
  selectedDocuments,
  formData,
  onFormDataChange,
  onBack,
  onCreateRequests,
  onCancel,
  loading = false,
  connectedSuppliers
}: RequestConfigurationStepProps) => {
  const [dueDate, setDueDate] = React.useState<Date>();

  const handleDateChange = (date: Date | undefined) => {
    setDueDate(date);
    onFormDataChange('dueDate', date ? date.toISOString().split('T')[0] : '');
  };

  const isFormValid = formData.supplier && selectedDocuments.length > 0;

  return (
    <div className="space-y-6">
      {/* Selected Documents Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Selected Documents ({selectedDocuments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {selectedDocuments.map((doc) => (
              <Badge key={doc.id} variant="secondary" className="flex items-center gap-1">
                {doc.title}
                <span className="text-xs text-muted-foreground">({doc.category})</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <div className="grid gap-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="supplier">Supplier *</Label>
            <Select 
              value={formData.supplier} 
              onValueChange={(value) => onFormDataChange('supplier', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {connectedSuppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="priority">Priority</Label>
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
        </div>

        <div>
          <Label>Due Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dueDate ? format(dueDate, "PPP") : "Select a due date (optional)"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={handleDateChange}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label htmlFor="notes">Additional Notes</Label>
          <Textarea
            id="notes"
            placeholder="Add any additional requirements or instructions..."
            value={formData.notes}
            onChange={(e) => onFormDataChange('notes', e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={onCreateRequests} 
            disabled={!isFormValid || loading}
          >
            {loading ? 'Creating Requests...' : `Create ${selectedDocuments.length} Request(s)`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RequestConfigurationStep;
