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
    customMessage?: string,
    supplierId?: string
  ) => {
    try {
      // Load default settings (including industry templates)
      const defaults = await loadDefaultSettings(buyerId);

      // Use defaults or fallback values
      const canChooseBranches = defaults.settings?.allow_branch_selection ?? false;
      const finalMessage = customMessage || defaults.settings?.default_welcome_message || '';

      // Create the request
      const request = await createOnboardingRequest(
        buyerId,
        supplierEmail,
        supplierCompanyName,
        canChooseBranches,
        finalMessage,
        supplierId
      );

      // Add default document requirements
      if (defaults.documentRequirements && defaults.documentRequirements.length > 0) {
        for (const doc of defaults.documentRequirements) {
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
      if (defaults.formFields && defaults.formFields.length > 0) {
        for (const field of defaults.formFields) {
          await addFormField(
            request.id,
            field.field_type,
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
      // First get the buyer's industry
      const { data: buyer } = await supabase
        .from('buyers')
        .select('industry')
        .eq('id', buyerId)
        .single();

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

      // If no custom settings exist but buyer has a matching industry template, use it
      if (!settings && (!docs || docs.length === 0) && (!fields || fields.length === 0) && buyer?.industry) {
        const { getTemplateForIndustry } = await import('@/config/defaultOnboardingTemplates');
        const industryTemplate = getTemplateForIndustry(buyer.industry);
        
        if (industryTemplate) {
          return {
            settings: {
              allow_branch_selection: industryTemplate.allow_branch_selection,
              require_branch_selection: industryTemplate.require_branch_selection,
              auto_approve_standard_docs: industryTemplate.auto_approve_standard_docs,
              require_all_documents: industryTemplate.require_all_documents,
              expires_days: industryTemplate.expires_days,
              default_welcome_message: industryTemplate.default_welcome_message,
            },
            documentRequirements: industryTemplate.document_requirements.map((doc, index) => ({
              document_type: doc.document_type,
              document_name: doc.document_name,
              description: doc.description,
              is_required: doc.is_required,
              display_order: doc.display_order,
              template_file_path: doc.template_file_path,
              template_file_name: doc.template_file_name,
            })),
            formFields: industryTemplate.form_fields.map((field, index) => ({
              field_type: field.field_type as FormField['field_type'],
              field_label: field.field_label,
              field_description: field.field_description,
              field_options: field.field_options,
              is_required: field.is_required,
              field_order: field.field_order,
            }))
          };
        }
      }

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
    customMessage?: string,
    supplierId?: string
  ) => {
    try {
      const { data, error} = await supabase
        .from('supplier_onboarding_requests')
        .insert({
          buyer_id: buyerId,
          supplier_id: supplierId || null,
          supplier_email: supplierEmail,
          supplier_company_name: supplierCompanyName,
          can_choose_branches: canChooseBranches,
          custom_message: customMessage,
          created_by: user?.id,
          status: supplierId ? 'pending' : 'invited' // invited if no supplier yet, pending if supplier exists
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating onboarding request:', error);
        throw new Error('Failed to create onboarding request');
      }

      // Link the onboarding request to the buyer-supplier connection
      if (data && supplierId) {
        const { error: updateError } = await supabase
          .from('buyer_supplier_connections')
          .update({ 
            onboarding_request_id: data.id,
          })
          .eq('buyer_id', buyerId)
          .eq('supplier_id', supplierId)
          .eq('status', 'approved');

        if (updateError) {
          console.error('Warning: Failed to link onboarding request to connection:', updateError);
          // Don't throw - the request was created successfully
        }

        // Send notification to supplier about the onboarding request
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('profile_id')
          .eq('id', supplierId)
          .single();

        if (supplier?.profile_id) {
          await supabase.rpc('create_notification', {
            p_user_id: supplier.profile_id,
            p_title: 'New Onboarding Request',
            p_message: 'You have received a new onboarding request. Please complete the required documents.',
            p_type: 'onboarding_request',
            p_reference_id: data.id
          });
        }
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

  const updateOnboardingRequest = async (
    requestId: string,
    updates: {
      supplier_company_name?: string;
      custom_message?: string;
      can_choose_branches?: boolean;
      supplier_email?: string;
    }
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('supplier_onboarding_requests')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      await fetchOnboardingRequests();
    } catch (error) {
      console.error('Error updating onboarding request:', error);
      throw error;
    }
  };

  const resendOnboardingRequest = async (requestId: string): Promise<void> => {
    try {
      // Generate new token and extend expiry
      const newToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Get current resent_count first
      const { data: currentRequest } = await supabase
        .from('supplier_onboarding_requests')
        .select('resent_count')
        .eq('id', requestId)
        .single();

      const { error: updateError } = await supabase
        .from('supplier_onboarding_requests')
        .update({
          invitation_token: newToken,
          expires_at: expiresAt.toISOString(),
          last_sent_at: new Date().toISOString(),
          resent_count: (currentRequest?.resent_count || 0) + 1,
          status: 'pending', // Reset from expired to pending
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Get the request details to send email
      const { data: request, error: fetchError } = await supabase
        .from('supplier_onboarding_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Trigger email notification
      await supabase.functions.invoke('send-supplier-invitation', {
        body: {
          email: request.supplier_email,
          buyerId: request.buyer_id,
          invitationToken: newToken,
          customMessage: request.custom_message
        }
      });

      await fetchOnboardingRequests();
    } catch (error) {
      console.error('Error resending onboarding request:', error);
      throw error;
    }
  };

  const cancelOnboardingRequest = async (requestId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('supplier_onboarding_requests')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      await fetchOnboardingRequests();
    } catch (error) {
      console.error('Error cancelling onboarding request:', error);
      throw error;
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
    updateOnboardingRequest,
    resendOnboardingRequest,
    cancelOnboardingRequest,
    refetch: fetchOnboardingRequests
  };
};