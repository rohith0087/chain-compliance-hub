
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X, ChevronsUpDown, Building2, FileText, Users, Flag, Clock, MessageSquare, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComplianceDocument } from './ComplianceDocuments';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import SampleDocumentUpload from './SampleDocumentUpload';

interface LibraryDocument {
  id: string;
  document_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
}

interface SupplierBranch {
  id: string;
  branch_name: string;
  location?: string;
}

interface SampleDocument {
  file?: File;
  libraryDoc?: LibraryDocument;
  source: 'device' | 'library' | null;
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
  onCreateRequests: (sampleDocument?: SampleDocument) => void;
  onCancel: () => void;
  loading?: boolean;
  connectedSuppliers: any[];
  buyerId?: string;
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
  connectedSuppliers,
  buyerId
}: RequestConfigurationStepProps) => {
  const [dueDate, setDueDate] = useState<Date>();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierBranches, setSupplierBranches] = useState<Record<string, SupplierBranch[]>>({});
  const [loadingBranches, setLoadingBranches] = useState<Record<string, boolean>>({});
  const [sampleDocument, setSampleDocument] = useState<SampleDocument>({ source: null });

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
      <Card className="border-l-4 border-l-primary bg-gradient-to-br from-primary/5 via-background to-primary/5 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-md bg-primary/10">
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
            <span>Selected Documents</span>
            <Badge variant="secondary" className="ml-auto bg-primary/10 text-primary border-0">
              {selectedDocuments.length} selected
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {selectedDocuments.map((doc) => (
              <Badge 
                key={doc.id} 
                variant="secondary" 
                className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 shadow-sm px-3 py-1.5"
              >
                <FileText className="h-3 w-3" />
                <span className="font-medium">{doc.title}</span>
                <span className="text-xs opacity-80">({doc.category})</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <div className="space-y-5">
        {/* Suppliers & Priority Section */}
        <div className="p-4 rounded-lg border bg-card shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b">
            <div className="p-1.5 rounded-md bg-blue-500/10">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-sm">Recipients & Priority</h3>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="suppliers" className="text-sm font-medium flex items-center gap-2">
                Suppliers
                <span className="text-destructive">*</span>
                <Badge variant="outline" className="ml-1 text-xs font-normal">
                  {formData.suppliers.length} selected
                </Badge>
              </Label>
              
              {/* Selected Suppliers Badges */}
              {formData.suppliers.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg border border-border/50">
                  {formData.suppliers.map(supplierId => {
                    const supplier = connectedSuppliers.find(s => s.id === supplierId);
                    return supplier ? (
                      <Badge 
                        key={supplierId} 
                        variant="secondary" 
                        className="flex items-center gap-1.5 bg-primary text-primary-foreground shadow-sm"
                      >
                        {supplier.company_name}
                        <X 
                          className="h-3 w-3 cursor-pointer hover:opacity-70 transition-opacity" 
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
                    className="w-full justify-between border-border/80 hover:bg-accent/50 hover:border-primary/50 transition-colors"
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

            <div className="space-y-2">
              <Label htmlFor="priority" className="text-sm font-medium flex items-center gap-2">
                <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                Priority
              </Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value) => onFormDataChange('priority', value)}
              >
                <SelectTrigger className="border-border/80 hover:border-primary/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      Low
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Urgent
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Supplier Branch Selection - Show for each selected supplier with multiple branches */}
        {formData.suppliers.length > 0 && formData.suppliers.some(id => (supplierBranches[id]?.length || 0) > 1 || loadingBranches[id]) && (
          <div className="p-4 rounded-lg border bg-card shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <div className="p-1.5 rounded-md bg-purple-500/10">
                <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-sm">Target Branches</h3>
            </div>
            
            <div className="space-y-3">
              {formData.suppliers.map(supplierId => {
                const supplier = connectedSuppliers.find(s => s.id === supplierId);
                const branches = supplierBranches[supplierId] || [];
                const isLoading = loadingBranches[supplierId];
                
                // Only show branch selector if supplier has multiple branches
                if (isLoading) {
                  return (
                    <div key={supplierId} className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Loading branches for {supplier?.company_name}...
                    </div>
                  );
                }
                
                if (branches.length <= 1) return null;
                
                return (
                  <div key={supplierId} className="p-3 border rounded-lg bg-muted/20">
                    <Label className="flex items-center gap-2 mb-2 text-sm font-medium">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {supplier?.company_name}
                    </Label>
                    <Select 
                      value={formData.supplierBranches[supplierId] || ''} 
                      onValueChange={(value) => onSupplierBranchChange(supplierId, value)}
                    >
                      <SelectTrigger className="bg-background border-border/80">
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
          </div>
        )}

        {/* Due Date & Notes Section */}
        <div className="p-4 rounded-lg border bg-card shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b">
            <div className="p-1.5 rounded-md bg-emerald-500/10">
              <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-semibold text-sm">Timeline & Notes</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Due Date
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left font-normal border-border/80 hover:border-primary/50 transition-colors"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {dueDate ? format(dueDate, "PPP") : <span className="text-muted-foreground">Select a due date</span>}
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

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                Additional Notes
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="notes"
                placeholder="Add any additional requirements or instructions..."
                value={formData.notes}
                onChange={(e) => onFormDataChange('notes', e.target.value)}
                rows={3}
                className="resize-none border-border/80 focus:border-primary/50"
              />
            </div>
          </div>
        </div>

        {/* Sample Document Upload */}
        {buyerId && (
          <SampleDocumentUpload
            buyerId={buyerId}
            currentSample={sampleDocument}
            onSampleChange={setSampleDocument}
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="border-border/80">
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="border-border/80">
            Cancel
          </Button>
          <Button 
            onClick={() => onCreateRequests(sampleDocument)} 
            disabled={!isFormValid || loading}
            className="bg-primary hover:bg-primary/90 shadow-sm"
          >
            {loading ? 'Creating Requests...' : `Create ${selectedDocuments.length} Request(s)`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RequestConfigurationStep;
