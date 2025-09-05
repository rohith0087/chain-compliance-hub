import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Upload, X, Settings, Zap } from 'lucide-react';
import { useOnboardingRequests } from '@/hooks/useOnboardingRequests';
import { useToast } from '@/hooks/use-toast';

interface OnboardingRequestFormProps {
  buyerId: string;
  onBack: () => void;
  onSuccess: () => void;
}

interface DocumentRequirement {
  document_type: string;
  document_name: string;
  description: string;
  is_required: boolean;
  template_file?: File;
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
  onSuccess
}) => {
  const [useDefaults, setUseDefaults] = useState(true);
  const [formData, setFormData] = useState({
    supplier_email: '',
    supplier_company_name: '',
    can_choose_branches: false,
    custom_message: ''
  });
  const [documentRequirements, setDocumentRequirements] = useState<DocumentRequirement[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const { 
    createOnboardingRequest, 
    createOnboardingRequestFromDefaults,
    loadDefaultSettings,
    addDocumentRequirement: addDocReq, 
    addFormField: addFormFieldReq 
  } = useOnboardingRequests();
  const { toast } = useToast();

  // Load default settings on mount
  useEffect(() => {
    if (buyerId) {
      loadDefaults();
    }
  }, [buyerId]);

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
      // Continue without defaults
      setDefaultsLoaded(true);
    } finally {
      setLoadingDefaults(false);
    }
  };

  const clearDefaults = () => {
    setFormData({
      supplier_email: formData.supplier_email,
      supplier_company_name: formData.supplier_company_name,
      can_choose_branches: false,
      custom_message: ''
    });
    setDocumentRequirements([]);
    setFormFields([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier_email) {
      toast({
        title: "Error",
        description: "Supplier email is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      let request;
      
      if (useDefaults) {
        // Use streamlined creation with defaults
        request = await createOnboardingRequestFromDefaults(
          buyerId,
          formData.supplier_email,
          formData.supplier_company_name,
          formData.custom_message
        );
      } else {
        // Create with custom settings
        request = await createOnboardingRequest(
          buyerId,
          formData.supplier_email,
          formData.supplier_company_name,
          formData.can_choose_branches,
          formData.custom_message
        );

        // Add document requirements
        for (const docReq of documentRequirements) {
          await addDocReq(
            request.id,
            docReq.document_type,
            docReq.document_name,
            docReq.description,
            docReq.is_required
          );
        }

        // Add form fields
        for (let i = 0; i < formFields.length; i++) {
          const field = formFields[i];
          await addFormFieldReq(
            request.id,
            field.field_type,
            field.field_label,
            field.field_description,
            field.field_options,
            field.is_required,
            i
          );
        }
      }

      toast({
        title: "Success",
        description: useDefaults 
          ? "Onboarding request created with default settings" 
          : "Custom onboarding request created successfully"
      });
      onSuccess();
    } catch (error) {
      console.error('Error creating onboarding request:', error);
      toast({
        title: "Error",
        description: "Failed to create onboarding request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addDocumentRequirementLocal = () => {
    setDocumentRequirements([...documentRequirements, {
      document_type: '',
      document_name: '',
      description: '',
      is_required: true
    }]);
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
    setFormFields([...formFields, {
      field_type: 'text',
      field_label: '',
      field_description: '',
      is_required: false
    }]);
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-semibold">Create Onboarding Request</h2>
          <p className="text-muted-foreground">Set up a new supplier onboarding process</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Use Defaults Toggle */}
        {!loadingDefaults && defaultsLoaded && (
          <Card>
            <CardHeader>
              <CardTitle>Creation Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Use Default Settings</Label>
                    {useDefaults && <Badge variant="secondary" className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Quick Setup
                    </Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {useDefaults 
                      ? "Use your pre-configured default onboarding settings for faster setup" 
                      : "Customize all settings manually for this specific request"
                    }
                  </div>
                </div>
                <Switch
                  checked={useDefaults}
                  onCheckedChange={(checked) => {
                    setUseDefaults(checked);
                    if (!checked) {
                      clearDefaults();
                    } else {
                      loadDefaults();
                    }
                  }}
                />
              </div>
              {!useDefaults && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Settings className="h-4 w-4" />
                  Configure all settings below manually
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_email">Supplier Email *</Label>
                <Input
                  id="supplier_email"
                  type="email"
                  value={formData.supplier_email}
                  onChange={(e) => setFormData({ ...formData, supplier_email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier_company_name">Company Name</Label>
                <Input
                  id="supplier_company_name"
                  value={formData.supplier_company_name}
                  onChange={(e) => setFormData({ ...formData, supplier_company_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom_message">Custom Message</Label>
              <Textarea
                id="custom_message"
                placeholder="Add a personal message for the supplier..."
                value={formData.custom_message}
                onChange={(e) => setFormData({ ...formData, custom_message: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="can_choose_branches"
                checked={formData.can_choose_branches}
                onCheckedChange={(checked) => setFormData({ ...formData, can_choose_branches: checked })}
                disabled={useDefaults}
              />
              <Label htmlFor="can_choose_branches">Allow supplier to choose branches</Label>
              {useDefaults && (
                <Badge variant="outline" className="text-xs">From defaults</Badge>
              )}
            </div>
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
                    <h4 className="font-medium">Form Field {index + 1}</h4>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Field Type</Label>
                      <select
                        className="w-full px-3 py-2 border rounded-md"
                        value={field.field_type}
                        onChange={(e) => updateFormField(index, 'field_type', e.target.value as FormField['field_type'])}
                        disabled={useDefaults}
                      >
                        <option value="text">Text</option>
                        <option value="textarea">Textarea</option>
                        <option value="select">Select</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="date">Date</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Field Label</Label>
                      <Input
                        value={field.field_label}
                        onChange={(e) => updateFormField(index, 'field_label', e.target.value)}
                        placeholder="Field label"
                        disabled={useDefaults}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={field.field_description}
                      onChange={(e) => updateFormField(index, 'field_description', e.target.value)}
                      placeholder="Field description"
                      disabled={useDefaults}
                    />
                  </div>
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

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={loading || loadingDefaults}>
            {loading ? 'Creating...' : useDefaults ? 'Create with Defaults' : 'Create Custom Request'}
          </Button>
          <Button type="button" variant="outline" onClick={onBack}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};