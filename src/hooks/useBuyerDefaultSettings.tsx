import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface DefaultOnboardingSettings {
  id?: string;
  allow_branch_selection: boolean;
  require_branch_selection: boolean;
  auto_approve_standard_docs: boolean;
  require_all_documents: boolean;
  expires_days: number;
  default_welcome_message: string;
}

export interface DefaultDocumentRequirement {
  id?: string;
  document_type: string;
  document_name: string;
  description?: string;
  is_required: boolean;
  display_order: number;
  template_file_path?: string;
  template_file_name?: string;
}

export interface DefaultFormField {
  id?: string;
  field_type: 'text' | 'email' | 'phone' | 'select' | 'textarea' | 'checkbox' | 'number' | 'date';
  field_label: string;
  field_description?: string;
  field_options?: any;
  is_required: boolean;
  field_order: number;
}

export const useBuyerDefaultSettings = () => {
  const [settings, setSettings] = useState<DefaultOnboardingSettings | null>(null);
  const [documentRequirements, setDocumentRequirements] = useState<DefaultDocumentRequirement[]>([]);
  const [formFields, setFormFields] = useState<DefaultFormField[]>([]);
  const [loading, setLoading] = useState(false);
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchBuyerId();
    }
  }, [user]);

  useEffect(() => {
    if (buyerId) {
      loadDefaultSettings();
    }
  }, [buyerId]);

  const fetchBuyerId = async () => {
    if (!user) return;

    try {
      const { data: buyer, error } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (error) throw error;
      setBuyerId(buyer?.id || null);
    } catch (error: any) {
      console.error('Error fetching buyer ID:', error);
    }
  };

  const loadDefaultSettings = async () => {
    if (!buyerId) return;

    setLoading(true);
    try {
      // Load main settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('buyer_default_onboarding_settings')
        .select('*')
        .eq('buyer_id', buyerId)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }

      // Load document requirements
      const { data: docsData, error: docsError } = await supabase
        .from('default_document_requirements')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('display_order');

      if (docsError) throw docsError;

      // Load form fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('default_form_fields')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('field_order');

      if (fieldsError) throw fieldsError;

      setSettings(settingsData || null);
      setDocumentRequirements(docsData || []);
      setFormFields((fieldsData || []).map(field => ({
        ...field,
        field_type: field.field_type as DefaultFormField['field_type']
      })));
    } catch (error: any) {
      console.error('Error loading default settings:', error);
      toast({
        title: "Error",
        description: "Failed to load default onboarding settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Omit<DefaultOnboardingSettings, 'id'>) => {
    if (!buyerId || !user) return;

    try {
      const settingsData = {
        buyer_id: buyerId,
        created_by: user.id,
        ...newSettings,
      };

      const { data, error } = await supabase
        .from('buyer_default_onboarding_settings')
        .upsert(settingsData, { onConflict: 'buyer_id' })
        .select()
        .single();

      if (error) throw error;

      setSettings(data);
      toast({
        title: "Success",
        description: "Default onboarding settings saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  const saveDocumentRequirements = async (requirements: Omit<DefaultDocumentRequirement, 'id'>[]) => {
    if (!buyerId) return;

    try {
      // Delete existing requirements
      await supabase
        .from('default_document_requirements')
        .delete()
        .eq('buyer_id', buyerId);

      // Insert new requirements
      if (requirements.length > 0) {
        const requirementsData = requirements.map(req => ({
          buyer_id: buyerId,
          ...req,
        }));

        const { data, error } = await supabase
          .from('default_document_requirements')
          .insert(requirementsData)
          .select();

        if (error) throw error;
        setDocumentRequirements(data || []);
      } else {
        setDocumentRequirements([]);
      }

      toast({
        title: "Success",
        description: "Default document requirements saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save document requirements",
        variant: "destructive",
      });
    }
  };

  const saveFormFields = async (fields: Omit<DefaultFormField, 'id'>[]) => {
    if (!buyerId) return;

    try {
      // Delete existing fields
      await supabase
        .from('default_form_fields')
        .delete()
        .eq('buyer_id', buyerId);

      // Insert new fields
      if (fields.length > 0) {
        const fieldsData = fields.map(field => ({
          buyer_id: buyerId,
          ...field,
        }));

        const { data, error } = await supabase
          .from('default_form_fields')
          .insert(fieldsData)
          .select();

        if (error) throw error;
        setFormFields((data || []).map(field => ({
          ...field,
          field_type: field.field_type as DefaultFormField['field_type']
        })));
      } else {
        setFormFields([]);
      }

      toast({
        title: "Success",
        description: "Default form fields saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save form fields",
        variant: "destructive",
      });
    }
  };

  return {
    settings,
    documentRequirements,
    formFields,
    loading,
    buyerId,
    saveSettings,
    saveDocumentRequirements,
    saveFormFields,
    refetch: loadDefaultSettings,
  };
};