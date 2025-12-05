import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface NotificationSettings {
  id?: string;
  buyer_id: string;
  expiring_soon_days: number;
  urgent_days: number;
  overdue_threshold_days: number;
  max_notifications_per_document: number;
  expires_soon_in_app: boolean;
  expires_soon_email: boolean;
  urgent_in_app: boolean;
  urgent_email: boolean;
  overdue_in_app: boolean;
  overdue_email: boolean;
  enabled: boolean;
}

const defaultSettings: Omit<NotificationSettings, 'buyer_id'> = {
  expiring_soon_days: 30,
  urgent_days: 14,
  overdue_threshold_days: 0,
  max_notifications_per_document: 3,
  expires_soon_in_app: true,
  expires_soon_email: false,
  urgent_in_app: true,
  urgent_email: true,
  overdue_in_app: true,
  overdue_email: true,
  enabled: true,
};

export const useBuyerNotificationSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const resolveBuyerId = useCallback(async (): Promise<string | null> => {
    if (!user) return null;

    // Check company_users first for team members
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('profile_id', user.id)
      .eq('company_type', 'buyer')
      .eq('status', 'active')
      .single();

    if (companyUser?.company_id) {
      return companyUser.company_id;
    }

    // Fall back to buyers table for company owners
    const { data: buyer } = await supabase
      .from('buyers')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    return buyer?.id || null;
  }, [user]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const buyerId = await resolveBuyerId();
      if (!buyerId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('buyer_notification_settings')
        .select('*')
        .eq('buyer_id', buyerId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading notification settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load notification settings',
          variant: 'destructive',
        });
      }

      if (data) {
        setSettings(data as NotificationSettings);
      } else {
        // Return default settings if none exist
        setSettings({ ...defaultSettings, buyer_id: buyerId });
      }
    } catch (error) {
      console.error('Error in loadSettings:', error);
    } finally {
      setLoading(false);
    }
  }, [resolveBuyerId]);

  const saveSettings = async (newSettings: Partial<NotificationSettings>) => {
    setSaving(true);
    try {
      const buyerId = await resolveBuyerId();
      if (!buyerId) {
        throw new Error('Buyer ID not found');
      }

      const settingsToSave = {
        buyer_id: buyerId,
        ...defaultSettings,
        ...settings,
        ...newSettings,
      };

      const { data, error } = await supabase
        .from('buyer_notification_settings')
        .upsert(settingsToSave, { onConflict: 'buyer_id' })
        .select()
        .single();

      if (error) throw error;

      setSettings(data as NotificationSettings);
      toast({
        title: 'Settings Saved',
        description: 'Notification settings have been updated successfully.',
      });

      return data;
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification settings',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const triggerManualCheck = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-document-expiry');
      
      if (error) throw error;

      toast({
        title: 'Check Complete',
        description: `Processed ${data.processed} documents, sent ${data.notificationsSent} notifications.`,
      });

      return data;
    } catch (error) {
      console.error('Error triggering expiry check:', error);
      toast({
        title: 'Error',
        description: 'Failed to run expiry check',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    saving,
    saveSettings,
    triggerManualCheck,
    refetch: loadSettings,
  };
};