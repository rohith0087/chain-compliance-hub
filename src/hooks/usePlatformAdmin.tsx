import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type PlatformRole = 'super_admin' | 'platform_admin' | 'support_admin';

export interface PlatformAdminStats {
  total_users: number;
  total_buyers: number;
  total_suppliers: number;
  active_connections: number;
  total_documents: number;
  pending_requests: number;
  total_chat_sessions: number;
  recent_signups: number;
}

export interface DetailedUser {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  company_name: string;
  registration_date: string;
  total_chat_sessions: number;
  total_chat_messages: number;
  total_document_requests: number;
  total_document_uploads: number;
  last_activity_date: string;
  total_activities: number;
  user_type: string;
}

export interface PlatformAdmin {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  platform_roles: PlatformRole[];
  is_active: boolean;
  last_login_at: string;
  created_at: string;
}

export const usePlatformAdmin = () => {
  const [stats, setStats] = useState<PlatformAdminStats | null>(null);
  const [users, setUsers] = useState<DetailedUser[]>([]);
  const [platformAdmin, setPlatformAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Check if current user is a platform admin
  const isPlatformAdmin = platformAdmin?.is_active && platformAdmin.platform_roles.length > 0;

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_platform_admin_stats');
      
      if (error) {
        console.error('Error fetching platform admin stats:', error);
        setError(error.message);
        return;
      }
      
      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (err) {
      console.error('Error in fetchStats:', err);
      setError('Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_all_users_detailed_platform');
      
      if (error) {
        console.error('Error fetching users:', error);
        setError(error.message);
        return;
      }
      
      setUsers(data || []);
    } catch (err) {
      console.error('Error in fetchAllUsers:', err);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlatformAdminProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('platform_administrators')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching platform admin profile:', error);
        return;
      }

      setPlatformAdmin(data);
    } catch (err) {
      console.error('Error in fetchPlatformAdminProfile:', err);
    }
  }, []);

  const updateUserRole = useCallback(async (userId: string, newRoles: string[]) => {
    try {
      const { data, error } = await supabase.rpc('platform_admin_update_user_role', {
        user_id_param: userId,
        new_roles: newRoles as any
      });

      if (error) {
        console.error('Error updating user role:', error);
        toast({
          title: "Error",
          description: "Failed to update user role",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "User role updated successfully",
      });

      // Refresh users list
      await fetchAllUsers();
    } catch (err) {
      console.error('Error in updateUserRole:', err);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  }, [fetchAllUsers, toast]);

  const resetUserPassword = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('platform_admin_reset_password', {
        user_id_param: userId
      });

      if (error) {
        console.error('Error resetting password:', error);
        toast({
          title: "Error",
          description: "Failed to reset password",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Password reset logged successfully",
      });
    } catch (err) {
      console.error('Error in resetUserPassword:', err);
      toast({
        title: "Error",
        description: "Failed to reset password",
        variant: "destructive",
      });
    }
  }, [toast]);

  const signInPlatformAdmin = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      // Check if user is a platform admin
      const { data: adminData, error: adminError } = await supabase
        .from('platform_administrators')
        .select('*')
        .eq('auth_user_id', data.user.id)
        .eq('is_active', true)
        .single();

      if (adminError || !adminData) {
        await supabase.auth.signOut();
        return { error: { message: 'Access denied. Platform admin role required.' } };
      }

      // Update last login
      await supabase
        .from('platform_administrators')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', adminData.id);

      setPlatformAdmin(adminData);
      return { error: null };
    } catch (err) {
      console.error('Error in signInPlatformAdmin:', err);
      return { error: { message: 'Authentication failed' } };
    }
  }, []);

  useEffect(() => {
    fetchPlatformAdminProfile();
  }, [fetchPlatformAdminProfile]);

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchStats();
      fetchAllUsers();
    }
  }, [isPlatformAdmin, fetchStats, fetchAllUsers]);

  return {
    stats,
    users,
    platformAdmin,
    loading,
    error,
    isPlatformAdmin,
    fetchStats,
    fetchAllUsers,
    updateUserRole,
    resetUserPassword,
    signInPlatformAdmin,
  };
};