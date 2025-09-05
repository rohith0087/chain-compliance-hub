import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface OnboardingFormCompletionProps {
  request: any;
  formFields: any[];
  onComplete: () => void;
  isCompleted: boolean;
}

interface FormResponse {
  field_id: string;
  response_value: string;
}

export const OnboardingFormCompletion: React.FC<OnboardingFormCompletionProps> = ({
  request,
  formFields,
  onComplete,
  isCompleted
}) => {
  const [responses, setResponses] = useState<{ [key: string]: string }>({});
  const [existingResponses, setExistingResponses] = useState<FormResponse[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchExistingResponses();
  }, [request.id]);

  const fetchExistingResponses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('onboarding_form_responses')
        .select('field_id, response_value')
        .eq('onboarding_request_id', request.id);

      if (error) {
        console.error('Error fetching responses:', error);
        return;
      }

      setExistingResponses(data || []);
      
      // Set existing responses in state
      const responseMap: { [key: string]: string } = {};
      (data || []).forEach(response => {
        responseMap[response.field_id] = response.response_value || '';
      });
      setResponses(responseMap);
    } catch (error) {
      console.error('Error in fetchExistingResponses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (fieldId: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSave = async () => {
    // Check if all required fields are filled
    const requiredFields = formFields.filter(field => field.is_required);
    const missingRequired = requiredFields.filter(field => 
      !responses[field.id] || responses[field.id].trim() === ''
    );

    if (missingRequired.length > 0) {
      toast({
        title: "Error",
        description: `Please fill in all required fields: ${missingRequired.map(f => f.field_label).join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      // Delete existing responses
      if (existingResponses.length > 0) {
        await supabase
          .from('onboarding_form_responses')
          .delete()
          .eq('onboarding_request_id', request.id);
      }

      // Insert new responses
      const responseData = Object.entries(responses)
        .filter(([_, value]) => value.trim() !== '')
        .map(([fieldId, value]) => ({
          onboarding_request_id: request.id,
          field_id: fieldId,
          response_value: value,
          submitted_by: user?.id
        }));

      if (responseData.length > 0) {
        const { error } = await supabase
          .from('onboarding_form_responses')
          .insert(responseData);

        if (error) {
          console.error('Error saving responses:', error);
          throw new Error('Failed to save form responses');
        }
      }

      toast({
        title: "Success",
        description: "Form responses saved successfully"
      });
      onComplete();
    } catch (error) {
      console.error('Error in handleSave:', error);
      toast({
        title: "Error",
        description: "Failed to save form responses",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: any) => {
    const value = responses[field.id] || '';

    switch (field.field_type) {
      case 'text':
        return (
          <Input
            value={value}
            onChange={(e) => handleResponseChange(field.id, e.target.value)}
            disabled={isCompleted}
          />
        );
      
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleResponseChange(field.id, e.target.value)}
            disabled={isCompleted}
            rows={4}
          />
        );
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleResponseChange(field.id, e.target.value)}
            disabled={isCompleted}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">Select an option</option>
            {field.field_options?.map((option: string, index: number) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={value === 'true'}
              onCheckedChange={(checked) => 
                handleResponseChange(field.id, checked ? 'true' : 'false')
              }
              disabled={isCompleted}
            />
            <Label htmlFor={field.id} className="text-sm">
              {field.field_description || 'Check this box'}
            </Label>
          </div>
        );
      
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleResponseChange(field.id, e.target.value)}
            disabled={isCompleted}
          />
        );
      
      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleResponseChange(field.id, e.target.value)}
            disabled={isCompleted}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="text-muted-foreground">Loading form fields...</div>
      </div>
    );
  }

  if (formFields.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="text-muted-foreground">No form fields to complete</div>
      </div>
    );
  }

  const requiredFields = formFields.filter(field => field.is_required);
  const completedRequired = requiredFields.filter(field => 
    responses[field.id] && responses[field.id].trim() !== ''
  );
  const allRequiredCompleted = completedRequired.length === requiredFields.length;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Please fill out the following information. Required fields are marked with an asterisk (*).
      </div>

      {requiredFields.length > 0 && (
        <div className="text-sm">
          <span className="font-medium">Progress: </span>
          {completedRequired.length} of {requiredFields.length} required fields completed
        </div>
      )}

      <div className="space-y-4">
        {formFields.map((field) => (
          <Card key={field.id}>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Label htmlFor={field.id} className="flex items-center gap-1">
                  {field.field_label}
                  {field.is_required && <span className="text-red-500">*</span>}
                </Label>
                {field.field_description && (
                  <p className="text-sm text-muted-foreground">
                    {field.field_description}
                  </p>
                )}
                {renderField(field)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isCompleted && (
        <div className="flex items-center gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving || !allRequiredCompleted}
          >
            {saving ? 'Saving...' : 'Save Responses'}
          </Button>
          {!allRequiredCompleted && (
            <span className="text-sm text-red-600">
              Please complete all required fields
            </span>
          )}
        </div>
      )}

      {isCompleted && (
        <div className="flex items-center gap-2 text-green-600 pt-4">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">Form completion finished</span>
        </div>
      )}
    </div>
  );
};