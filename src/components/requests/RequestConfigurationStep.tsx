
import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X, ChevronsUpDown, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComplianceDocument } from './ComplianceDocuments';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';

interface SupplierBranch {
  id: string;
  branch_name: string;
  location?: string;
}

interface RequestConfigurationStepProps {
  selectedDocuments: ComplianceDocument[];
  formData: {
    suppliers: string[];
    supplierBranches: Record<string, string>; // supplierId -> branchId
    priority: string;
    dueDate: string;
    notes: string;
  };
  onFormDataChange: (field: string, value: string) => void;
  onSuppliersChange: (suppliers: string[]) => void;
  onSupplierBranchChange: (supplierId: string, branchId: string) => void;
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
  onSupplierBranchChange,
  onBack,
  onCreateRequests,
  onCancel,
  loading = false,
  connectedSuppliers
}: RequestConfigurationStepProps) => {
  const [dueDate, setDueDate] = React.useState<Date>();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [supplierBranches, setSupplierBranches] = React.useState<Record<string, SupplierBranch[]>>({});
  const [loadingBranches, setLoadingBranches] = React.useState<Record<string, boolean>>({});

  // Fetch branches for selected suppliers
  useEffect(() => {
    const fetchBranchesForSuppliers = async () => {
      for (const supplierId of formData.suppliers) {
        // Skip if already fetched
        if (supplierBranches[supplierId]) continue;
        
        setLoadingBranches(prev => ({ ...prev, [supplierId]: true }));
        
        try {
          const { data, error } = await supabase
            .from('company_branches')
            .select('id, branch_name, location')
            .eq('company_id', supplierId)
            .eq('company_type', 'supplier')
            .eq('status', 'active')
            .order('branch_name');
          
          if (!error && data) {
            setSupplierBranches(prev => ({ ...prev, [supplierId]: data }));
          }
        } catch (err) {
          console.error('Error fetching supplier branches:', err);
        } finally {
          setLoadingBranches(prev => ({ ...prev, [supplierId]: false }));
        }
      }
    };

    if (formData.suppliers.length > 0) {
      fetchBranchesForSuppliers();
    }
  }, [formData.suppliers]);

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

        {/* Supplier Branch Selection - Show for each selected supplier with multiple branches */}
        {formData.suppliers.length > 0 && (
          <div className="space-y-3">
            {formData.suppliers.map(supplierId => {
              const supplier = connectedSuppliers.find(s => s.id === supplierId);
              const branches = supplierBranches[supplierId] || [];
              const isLoading = loadingBranches[supplierId];
              
              // Only show branch selector if supplier has multiple branches
              if (isLoading) {
                return (
                  <div key={supplierId} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    Loading branches for {supplier?.company_name}...
                  </div>
                );
              }
              
              if (branches.length <= 1) return null;
              
              return (
                <div key={supplierId} className="p-3 border rounded-md bg-muted/30">
                  <Label className="flex items-center gap-2 mb-2 text-sm">
                    <Building2 className="h-4 w-4" />
                    Target branch for {supplier?.company_name}
                  </Label>
                  <Select 
                    value={formData.supplierBranches[supplierId] || ''} 
                    onValueChange={(value) => onSupplierBranchChange(supplierId, value)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="All branches (default)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All branches</SelectItem>
                      {branches.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.branch_name}
                          {branch.location && (
                            <span className="text-muted-foreground"> - {branch.location}</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}

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
