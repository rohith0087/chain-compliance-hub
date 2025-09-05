import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBuyerDefaultSettings } from './useBuyerDefaultSettings';

export interface OnboardingRequest {
  id: string;
  buyer_id: string;
  supplier_id?: string;
  supplier_email: string;
  supplier_company_name?: string;
  status: string;
  can_choose_branches: boolean;
  custom_message?: string;
  invitation_token: string;
  expires_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  approved_at?: string;
  approved_by?: string;
}

export interface DocumentRequirement {
  id: string;
  onboarding_request_id: string;
  document_type: string;
  document_name: string;
  description?: string;
  is_required: boolean;
  template_file_path?: string;
  template_file_name?: string;
  created_at: string;
}

export interface FormField {
  id: string;
  onboarding_request_id: string;
  field_type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date';
  field_label: string;
  field_description?: string;
  field_options?: any;
  is_required: boolean;
  field_order: number;
  created_at: string;
}

export const useOnboardingRequests = () => {
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchOnboardingRequests();
    }
  }, [user]);

  const fetchOnboardingRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('supplier_onboarding_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching onboarding requests:', error);
        setError('Failed to load onboarding requests');
        return;
      }

      setRequests(data || []);
    } catch (err) {
      console.error('Error in fetchOnboardingRequests:', err);
      setError('Failed to load onboarding requests');
    } finally {
      setLoading(false);
    }
  };

  const createOnboardingRequestFromDefaults = async (
    buyerId: string,
    supplierEmail: string,
    supplierCompanyName: string,
    customMessage?: string
  ) => {
    try {
      // Get buyer's default settings
      const { data: defaultSettings } = await supabase
        .from('buyer_default_onboarding_settings')
        .select('*')
        .eq('buyer_id', buyerId)
        .maybeSingle();

      const { data: defaultDocs } = await supabase
        .from('default_document_requirements')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('display_order');

      const { data: defaultFields } = await supabase
        .from('default_form_fields')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('field_order');

      // Use defaults or fallback values
      const canChooseBranches = defaultSettings?.allow_branch_selection ?? false;
      const finalMessage = customMessage || defaultSettings?.default_welcome_message || '';

      // Create the request
      const request = await createOnboardingRequest(
        buyerId,
        supplierEmail,
        supplierCompanyName,
        canChooseBranches,
        finalMessage
      );

      // Add default document requirements
      if (defaultDocs && defaultDocs.length > 0) {
        for (const doc of defaultDocs) {
          await addDocumentRequirement(
            request.id,
            doc.document_type,
            doc.document_name,
            doc.description,
            doc.is_required,
            doc.template_file_path,
            doc.template_file_name
          );
        }
      }

      // Add default form fields
      if (defaultFields && defaultFields.length > 0) {
        for (const field of defaultFields) {
          await addFormField(
            request.id,
            field.field_type as FormField['field_type'],
            field.field_label,
            field.field_description,
            field.field_options,
            field.is_required,
            field.field_order
          );
        }
      }

      return request;
    } catch (err) {
      console.error('Error in createOnboardingRequestFromDefaults:', err);
      throw err;
    }
  };

  const loadDefaultSettings = async (buyerId: string) => {
    try {
      const { data: settings } = await supabase
        .from('buyer_default_onboarding_settings')
        .select('*')
        .eq('buyer_id', buyerId)
        .maybeSingle();

      const { data: docs } = await supabase
        .from('default_document_requirements')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('display_order');

      const { data: fields } = await supabase
        .from('default_form_fields')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('field_order');

      return {
        settings,
        documentRequirements: docs || [],
        formFields: (fields || []).map(field => ({
          ...field,
          field_type: field.field_type as FormField['field_type']
        }))
      };
    } catch (err) {
      console.error('Error loading default settings:', err);
      throw err;
    }
  };

  const createOnboardingRequest = async (
    buyerId: string,
    supplierEmail: string,
    supplierCompanyName: string,
    canChooseBranches: boolean,
    customMessage?: string
  ) => {
    try {
      const { data, error } = await supabase
        .from('supplier_onboarding_requests')
        .insert({
          buyer_id: buyerId,
          supplier_email: supplierEmail,
          supplier_company_name: supplierCompanyName,
          can_choose_branches: canChooseBranches,
          custom_message: customMessage,
          created_by: user?.id,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating onboarding request:', error);
        throw new Error('Failed to create onboarding request');
      }

      await fetchOnboardingRequests();
      return data;
    } catch (err) {
      console.error('Error in createOnboardingRequest:', err);
      throw err;
    }
  };

  const updateRequestStatus = async (requestId: string, status: string) => {
    try {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      
      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;
      } else if (status === 'onboarding_initiated') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('supplier_onboarding_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) {
        console.error('Error updating request status:', error);
        throw new Error('Failed to update request status');
      }

      await fetchOnboardingRequests();
    } catch (err) {
      console.error('Error in updateRequestStatus:', err);
      throw err;
    }
  };

  const addDocumentRequirement = async (
    requestId: string,
    documentType: string,
    documentName: string,
    description?: string,
    isRequired: boolean = true,
    templateFilePath?: string,
    templateFileName?: string
  ) => {
    try {
      const { error } = await supabase
        .from('onboarding_document_requirements')
        .insert({
          onboarding_request_id: requestId,
          document_type: documentType,
          document_name: documentName,
          description,
          is_required: isRequired,
          template_file_path: templateFilePath,
          template_file_name: templateFileName
        });

      if (error) {
        console.error('Error adding document requirement:', error);
        throw new Error('Failed to add document requirement');
      }
    } catch (err) {
      console.error('Error in addDocumentRequirement:', err);
      throw err;
    }
  };

  const addFormField = async (
    requestId: string,
    fieldType: FormField['field_type'],
    fieldLabel: string,
    fieldDescription?: string,
    fieldOptions?: any,
    isRequired: boolean = false,
    fieldOrder: number = 0
  ) => {
    try {
      const { error } = await supabase
        .from('onboarding_form_fields')
        .insert({
          onboarding_request_id: requestId,
          field_type: fieldType,
          field_label: fieldLabel,
          field_description: fieldDescription,
          field_options: fieldOptions,
          is_required: isRequired,
          field_order: fieldOrder
        });

      if (error) {
        console.error('Error adding form field:', error);
        throw new Error('Failed to add form field');
      }
    } catch (err) {
      console.error('Error in addFormField:', err);
      throw err;
    }
  };

  const getDocumentRequirements = async (requestId: string): Promise<DocumentRequirement[]> => {
    try {
      const { data, error } = await supabase
        .from('onboarding_document_requirements')
        .select('*')
        .eq('onboarding_request_id', requestId)
        .order('created_at');

      if (error) {
        console.error('Error fetching document requirements:', error);
        throw new Error('Failed to fetch document requirements');
      }

      return data || [];
    } catch (err) {
      console.error('Error in getDocumentRequirements:', err);
      throw err;
    }
  };

  const getFormFields = async (requestId: string): Promise<FormField[]> => {
    try {
      const { data, error } = await supabase
        .from('onboarding_form_fields')
        .select('*')
        .eq('onboarding_request_id', requestId)
        .order('field_order');

      if (error) {
        console.error('Error fetching form fields:', error);
        throw new Error('Failed to fetch form fields');
      }

      return (data || []).map(field => ({
        ...field,
        field_type: field.field_type as FormField['field_type']
      }));
    } catch (err) {
      console.error('Error in getFormFields:', err);
      throw err;
    }
  };

  return {
    requests,
    loading,
    error,
    createOnboardingRequest,
    createOnboardingRequestFromDefaults,
    loadDefaultSettings,
    updateRequestStatus,
    addDocumentRequirement,
    addFormField,
    getDocumentRequirements,
    getFormFields,
    refetch: fetchOnboardingRequests
  };
};