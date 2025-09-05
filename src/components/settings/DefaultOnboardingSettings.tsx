import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Plus, X, GripVertical } from 'lucide-react';
import { SafeSelect, SafeSelectItem } from '@/components/ui/SafeSelect';
import { useBuyerDefaultSettings, DefaultDocumentRequirement, DefaultFormField } from '@/hooks/useBuyerDefaultSettings';

const DOCUMENT_TYPES = [
  'Business License',
  'Insurance Certificate',
  'Tax Certificate',
  'Safety Certificate',
  'Quality Certificate',
  'Financial Statement',
  'Certificate of Incorporation',
  'Other'
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
];

export const DefaultOnboardingSettings: React.FC = () => {
  const {
    settings,
    documentRequirements,
    formFields,
    loading,
    saveSettings,
    saveDocumentRequirements,
    saveFormFields,
  } = useBuyerDefaultSettings();

  const [localSettings, setLocalSettings] = useState({
    allow_branch_selection: true,
    require_branch_selection: false,
    auto_approve_standard_docs: false,
    require_all_documents: true,
    expires_days: 7,
    default_welcome_message: 'Welcome! Please complete your supplier onboarding by providing the required documents and information.',
  });

  const [localDocRequirements, setLocalDocRequirements] = useState<Omit<DefaultDocumentRequirement, 'id'>[]>([]);
  const [localFormFields, setLocalFormFields] = useState<Omit<DefaultFormField, 'id'>[]>([]);

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        allow_branch_selection: settings.allow_branch_selection,
        require_branch_selection: settings.require_branch_selection,
        auto_approve_standard_docs: settings.auto_approve_standard_docs,
        require_all_documents: settings.require_all_documents,
        expires_days: settings.expires_days,
        default_welcome_message: settings.default_welcome_message,
      });
    }
  }, [settings]);

  useEffect(() => {
    setLocalDocRequirements(
      documentRequirements.map(({ id, ...req }) => req)
    );
  }, [documentRequirements]);

  useEffect(() => {
    setLocalFormFields(
      formFields.map(({ id, ...field }) => field)
    );
  }, [formFields]);

  const handleSaveSettings = () => {
    saveSettings(localSettings);
  };

  const addDocumentRequirement = () => {
    setLocalDocRequirements(prev => [
      ...prev,
      {
        document_type: 'Business License',
        document_name: 'Business License',
        description: '',
        is_required: true,
        display_order: prev.length,
      }
    ]);
  };

  const removeDocumentRequirement = (index: number) => {
    setLocalDocRequirements(prev => prev.filter((_, i) => i !== index));
  };

  const updateDocumentRequirement = (index: number, updates: Partial<DefaultDocumentRequirement>) => {
    setLocalDocRequirements(prev => prev.map((req, i) => 
      i === index ? { ...req, ...updates } : req
    ));
  };

  const addFormField = () => {
    setLocalFormFields(prev => [
      ...prev,
      {
        field_type: 'text',
        field_label: 'New Field',
        field_description: '',
        is_required: false,
        field_order: prev.length,
      }
    ]);
  };

  const removeFormField = (index: number) => {
    setLocalFormFields(prev => prev.filter((_, i) => i !== index));
  };

  const updateFormField = (index: number, updates: Partial<DefaultFormField>) => {
    setLocalFormFields(prev => prev.map((field, i) => 
      i === index ? { ...field, ...updates } : field
    ));
  };

  const handleSaveDocuments = () => {
    saveDocumentRequirements(localDocRequirements);
  };

  const handleSaveFormFields = () => {
    saveFormFields(localFormFields);
  };

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Allow Branch Selection</Label>
              <div className="text-sm text-muted-foreground">
                Let suppliers choose which branches to connect with
              </div>
            </div>
            <Switch
              checked={localSettings.allow_branch_selection}
              onCheckedChange={(checked) => 
                setLocalSettings(prev => ({ ...prev, allow_branch_selection: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Require Branch Selection</Label>
              <div className="text-sm text-muted-foreground">
                Suppliers must select at least one branch to proceed
              </div>
            </div>
            <Switch
              checked={localSettings.require_branch_selection}
              onCheckedChange={(checked) => 
                setLocalSettings(prev => ({ ...prev, require_branch_selection: checked }))
              }
              disabled={!localSettings.allow_branch_selection}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Auto-approve Standard Documents</Label>
              <div className="text-sm text-muted-foreground">
                Automatically approve documents that meet validation criteria
              </div>
            </div>
            <Switch
              checked={localSettings.auto_approve_standard_docs}
              onCheckedChange={(checked) => 
                setLocalSettings(prev => ({ ...prev, auto_approve_standard_docs: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Require All Documents</Label>
              <div className="text-sm text-muted-foreground">
                All document requirements must be fulfilled to complete onboarding
              </div>
            </div>
            <Switch
              checked={localSettings.require_all_documents}
              onCheckedChange={(checked) => 
                setLocalSettings(prev => ({ ...prev, require_all_documents: checked }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires-days">Default Expiration (Days)</Label>
            <Input
              id="expires-days"
              type="number"
              min="1"
              max="365"
              value={localSettings.expires_days}
              onChange={(e) => 
                setLocalSettings(prev => ({ ...prev, expires_days: parseInt(e.target.value) || 7 }))
              }
              className="w-24"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcome-message">Default Welcome Message</Label>
            <Textarea
              id="welcome-message"
              value={localSettings.default_welcome_message}
              onChange={(e) => 
                setLocalSettings(prev => ({ ...prev, default_welcome_message: e.target.value }))
              }
              rows={3}
              placeholder="Enter a welcome message for suppliers..."
            />
          </div>

          <Button onClick={handleSaveSettings} disabled={loading}>
            Save General Settings
          </Button>
        </CardContent>
      </Card>

      {/* Document Requirements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Default Document Requirements</CardTitle>
            <Button onClick={addDocumentRequirement} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {localDocRequirements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No document requirements configured. Add some to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {localDocRequirements.map((req, index) => (
                <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                  <GripVertical className="h-5 w-5 text-muted-foreground mt-2" />
                  
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Document Type</Label>
                        <SafeSelect
                          value={req.document_type}
                          onValueChange={(value) => updateDocumentRequirement(index, { document_type: value })}
                        >
                          {DOCUMENT_TYPES.map(type => (
                            <SafeSelectItem key={type} value={type}>
                              {type}
                            </SafeSelectItem>
                          ))}
                        </SafeSelect>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Document Name</Label>
                        <Input
                          value={req.document_name}
                          onChange={(e) => updateDocumentRequirement(index, { document_name: e.target.value })}
                          placeholder="Enter document name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={req.description || ''}
                        onChange={(e) => updateDocumentRequirement(index, { description: e.target.value })}
                        placeholder="Describe what this document should contain..."
                        rows={2}
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`required-${index}`}
                          checked={req.is_required}
                          onCheckedChange={(checked) => updateDocumentRequirement(index, { is_required: checked })}
                        />
                        <Label htmlFor={`required-${index}`}>Required</Label>
                      </div>
                      {req.is_required && (
                        <Badge variant="secondary">Required</Badge>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeDocumentRequirement(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />
          <Button onClick={handleSaveDocuments} disabled={loading}>
            Save Document Requirements
          </Button>
        </CardContent>
      </Card>

      {/* Form Fields */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Default Form Fields</CardTitle>
            <Button onClick={addFormField} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {localFormFields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No form fields configured. Add some to collect additional information.
            </div>
          ) : (
            <div className="space-y-3">
              {localFormFields.map((field, index) => (
                <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                  <GripVertical className="h-5 w-5 text-muted-foreground mt-2" />
                  
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Field Type</Label>
                        <SafeSelect
                          value={field.field_type}
                          onValueChange={(value: any) => updateFormField(index, { field_type: value })}
                        >
                          {FIELD_TYPES.map(type => (
                            <SafeSelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SafeSelectItem>
                          ))}
                        </SafeSelect>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Field Label</Label>
                        <Input
                          value={field.field_label}
                          onChange={(e) => updateFormField(index, { field_label: e.target.value })}
                          placeholder="Enter field label"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={field.field_description || ''}
                        onChange={(e) => updateFormField(index, { field_description: e.target.value })}
                        placeholder="Help text for this field..."
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`field-required-${index}`}
                        checked={field.is_required}
                        onCheckedChange={(checked) => updateFormField(index, { is_required: checked })}
                      />
                      <Label htmlFor={`field-required-${index}`}>Required</Label>
                      {field.is_required && (
                        <Badge variant="secondary">Required</Badge>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeFormField(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />
          <Button onClick={handleSaveFormFields} disabled={loading}>
            Save Form Fields
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};