import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, X, Settings, Zap, Users, Loader2 } from 'lucide-react';
import { useOnboardingRequests } from '@/hooks/useOnboardingRequests';
import { useConnectedSuppliersWithOnboarding } from '@/hooks/useConnectedSuppliersWithOnboarding';
import { useToast } from '@/hooks/use-toast';

interface OnboardingRequestFormProps {
  buyerId: string;
  onBack: () => void;
  onSuccess: () => void;
  embedded?: boolean; // When true, hides the header/back button for use in Sheet
}

interface DocumentRequirement {
  document_type: string;
  document_name: string;
  description: string;
  is_required: boolean;
}

interface FormField {
  field_type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date';
  field_label: string;
  field_description: string;
  is_required: boolean;
  field_options?: string[];
}

export const OnboardingRequestForm: React.FC<OnboardingRequestFormProps> = ({
  buyerId,
  onBack,
  onSuccess,
  embedded = false
}) => {
  const [useDefaults, setUseDefaults] = useState(true);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    can_choose_branches: false,
    custom_message: ''
  });
  const [documentRequirements, setDocumentRequirements] = useState<DocumentRequirement[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  
  const { suppliers, loading: loadingSuppliers } = useConnectedSuppliersWithOnboarding(buyerId);
  const { 
    createOnboardingRequest, 
    createOnboardingRequestFromDefaults,
    loadDefaultSettings,
    addDocumentRequirement: addDocReq, 
    addFormField: addFormFieldReq 
  } = useOnboardingRequests();
  const { toast } = useToast();

  const availableSuppliers = suppliers.filter(s => !s.has_active_onboarding);
  const selectedSuppliers = suppliers.filter(s => selectedSupplierIds.includes(s.id));

  useEffect(() => {
    if (buyerId) {
      loadDefaults();
    }
  }, [buyerId]);

  // Check for pre-selected supplier from notification click
  useEffect(() => {
    const preselectConnectionId = sessionStorage.getItem('preselect_onboarding_supplier_connection_id');
    if (preselectConnectionId && suppliers.length > 0 && !loadingSuppliers) {
      // Find the supplier by connection_id
      const supplier = suppliers.find(s => s.connection_id === preselectConnectionId);
      if (supplier && !selectedSupplierIds.includes(supplier.id)) {
        setSelectedSupplierIds([supplier.id]);
      }
      // Clear the sessionStorage after use
      sessionStorage.removeItem('preselect_onboarding_supplier_connection_id');
    }
  }, [suppliers, loadingSuppliers]);

  const loadDefaults = async () => {
    setLoadingDefaults(true);
    try {
      const defaults = await loadDefaultSettings(buyerId);
      
      if (defaults.settings) {
        setFormData(prev => ({
          ...prev,
          can_choose_branches: defaults.settings.allow_branch_selection,
          custom_message: defaults.settings.default_welcome_message || ''
        }));
      }

      if (defaults.documentRequirements.length > 0) {
        setDocumentRequirements(defaults.documentRequirements.map(doc => ({
          document_type: doc.document_type,
          document_name: doc.document_name,
          description: doc.description || '',
          is_required: doc.is_required,
        })));
      }

      if (defaults.formFields.length > 0) {
        setFormFields(defaults.formFields.map(field => ({
          field_type: field.field_type,
          field_label: field.field_label,
          field_description: field.field_description || '',
          is_required: field.is_required,
          field_options: Array.isArray(field.field_options) 
            ? field.field_options.map(opt => String(opt))
            : field.field_options ? [String(field.field_options)] : undefined,
        })));
      }

      setDefaultsLoaded(true);
    } catch (error) {
      console.error('Error loading defaults:', error);
      setDefaultsLoaded(true);
    } finally {
      setLoadingDefaults(false);
    }
  };

  const handleSupplierSelect = (supplierId: string) => {
    if (!selectedSupplierIds.includes(supplierId)) {
      setSelectedSupplierIds([...selectedSupplierIds, supplierId]);
    }
  };

  const removeSupplier = (supplierId: string) => {
    setSelectedSupplierIds(selectedSupplierIds.filter(id => id !== supplierId));
  };

  const clearDefaults = () => {
    setFormData({ can_choose_branches: false, custom_message: '' });
    setDocumentRequirements([]);
    setFormFields([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedSupplierIds.length === 0) {
      toast({ title: "Error", description: "Please select at least one supplier", variant: "destructive" });
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const supplierId of selectedSupplierIds) {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (!supplier) continue;

        try {
          if (useDefaults) {
            await createOnboardingRequestFromDefaults(
              buyerId, supplier.contact_email, supplier.company_name, formData.custom_message, supplierId
            );
          } else {
            const request = await createOnboardingRequest(
              buyerId, supplier.contact_email, supplier.company_name, formData.can_choose_branches, formData.custom_message, supplierId
            );

            for (const docReq of documentRequirements) {
              await addDocReq(request.id, docReq.document_type, docReq.document_name, docReq.description, docReq.is_required);
            }

            for (let i = 0; i < formFields.length; i++) {
              const field = formFields[i];
              await addFormFieldReq(request.id, field.field_type, field.field_label, field.field_description, field.field_options, field.is_required, i);
            }
          }
          successCount++;
        } catch (error) {
          failureCount++;
        }
      }

      if (successCount > 0) {
        toast({ title: "Success", description: `Created ${successCount} request(s)${failureCount > 0 ? `, ${failureCount} failed` : ''}` });
        onSuccess();
      } else {
        toast({ title: "Error", description: "Failed to create requests", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const addDocumentRequirementLocal = () => {
    setDocumentRequirements([...documentRequirements, { document_type: '', document_name: '', description: '', is_required: true }]);
  };

  const removeDocumentRequirement = (index: number) => {
    setDocumentRequirements(documentRequirements.filter((_, i) => i !== index));
  };

  const updateDocumentRequirement = (index: number, field: keyof DocumentRequirement, value: any) => {
    const updated = [...documentRequirements];
    updated[index] = { ...updated[index], [field]: value };
    setDocumentRequirements(updated);
  };

  const addFormFieldLocal = () => {
    setFormFields([...formFields, { field_type: 'text', field_label: '', field_description: '', is_required: false }]);
  };

  const removeFormField = (index: number) => {
    setFormFields(formFields.filter((_, i) => i !== index));
  };

  const updateFormField = (index: number, field: keyof FormField, value: any) => {
    const updated = [...formFields];
    updated[index] = { ...updated[index], [field]: value };
    setFormFields(updated);
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
          <div>
            <h2 className="text-2xl font-semibold">Create Onboarding Request</h2>
            <p className="text-muted-foreground">Select suppliers and create bulk onboarding requests</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {!loadingDefaults && defaultsLoaded && (
          <Card>
            <CardHeader><CardTitle>Creation Mode</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Use Default Settings</Label>
                    {useDefaults && <Badge variant="secondary"><Zap className="h-3 w-3 mr-1" />Quick Setup</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {useDefaults ? "Use pre-configured settings" : "Customize settings manually"}
                  </div>
                </div>
                <Switch checked={useDefaults} onCheckedChange={(checked) => { setUseDefaults(checked); checked ? loadDefaults() : clearDefaults(); }} />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Select Suppliers</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {loadingSuppliers ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : availableSuppliers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No available suppliers</p>
                <p className="text-sm">Connect suppliers first or check existing onboarding requests.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Connected Suppliers</Label>
                  <Select onValueChange={handleSupplierSelect}>
                    <SelectTrigger><SelectValue placeholder="Choose suppliers..." /></SelectTrigger>
                    <SelectContent>
                      {availableSuppliers.map(supplier => (
                        <SelectItem key={supplier.id} value={supplier.id} disabled={selectedSupplierIds.includes(supplier.id)}>
                          {supplier.company_name} {supplier.contact_email && `(${supplier.contact_email})`}
                        </SelectItem>
                      ))
                      }
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Select multiple suppliers to create bulk requests</p>
                </div>

                {selectedSuppliers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected ({selectedSuppliers.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedSuppliers.map(supplier => (
                        <Badge key={supplier.id} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                          {supplier.company_name}
                          <button type="button" onClick={() => removeSupplier(supplier.id)} className="ml-1 hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))
                      }
                    </div>
                  </div>
                )}
              </>
            )}

            <Separator />
            <div className="space-y-2">
              <Label>Custom Message</Label>
              <Textarea placeholder="Add a message for suppliers..." value={formData.custom_message} onChange={(e) => setFormData({ ...formData, custom_message: e.target.value })} rows={3} />
            </div>
            
            {!useDefaults && (
              <div className="flex items-center space-x-2">
                <Switch id="branches" checked={formData.can_choose_branches} onCheckedChange={(checked) => setFormData({ ...formData, can_choose_branches: checked })} />
                <Label htmlFor="branches">Allow supplier to choose branches</Label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Requirements */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Document Requirements</CardTitle>
                {useDefaults && documentRequirements.length > 0 && (
                  <Badge variant="secondary">{documentRequirements.length} from defaults</Badge>
                )}
              </div>
              {!useDefaults && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDocumentRequirementLocal}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Document
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {useDefaults && documentRequirements.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No default document requirements configured
              </p>
            ) : !useDefaults && documentRequirements.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No document requirements added yet
              </p>
            ) : (
              documentRequirements.map((req, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4 relative">
                  {useDefaults && (
                    <Badge variant="outline" className="absolute top-2 right-2 text-xs">
                      Default
                    </Badge>
                  )}
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Document Requirement {index + 1}</h4>
                    {!useDefaults && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDocumentRequirement(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Document Type</Label>
                      <Input
                        value={req.document_type}
                        onChange={(e) => updateDocumentRequirement(index, 'document_type', e.target.value)}
                        placeholder="e.g., Certificate, License"
                        disabled={useDefaults}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Document Name</Label>
                      <Input
                        value={req.document_name}
                        onChange={(e) => updateDocumentRequirement(index, 'document_name', e.target.value)}
                        placeholder="e.g., Business License"
                        disabled={useDefaults}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={req.description}
                      onChange={(e) => updateDocumentRequirement(index, 'description', e.target.value)}
                      placeholder="Describe what this document should contain..."
                      disabled={useDefaults}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={req.is_required}
                      onCheckedChange={(checked) => updateDocumentRequirement(index, 'is_required', checked)}
                      disabled={useDefaults}
                    />
                    <Label>Required document</Label>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Custom Form Fields */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Custom Form Fields</CardTitle>
                {useDefaults && formFields.length > 0 && (
                  <Badge variant="secondary">{formFields.length} from defaults</Badge>
                )}
              </div>
              {!useDefaults && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFormFieldLocal}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Field
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {useDefaults && formFields.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No default form fields configured
              </p>
            ) : !useDefaults && formFields.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No custom form fields added yet
              </p>
            ) : (
              formFields.map((field, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4 relative">
                  {useDefaults && (
                    <Badge variant="outline" className="absolute top-2 right-2 text-xs">
                      Default
                    </Badge>
                  )}
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Custom Field {index + 1}</h4>
                    {!useDefaults && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFormField(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Field Type</Label>
                    <Select
                      value={field.field_type}
                      onValueChange={(value) => updateFormField(index, 'field_type', value)}
                      disabled={useDefaults}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="textarea">Textarea</SelectItem>
                        <SelectItem value="select">Select</SelectItem>
                        <SelectItem value="checkbox">Checkbox</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Field Label</Label>
                    <Input
                      value={field.field_label}
                      onChange={(e) => updateFormField(index, 'field_label', e.target.value)}
                      placeholder="e.g., Company Size"
                      disabled={useDefaults}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={field.field_description}
                      onChange={(e) => updateFormField(index, 'field_description', e.target.value)}
                      placeholder="Describe the purpose of this field..."
                      disabled={useDefaults}
                    />
                  </div>
                  {field.field_type === 'select' && (
                    <div className="space-y-2">
                      <Label>Field Options (comma-separated)</Label>
                      <Input
                        value={field.field_options ? field.field_options.join(',') : ''}
                        onChange={(e) => updateFormField(index, 'field_options', e.target.value.split(','))}
                        placeholder="e.g., Small, Medium, Large"
                        disabled={useDefaults}
                      />
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={field.is_required}
                      onCheckedChange={(checked) => updateFormField(index, 'is_required', checked)}
                      disabled={useDefaults}
                    />
                    <Label>Required field</Label>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onBack} disabled={loading}>Cancel</Button>
          <Button type="submit" disabled={loading || selectedSupplierIds.length === 0}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : `Create (${selectedSupplierIds.length}) Request${selectedSupplierIds.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </form>
    </div>
  );
};
