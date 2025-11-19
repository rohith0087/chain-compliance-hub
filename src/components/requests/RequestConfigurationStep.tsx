
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X, Check, ChevronsUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComplianceDocument } from './ComplianceDocuments';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface RequestConfigurationStepProps {
  selectedDocuments: ComplianceDocument[];
  formData: {
    suppliers: string[];
    priority: string;
    dueDate: string;
    notes: string;
  };
  onFormDataChange: (field: string, value: string) => void;
  onSuppliersChange: (suppliers: string[]) => void;
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
  onSuppliersChange,
  onBack,
  onCreateRequests,
  onCancel,
  loading = false,
  connectedSuppliers
}: RequestConfigurationStepProps) => {
  const [dueDate, setDueDate] = React.useState<Date>();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleDateChange = (date: Date | undefined) => {
    setDueDate(date);
    onFormDataChange('dueDate', date ? date.toISOString().split('T')[0] : '');
  };

  const handleSupplierToggle = (supplierId: string) => {
    const newSuppliers = formData.suppliers.includes(supplierId)
      ? formData.suppliers.filter(id => id !== supplierId)
      : [...formData.suppliers, supplierId];
    onSuppliersChange(newSuppliers);
  };

  const handleRemoveSupplier = (supplierId: string) => {
    onSuppliersChange(formData.suppliers.filter(id => id !== supplierId));
  };

  const filteredSuppliers = connectedSuppliers.filter(supplier =>
    supplier.company_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isFormValid = formData.suppliers.length > 0 && selectedDocuments.length > 0;

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
          <div className="space-y-2">
            <Label htmlFor="suppliers">Suppliers * ({formData.suppliers.length} selected)</Label>
            
            {/* Selected Suppliers Badges */}
            {formData.suppliers.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md">
                {formData.suppliers.map(supplierId => {
                  const supplier = connectedSuppliers.find(s => s.id === supplierId);
                  return supplier ? (
                    <Badge key={supplierId} variant="secondary" className="flex items-center gap-1">
                      {supplier.company_name}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => handleRemoveSupplier(supplierId)}
                      />
                    </Badge>
                  ) : null;
                })}
              </div>
            )}

            {/* Multi-Select Combobox */}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {formData.suppliers.length === 0 
                    ? "Select suppliers..." 
                    : `${formData.suppliers.length} supplier(s) selected`
                  }
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="Search suppliers..." 
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>No suppliers found.</CommandEmpty>
                    <CommandGroup>
                      {filteredSuppliers.map((supplier) => (
                        <CommandItem
                          key={supplier.id}
                          onSelect={() => handleSupplierToggle(supplier.id)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={formData.suppliers.includes(supplier.id)}
                            onCheckedChange={() => handleSupplierToggle(supplier.id)}
                          />
                          <span>{supplier.company_name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
