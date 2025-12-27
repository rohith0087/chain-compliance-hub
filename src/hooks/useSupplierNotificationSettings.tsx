import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface SupplierNotificationSettings {
  id?: string;
  supplier_id: string;
  enabled: boolean;
  new_request_in_app_enabled: boolean;
  new_request_email_enabled: boolean;
}

const defaultSettings: Omit<SupplierNotificationSettings, 'supplier_id'> = {
  enabled: true,
  new_request_in_app_enabled: true,
  new_request_email_enabled: false,
};

export const useSupplierNotificationSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SupplierNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // First, get the supplier ID for the current user
      // Check if user is a team member
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', user.id)
        .eq('company_type', 'supplier')
        .eq('status', 'active')
        .maybeSingle();

      let resolvedSupplierId = teamMember?.company_id;

      if (!resolvedSupplierId) {
        // Check if user is a supplier owner
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();

        resolvedSupplierId = supplier?.id;
      }

      if (!resolvedSupplierId) {
        setLoading(false);
        return;
      }

      setSupplierId(resolvedSupplierId);

      // Fetch notification settings
      const { data, error } = await supabase
        .from('supplier_notification_settings')
        .select('*')
        .eq('supplier_id', resolvedSupplierId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as SupplierNotificationSettings);
      } else {
        // Create default settings if none exist
        const newSettings = {
          supplier_id: resolvedSupplierId,
          ...defaultSettings,
        };

        const { data: created, error: createError } = await supabase
          .from('supplier_notification_settings')
          .insert(newSettings)
          .select()
          .single();

        if (createError) throw createError;
        setSettings(created as SupplierNotificationSettings);
      }
    } catch (error: any) {
      console.error('Error fetching supplier notification settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notification settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<SupplierNotificationSettings>) => {
    if (!settings?.id || !supplierId) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('supplier_notification_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      if (error) throw error;

      setSettings((prev) => (prev ? { ...prev, ...updates } : null));

      toast({
        title: 'Success',
        description: 'Notification settings updated',
      });
    } catch (error: any) {
      console.error('Error updating supplier notification settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update notification settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    settings,
    loading,
    saving,
    updateSettings,
    refetch: fetchSettings,
  };
};
