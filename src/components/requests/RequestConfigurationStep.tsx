import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X, ChevronsUpDown, Building2, FileText, Users, Flag, Clock, MessageSquare, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComplianceDocument } from './ComplianceDocuments';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';

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

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left Column: Configuration */}
      <div className="flex-1 space-y-6">
        
        {/* Selected Documents Horizontal Chips */}
        {selectedDocuments.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            {selectedDocuments.map((doc) => (
              <Badge 
                key={doc.id} 
                variant="secondary" 
                className="flex items-center gap-1.5 bg-[#EEF4FF] text-[#2F5BEA] hover:bg-[#EEF4FF] border-0 px-3 py-1.5 rounded-[8px]"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="font-semibold text-[13px]">{doc.title}</span>
              </Badge>
            ))}
            <Badge className="ml-auto bg-transparent text-[#2F5BEA] hover:bg-transparent border-0 shadow-none font-semibold">
              {selectedDocuments.length} selected
            </Badge>
          </div>
        )}

        {/* Recipients Card */}
        <Card className="border-[#E4E7EC] rounded-[16px] shadow-sm">
          <CardHeader className="pb-3 border-b border-[#E4E7EC] px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-[15px] font-bold text-[#111827]">
              <div className="p-1.5 rounded-md bg-[#EEF4FF]">
                <Users className="h-4 w-4 text-[#2F5BEA]" />
              </div>
              Recipients
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-3">
              <Label htmlFor="suppliers" className="text-[13px] font-bold text-[#374151] flex items-center gap-2">
                Suppliers <span className="text-[#D92D20]">*</span>
                {formData.suppliers.length > 0 && (
                  <Badge className="ml-2 bg-[#F3F5F9] text-[#667085] hover:bg-[#F3F5F9] border-0 text-[11px] px-2 py-0">
                    {formData.suppliers.length} selected
                  </Badge>
                )}
              </Label>
              
              {formData.suppliers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.suppliers.map(supplierId => {
                    const supplier = connectedSuppliers.find(s => s.id === supplierId);
                    return supplier ? (
                      <Badge 
                        key={supplierId} 
                        className="flex items-center gap-1.5 bg-[#2F5BEA] text-white hover:bg-[#1D4ED8] border-0 px-3 py-1.5 rounded-[8px]"
                      >
                        {supplier.company_name}
                        <X 
                          className="h-3.5 w-3.5 cursor-pointer opacity-80 hover:opacity-100" 
                          onClick={() => handleRemoveSupplier(supplierId)}
                        />
                      </Badge>
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
                    className="w-full justify-between border-[#E4E7EC] h-10 rounded-[10px] text-[#667085] font-normal hover:bg-[#F9FAFB]"
                  >
                    Select suppliers...
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
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
                              className="rounded-[4px] border-[#D0D5DD] data-[state=checked]:bg-[#2F5BEA] data-[state=checked]:border-[#2F5BEA]"
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
            
            {/* Target Branches Logic */}
            {formData.suppliers.length > 0 && formData.suppliers.some(id => (supplierBranches[id]?.length || 0) > 1 || loadingBranches[id]) && (
              <div className="mt-5 space-y-3 pt-5 border-t border-[#E4E7EC]">
                <h3 className="font-bold text-[13px] text-[#374151]">Target Branches</h3>
                {formData.suppliers.map(supplierId => {
                  const supplier = connectedSuppliers.find(s => s.id === supplierId);
                  const branches = supplierBranches[supplierId] || [];
                  const isLoading = loadingBranches[supplierId];
                  
                  if (isLoading) {
                    return (
                      <div key={supplierId} className="flex items-center gap-2 text-[13px] text-[#667085] p-3 bg-[#F9FAFB] rounded-[10px]">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#2F5BEA]"></div>
                        Loading branches for {supplier?.company_name}...
                      </div>
                    );
                  }
                  if (branches.length <= 1) return null;
                  
                  return (
                    <div key={supplierId} className="p-3 border border-[#E4E7EC] rounded-[10px] bg-[#F9FAFB]">
                      <Label className="flex items-center gap-2 mb-2 text-[13px] font-semibold text-[#111827]">
                        <Building2 className="h-4 w-4 text-[#98A2B3]" />
                        {supplier?.company_name}
                      </Label>
                      <Select 
                        value={formData.supplierBranches[supplierId] || ''} 
                        onValueChange={(value) => onSupplierBranchChange(supplierId, value)}
                      >
                        <SelectTrigger className="bg-white border-[#E4E7EC] h-9 rounded-[8px]">
                          <SelectValue placeholder="All branches (default)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All branches</SelectItem>
                          {branches.map(branch => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.branch_name}
                              {branch.location && (
                                <span className="text-[#667085]"> - {branch.location}</span>
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
          </CardContent>
        </Card>

        {/* Request Details Card */}
        <Card className="border-[#E4E7EC] rounded-[16px] shadow-sm">
          <CardHeader className="pb-3 border-b border-[#E4E7EC] px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-[15px] font-bold text-[#111827]">
              <div className="p-1.5 rounded-md bg-[#EEF4FF]">
                <Flag className="h-4 w-4 text-[#2F5BEA]" />
              </div>
              Request Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-[13px] font-bold text-[#374151]">
                  Priority <span className="text-[#D92D20]">*</span>
                </Label>
                <Select value={formData.priority} onValueChange={(value) => onFormDataChange('priority', value)}>
                  <SelectTrigger className="border-[#E4E7EC] h-10 rounded-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-400" />Low</span></SelectItem>
                    <SelectItem value="medium"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" />Medium</span></SelectItem>
                    <SelectItem value="high"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />High</span></SelectItem>
                    <SelectItem value="urgent"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" />Urgent</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-[#374151]">
                  Due Date <span className="text-[#667085] font-normal">(optional)</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal border-[#E4E7EC] h-10 rounded-[10px]">
                      <CalendarIcon className="mr-2 h-4 w-4 text-[#98A2B3]" />
                      {dueDate ? format(dueDate, "PPP") : <span className="text-[#98A2B3]">Select a due date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dueDate} onSelect={handleDateChange} disabled={(date) => date < new Date()} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="notes" className="text-[13px] font-bold text-[#374151]">
                Additional Notes <span className="text-[#667085] font-normal">(optional)</span>
              </Label>
              <Textarea
                id="notes"
                placeholder="Add any additional requirements or instructions..."
                value={formData.notes}
                onChange={(e) => onFormDataChange('notes', e.target.value)}
                rows={4}
                className="resize-none border-[#E4E7EC] rounded-[10px] focus:border-[#2F5BEA] pb-8"
              />
              <button className="absolute bottom-3 right-3 text-[#7C3AED] text-[12px] font-semibold flex items-center gap-1.5 hover:underline">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Generate instructions with AI
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: AI Guidance & Summary */}
      <div className="w-full lg:w-[320px] shrink-0 space-y-6">
        
        {/* AI Guidance Panel */}
        <Card className="border border-[#DDD6FE] bg-[#F4EDFF] rounded-[16px] shadow-sm">
          <CardHeader className="pb-3 px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-[15px] font-bold text-[#111827]">
              <span className="text-[#7C3AED] flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                AI Guidance
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <p className="text-[14px] text-[#374151]">
              These selected documents are commonly requested during supplier onboarding.
            </p>
            <p className="text-[14px] text-[#374151]">
              <strong>Recommended priority:</strong> Medium.<br/>
              <strong>Suggested due date:</strong> within 14 days.
            </p>
            
            <div className="space-y-2 mt-4">
              <Button variant="outline" className="w-full justify-start border-[#E9D5FF] bg-white text-[#7C3AED] hover:bg-[#F4EDFF] hover:text-[#6D28D9] h-10 rounded-[10px] font-semibold text-[13px] shadow-sm">
                <Flag className="w-4 h-4 mr-2" /> Recommend Priority
              </Button>
              <Button variant="outline" className="w-full justify-start border-[#E9D5FF] bg-white text-[#7C3AED] hover:bg-[#F4EDFF] hover:text-[#6D28D9] h-10 rounded-[10px] font-semibold text-[13px] shadow-sm">
                <CalendarIcon className="w-4 h-4 mr-2" /> Suggest Due Date
              </Button>
              <Button variant="outline" className="w-full justify-start border-[#E9D5FF] bg-white text-[#7C3AED] hover:bg-[#F4EDFF] hover:text-[#6D28D9] h-10 rounded-[10px] font-semibold text-[13px] shadow-sm">
                <FileText className="w-4 h-4 mr-2" /> Draft Supplier Instructions
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Request Summary Card */}
        <Card className="border-[#E4E7EC] rounded-[16px] shadow-sm">
          <CardHeader className="pb-3 border-b border-[#E4E7EC] px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-[15px] font-bold text-[#111827]">
              <div className="p-1.5 rounded-md bg-[#EEF4FF]">
                <ClipboardCheck className="h-4 w-4 text-[#2F5BEA]" />
              </div>
              Request Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-[#667085]">Documents:</dt>
                <dd className="font-bold text-[#111827]">{selectedDocuments.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#667085]">Suppliers:</dt>
                <dd className="font-bold text-[#111827]">{formData.suppliers.length}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-[#667085]">Priority:</dt>
                <dd className="font-medium text-[#111827] flex items-center gap-1.5">
                  {formData.priority === 'low' && <><span className="h-2 w-2 rounded-full bg-slate-400" />Low</>}
                  {formData.priority === 'medium' && <><span className="h-2 w-2 rounded-full bg-blue-500" />Medium</>}
                  {formData.priority === 'high' && <><span className="h-2 w-2 rounded-full bg-amber-500" />High</>}
                  {formData.priority === 'urgent' && <><span className="h-2 w-2 rounded-full bg-red-500" />Urgent</>}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#667085]">Due date:</dt>
                <dd className="font-medium text-[#111827]">{dueDate ? format(dueDate, "MMM d, yyyy") : 'Not set'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#667085]">Attachments:</dt>
                <dd className="font-medium text-[#111827]">None</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default RequestConfigurationStep;
