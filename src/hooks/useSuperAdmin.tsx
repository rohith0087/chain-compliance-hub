import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SuperAdminStats {
  total_users: number;
  total_buyers: number;
  total_suppliers: number;
  active_connections: number;
  total_documents: number;
  pending_requests: number;
  total_chat_sessions: number;
  recent_signups: number;
}

interface DetailedUser {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  company_name: string;
  created_at: string;
  last_sign_in_at: string;
  is_buyer: boolean;
  is_supplier: boolean;
  document_count: number;
  chat_sessions_count: number;
}

export const useSuperAdmin = () => {
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [users, setUsers] = useState<DetailedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const isSuperAdmin = user?.user_metadata?.roles?.includes('super_admin') || false;

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_super_admin_stats');
      
      if (error) {
        throw error;
      }

      setStats(data[0] || null);
    } catch (err) {
      console.error('Error fetching super admin stats:', err);
      setError('Failed to load statistics');
    }
  };

  const fetchAllUsers = async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_users_detailed');
      
      if (error) {
        throw error;
      }

      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
    }
  };

  const updateUserRole = async (userId: string, newRoles: string[]) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ roles: newRoles })
        .eq('id', userId);

      if (error) throw error;

      // Refresh users list
      await fetchAllUsers();
      return { success: true };
    } catch (err) {
      console.error('Error updating user role:', err);
      return { success: false, error: 'Failed to update user role' };
    }
  };

  const resetUserPassword = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('super_admin_reset_password', {
        target_user_id: userId,
        new_password: 'temp_password_123'
      });

      if (error) throw error;

      return { success: true, message: 'Password reset logged. Contact system admin for actual reset.' };
    } catch (err) {
      console.error('Error resetting password:', err);
      return { success: false, error: 'Failed to reset password' };
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      setLoading(true);
      Promise.all([fetchStats(), fetchAllUsers()])
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setError('Super admin access required');
    }
  }, [isSuperAdmin]);

  return {
    stats,
    users,
    loading,
    error,
    isSuperAdmin,
    fetchStats,
    fetchAllUsers,
    updateUserRole,
    resetUserPassword,
    refetch: () => {
      if (isSuperAdmin) {
        Promise.all([fetchStats(), fetchAllUsers()]);
      }
    }
  };
};