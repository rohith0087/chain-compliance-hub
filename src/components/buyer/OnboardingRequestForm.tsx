import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Upload, X } from 'lucide-react';
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
  const [formData, setFormData] = useState({
    supplier_email: '',
    supplier_company_name: '',
    can_choose_branches: false,
    custom_message: ''
  });
  const [documentRequirements, setDocumentRequirements] = useState<DocumentRequirement[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(false);
  const { createOnboardingRequest, addDocumentRequirement: addDocReq, addFormField: addFormFieldReq } = useOnboardingRequests();
  const { toast } = useToast();

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
      // Create the onboarding request
      const request = await createOnboardingRequest(
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

      toast({
        title: "Success",
        description: "Onboarding request created successfully"
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
              />
              <Label htmlFor="can_choose_branches">Allow supplier to choose branches</Label>
            </div>
          </CardContent>
        </Card>

        {/* Document Requirements */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Document Requirements</CardTitle>
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
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {documentRequirements.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No document requirements added yet
              </p>
            ) : (
              documentRequirements.map((req, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Document Requirement {index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDocumentRequirement(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Document Type</Label>
                      <Input
                        value={req.document_type}
                        onChange={(e) => updateDocumentRequirement(index, 'document_type', e.target.value)}
                        placeholder="e.g., Certificate, License"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Document Name</Label>
                      <Input
                        value={req.document_name}
                        onChange={(e) => updateDocumentRequirement(index, 'document_name', e.target.value)}
                        placeholder="e.g., Business License"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={req.description}
                      onChange={(e) => updateDocumentRequirement(index, 'description', e.target.value)}
                      placeholder="Describe what this document should contain..."
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={req.is_required}
                      onCheckedChange={(checked) => updateDocumentRequirement(index, 'is_required', checked)}
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
              <CardTitle>Custom Form Fields</CardTitle>
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
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formFields.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No custom form fields added yet
              </p>
            ) : (
              formFields.map((field, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Form Field {index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFormField(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Field Type</Label>
                      <select
                        className="w-full px-3 py-2 border rounded-md"
                        value={field.field_type}
                        onChange={(e) => updateFormField(index, 'field_type', e.target.value as FormField['field_type'])}
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
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={field.field_description}
                      onChange={(e) => updateFormField(index, 'field_description', e.target.value)}
                      placeholder="Field description"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={field.is_required}
                      onCheckedChange={(checked) => updateFormField(index, 'is_required', checked)}
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
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Onboarding Request'}
          </Button>
          <Button type="button" variant="outline" onClick={onBack}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};