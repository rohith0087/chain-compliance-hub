import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X, ChevronsUpDown, Building2, Loader2, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ComplianceDocument } from './ComplianceDocuments';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { draftMessage } from '@/lib/requestAiAssist';
import {
  cardClass,
  cardPadClass,
  sectionLabelClass,
  pillClass,
  pillAccentClass,
} from '@/design/system';

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
  entityType?: string;
}

const RequestConfigurationStep = ({
  selectedDocuments,
  formData,
  onFormDataChange,
  onSuppliersChange,
  onSupplierBranchChange,
  connectedSuppliers,
  buyerId,
  entityType = 'General Supplier'
}: RequestConfigurationStepProps) => {
  const [dueDate, setDueDate] = useState<Date>();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierBranches, setSupplierBranches] = useState<Record<string, SupplierBranch[]>>({});
  const [loadingBranches, setLoadingBranches] = useState<Record<string, boolean>>({});
  const [draftingNotes, setDraftingNotes] = useState(false);

  // Keep the local calendar state in sync when the due date is applied
  // externally (e.g. from the AI guidance rail).
  useEffect(() => {
    if (formData.dueDate) {
      const parsed = new Date(`${formData.dueDate}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) setDueDate(parsed);
    } else {
      setDueDate(undefined);
    }
  }, [formData.dueDate]);

  // Fetch branches for selected suppliers
  useEffect(() => {
    const fetchBranchesForSuppliers = async () => {
      for (const supplierId of formData.suppliers) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const generateInstructions = async () => {
    if (!buyerId) return;
    setDraftingNotes(true);
    const result = await draftMessage(
      buyerId,
      entityType,
      selectedDocuments.map((d) => d.title),
      formData.priority,
      formData.dueDate || null,
    );
    if (result?.message) onFormDataChange('notes', result.message);
    setDraftingNotes(false);
  };

  const filteredSuppliers = connectedSuppliers.filter(supplier =>
    supplier.company_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Selected documents recap */}
      {selectedDocuments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedDocuments.map((doc) => (
            <span key={doc.id} className={pillClass}>{doc.title}</span>
          ))}
          <span className={`${pillAccentClass} ml-auto`}>{selectedDocuments.length} selected</span>
        </div>
      )}

      {/* Recipients */}
      <div className={cardClass}>
        <div className="border-b border-border px-5 py-3.5">
          <p className={sectionLabelClass}>Recipients</p>
        </div>
        <div className={cardPadClass}>
          <div className="space-y-3">
            <Label htmlFor="suppliers" className="flex items-center gap-2 text-small font-semibold text-foreground">
              Suppliers <span className="text-danger">*</span>
              {formData.suppliers.length > 0 && (
                <span className={pillClass}>{formData.suppliers.length} selected</span>
              )}
            </Label>

            {formData.suppliers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.suppliers.map(supplierId => {
                  const supplier = connectedSuppliers.find(s => s.id === supplierId);
                  return supplier ? (
                    <span key={supplierId} className={`${pillAccentClass} gap-1.5`}>
                      {supplier.company_name}
                      <X
                        className="h-3 w-3 cursor-pointer opacity-80 hover:opacity-100"
                        onClick={() => handleRemoveSupplier(supplierId)}
                      />
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="h-10 w-full justify-between font-normal text-muted-foreground"
                >
                  Select suppliers…
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search suppliers…"
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
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <Checkbox
                            checked={formData.suppliers.includes(supplier.id)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
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

          {/* Target branches */}
          {formData.suppliers.length > 0 && formData.suppliers.some(id => (supplierBranches[id]?.length || 0) > 1 || loadingBranches[id]) && (
            <div className="mt-5 space-y-3 border-t border-border pt-5">
              <p className={sectionLabelClass}>Target branches</p>
              {formData.suppliers.map(supplierId => {
                const supplier = connectedSuppliers.find(s => s.id === supplierId);
                const branches = supplierBranches[supplierId] || [];
                const isLoading = loadingBranches[supplierId];

                if (isLoading) {
                  return (
                    <div key={supplierId} className="flex items-center gap-2 rounded-control bg-muted p-3 text-small text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading branches for {supplier?.company_name}…
                    </div>
                  );
                }
                if (branches.length <= 1) return null;

                return (
                  <div key={supplierId} className="rounded-control border border-border bg-muted/50 p-3">
                    <Label className="mb-2 flex items-center gap-2 text-small font-medium text-foreground">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {supplier?.company_name}
                    </Label>
                    <Select
                      value={formData.supplierBranches[supplierId] || ''}
                      onValueChange={(value) => onSupplierBranchChange(supplierId, value)}
                    >
                      <SelectTrigger className="h-9 bg-card">
                        <SelectValue placeholder="All branches (default)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All branches</SelectItem>
                        {branches.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.branch_name}
                            {branch.location && (
                              <span className="text-muted-foreground"> — {branch.location}</span>
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
        </div>
      </div>

      {/* Request details */}
      <div className={cardClass}>
        <div className="border-b border-border px-5 py-3.5">
          <p className={sectionLabelClass}>Request details</p>
        </div>
        <div className={`${cardPadClass} space-y-5`}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="priority" className="text-small font-semibold text-foreground">
                Priority <span className="text-danger">*</span>
              </Label>
              <Select value={formData.priority} onValueChange={(value) => onFormDataChange('priority', value)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-muted-foreground/50" />Low</span></SelectItem>
                  <SelectItem value="medium"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" />Medium</span></SelectItem>
                  <SelectItem value="high"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-warning" />High</span></SelectItem>
                  <SelectItem value="urgent"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-danger" />Urgent</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-small font-semibold text-foreground">
                Due date <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-10 w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {dueDate ? format(dueDate, 'PPP') : <span className="text-muted-foreground">Select a due date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dueDate} onSelect={handleDateChange} disabled={(date) => date < new Date()} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="relative space-y-2">
            <Label htmlFor="notes" className="text-small font-semibold text-foreground">
              Instructions to supplier <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any additional requirements or instructions…"
              value={formData.notes}
              onChange={(e) => onFormDataChange('notes', e.target.value)}
              rows={4}
              className="resize-none pb-8"
            />
            <button
              type="button"
              onClick={generateInstructions}
              disabled={draftingNotes || !buyerId}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 text-caption font-semibold text-primary hover:underline disabled:opacity-50"
            >
              {draftingNotes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {draftingNotes ? 'Drafting…' : 'Generate with AI'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestConfigurationStep;
