import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Copy,
  Send,
  FileText,
  Loader2,
  GripVertical
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DraftRequirementsEditorProps {
  requestId: string;
  buyerId: string;
  onSendToSupplier: () => void;
  onCancel: () => void;
}

interface DocumentRequirement {
  id?: string;
  document_name: string;
  document_type: string;
  description: string;
  is_required: boolean;
  display_order?: number;
  template_file_path?: string;
  template_file_name?: string;
}

const DOCUMENT_TYPES = [
  'certificate',
  'license',
  'insurance',
  'audit_report',
  'policy',
  'registration',
  'compliance',
  'financial',
  'quality',
  'safety',
  'environmental',
  'other'
];

export const DraftRequirementsEditor = ({
  requestId,
  buyerId,
  onSendToSupplier,
  onCancel
}: DraftRequirementsEditorProps) => {
  const { toast } = useToast();
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasDefaults, setHasDefaults] = useState(false);

  useEffect(() => {
    loadExistingRequirements();
    checkForDefaults();
  }, [requestId, buyerId]);

  const loadExistingRequirements = async () => {
    try {
      const { data, error } = await supabase
        .from('onboarding_document_requirements')
        .select('*')
        .eq('onboarding_request_id', requestId)
        .order('display_order');

      if (error) throw error;
      setRequirements(data || []);
    } catch (error) {
      console.error('Error loading requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkForDefaults = async () => {
    const { count } = await supabase
      .from('default_document_requirements')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_id', buyerId);
    
    setHasDefaults((count || 0) > 0);
  };

  const handleCopyFromDefaults = async () => {
    try {
      setSaving(true);
      
      // Call the edge function to populate from defaults
      const { data, error } = await supabase.functions.invoke('populate-onboarding-requirements', {
        body: { onboarding_request_id: requestId }
      });

      if (error) throw error;

      toast({
        title: 'Defaults Copied',
        description: `Added ${data?.documents_added || 0} documents and ${data?.fields_added || 0} form fields`
      });

      await loadExistingRequirements();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to copy defaults',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const addRequirement = () => {
    const newReq: DocumentRequirement = {
      document_name: '',
      document_type: 'certificate',
      description: '',
      is_required: true,
      display_order: requirements.length + 1
    };
    setRequirements([...requirements, newReq]);
  };

  const updateRequirement = (index: number, updates: Partial<DocumentRequirement>) => {
    const updated = [...requirements];
    updated[index] = { ...updated[index], ...updates };
    setRequirements(updated);
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const saveRequirements = async () => {
    // Validate
    const invalid = requirements.some(r => !r.document_name.trim());
    if (invalid) {
      toast({
        title: 'Validation Error',
        description: 'All documents must have a name',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);

      // Delete existing requirements
      await supabase
        .from('onboarding_document_requirements')
        .delete()
        .eq('onboarding_request_id', requestId);

      // Insert new requirements
      if (requirements.length > 0) {
        const toInsert = requirements.map((req, index) => ({
          onboarding_request_id: requestId,
          document_name: req.document_name,
          document_type: req.document_type,
          description: req.description,
          is_required: req.is_required,
          display_order: index + 1,
          template_file_path: req.template_file_path,
          template_file_name: req.template_file_name
        }));

        const { error } = await supabase
          .from('onboarding_document_requirements')
          .insert(toInsert);

        if (error) throw error;
      }

      toast({ title: 'Saved', description: 'Requirements saved successfully' });
    } catch (error: any) {
      console.error('Error saving requirements:', error);
      toast({
        title: 'Error',
        description: 'Failed to save requirements',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendToSupplier = async () => {
    if (requirements.length === 0) {
      toast({
        title: 'No Requirements',
        description: 'Please add at least one document requirement before sending',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);

      // Save requirements first
      await saveRequirements();

      // Update status to pending (activates the onboarding)
      const { error } = await supabase
        .from('supplier_onboarding_requests')
        .update({ status: 'pending' })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: 'Sent to Supplier',
        description: 'The onboarding request has been activated and sent to the supplier'
      });

      onSendToSupplier();
    } catch (error: any) {
      console.error('Error sending to supplier:', error);
      toast({
        title: 'Error',
        description: 'Failed to send to supplier',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Configure Requirements</h3>
          <p className="text-sm text-muted-foreground">
            Add documents you need from this supplier
          </p>
        </div>
        
        {hasDefaults && requirements.length === 0 && (
          <Button
            variant="outline"
            onClick={handleCopyFromDefaults}
            disabled={saving}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy from Defaults
          </Button>
        )}
      </div>

      <Separator />

      {/* Requirements List */}
      <ScrollArea className="max-h-[400px]">
        <div className="space-y-3 pr-4">
          {requirements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No requirements added yet</p>
              <p className="text-xs mt-1">
                {hasDefaults 
                  ? 'Copy from your defaults or add custom documents'
                  : 'Add documents you need from this supplier'
                }
              </p>
            </div>
          ) : (
            requirements.map((req, index) => (
              <div
                key={req.id || index}
                className="p-4 rounded-lg border bg-card space-y-3"
              >
                <div className="flex items-start gap-3">
                  <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-grab" />
                  
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Document Name *</Label>
                        <Input
                          placeholder="e.g., ISO 9001 Certificate"
                          value={req.document_name}
                          onChange={(e) => updateRequirement(index, { document_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={req.document_type}
                          onValueChange={(value) => updateRequirement(index, { document_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPES.map(type => (
                              <SelectItem key={type} value={type}>
                                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Description (optional)</Label>
                      <Input
                        placeholder="Additional instructions or requirements"
                        value={req.description}
                        onChange={(e) => updateRequirement(index, { description: e.target.value })}
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`required-${index}`}
                          checked={req.is_required}
                          onCheckedChange={(checked) => updateRequirement(index, { is_required: !!checked })}
                        />
                        <Label htmlFor={`required-${index}`} className="text-sm cursor-pointer">
                          Required
                        </Label>
                      </div>
                      
                      {req.template_file_name && (
                        <Badge variant="secondary" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          {req.template_file_name}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRequirement(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Add Button */}
      <Button
        variant="outline"
        onClick={addRequirement}
        className="w-full gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Document Requirement
      </Button>

      <Separator />

      {/* Footer Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        
        <Button
          variant="outline"
          onClick={saveRequirements}
          disabled={saving || requirements.length === 0}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Draft
        </Button>
        
        <Button
          onClick={handleSendToSupplier}
          disabled={saving || requirements.length === 0}
          className="flex-1 gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Send className="h-4 w-4" />
          Send to Supplier
        </Button>
      </div>
    </div>
  );
};
