import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import logger from '@/utils/logger';

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
  // Subscription fields
  subscription_status: string;
  subscription_plan_type: string;
  subscription_end_date: string | null;
  available_credits: number;
  total_purchased_credits: number;
  total_consumed_credits: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  // Company ID fields for impersonation
  buyer_id: string | null;
  supplier_id: string | null;
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

export interface PlatformAdminInvitation {
  id: string;
  email: string;
  platform_roles: PlatformRole[];
  invited_by_name: string;
  expires_at: string;
  created_at: string;
  is_used: boolean;
}

export const usePlatformAdmin = () => {
  const [stats, setStats] = useState<PlatformAdminStats | null>(null);
  const [users, setUsers] = useState<DetailedUser[]>([]);
  const [platformAdmin, setPlatformAdmin] = useState<PlatformAdmin | null>(null);
  const [invitations, setInvitations] = useState<PlatformAdminInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true); // Add explicit profile loading state
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Check if current user is a platform admin - only return true when we're sure
  const isPlatformAdmin = !profileLoading && platformAdmin?.is_active && platformAdmin.platform_roles.length > 0;

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
        const statsData = {
          total_users: Number(data[0].total_users),
          total_buyers: Number(data[0].total_buyers),
          total_suppliers: Number(data[0].total_suppliers),
          active_connections: Number(data[0].active_connections),
          total_documents: Number(data[0].total_documents),
          pending_requests: 0, // Not included in new function
          total_chat_sessions: Number(data[0].total_chat_sessions),
          recent_signups: 0 // Not included in new function
        };
        setStats(statsData);
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
      const { data, error } = await supabase.rpc('get_platform_admin_users');
      
      if (error) {
        console.error('Error fetching users:', error);
        setError(error.message);
        return;
      }
      
      const usersData: DetailedUser[] = (data || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        roles: user.roles || [],
        company_name: user.company_name,
        registration_date: user.created_at,
        total_chat_sessions: 0, // Not available in simplified function
        total_chat_messages: 0, // Not available in simplified function
        total_document_requests: 0, // Not available in simplified function
        total_document_uploads: 0, // Not available in simplified function
        last_activity_date: user.last_sign_in_at || '',
        total_activities: 0, // Not available in simplified function
        user_type: user.is_buyer && user.is_supplier ? 'Both' : user.is_buyer ? 'Buyer' : user.is_supplier ? 'Supplier' : 'User',
        // Subscription fields
        subscription_status: user.subscription_status || 'none',
        subscription_plan_type: user.subscription_plan_type || 'free',
        subscription_end_date: user.subscription_end_date,
        available_credits: user.available_credits || 0,
        total_purchased_credits: user.total_purchased_credits || 0,
        total_consumed_credits: user.total_consumed_credits || 0,
        stripe_customer_id: user.stripe_customer_id,
        stripe_subscription_id: user.stripe_subscription_id,
        // Company ID fields for impersonation
        buyer_id: user.buyer_id || null,
        supplier_id: user.supplier_id || null
      }));
      
      setUsers(usersData);
    } catch (err) {
      console.error('Error in fetchAllUsers:', err);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlatformAdminProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPlatformAdmin(null);
        setProfileLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('platform_administrators')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching platform admin profile:', error);
        setPlatformAdmin(null);
        setProfileLoading(false);
        return;
      }

      setPlatformAdmin(data);
    } catch (err) {
      console.error('Error in fetchPlatformAdminProfile:', err);
      setPlatformAdmin(null);
    } finally {
      setProfileLoading(false);
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
        user_id: userId
      });

      if (error) {
        console.error('Error resetting password:', error);
        return { success: false, error: error.message };
      }

      const result = data as any; // Type assertion for the JSON response
      if (result?.success) {
        return { success: true, message: result.message };
      } else {
        return { success: false, error: result?.error || 'Unknown error occurred' };
      }
    } catch (err) {
      console.error('Error in resetUserPassword:', err);
      return { success: false, error: 'Failed to reset password' };
    }
  }, []);

  const signInPlatformAdmin = useCallback(async (email: string, password: string, captchaToken?: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: captchaToken ? { captchaToken } : undefined,
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

  const fetchInvitations = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_platform_admin_invitations');
      
      if (error) {
        console.error('Error fetching invitations:', error);
        setError(error.message);
        return;
      }
      
      const formattedInvitations = (data || []).map((invitation: any) => ({
        id: invitation.id,
        email: invitation.email,
        platform_roles: invitation.platform_roles,
        invited_by_name: invitation.inviter_name || 'Unknown',
        expires_at: invitation.expires_at,
        created_at: invitation.created_at,
        is_used: invitation.is_used,
      }));
      
      setInvitations(formattedInvitations);
    } catch (err) {
      console.error('Error in fetchInvitations:', err);
      setError('Failed to fetch invitations');
    }
  }, []);

  const createInvitation = useCallback(async (email: string, roles: PlatformRole[]) => {
    try {
      const { data, error } = await supabase.rpc('create_platform_admin_invitation', {
        p_email: email,
        p_roles: roles
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to create invitation",
          variant: "destructive",
        });
        return { success: false, error };
      }

      const result = data as { success: boolean; error?: string; [key: string]: any };
      if (!result?.success) {
        toast({
          title: "Error",
          description: result?.error || "Failed to create invitation",
          variant: "destructive",
        });
        return { success: false, error: result?.error };
      }

      toast({
        title: "Success",
        description: "Platform admin invitation created successfully",
      });

      // Refresh invitations list
      await fetchInvitations();
      return { success: true, data: result };
    } catch (err) {
      console.error('Error in createInvitation:', err);
      toast({
        title: "Error",
        description: "Failed to create invitation",
        variant: "destructive",
      });
      return { success: false, error: err };
    }
  }, [fetchInvitations, toast]);

  const revokeInvitation = useCallback(async (invitationId: string) => {
    try {
      const { data, error } = await supabase.rpc('revoke_platform_admin_invitation', {
        p_invitation_id: invitationId
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to revoke invitation",
          variant: "destructive",
        });
        return;
      }

      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        toast({
          title: "Error",
          description: result?.error || "Failed to revoke invitation",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Invitation revoked successfully",
      });

      // Refresh invitations list
      await fetchInvitations();
    } catch (err) {
      console.error('Error in revokeInvitation:', err);
      toast({
        title: "Error",
        description: "Failed to revoke invitation",
        variant: "destructive",
      });
    }
  }, [fetchInvitations, toast]);

  const acceptInvitation = useCallback(async (token: string, fullName: string) => {
    try {
      const { data, error } = await supabase.rpc('accept_platform_admin_invitation', {
        p_token: token,
        p_full_name: fullName
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        return { success: false, error: result?.error || "Failed to accept invitation" };
      }

      return { success: true };
    } catch (err) {
      console.error('Error in acceptInvitation:', err);
      return { success: false, error: "Failed to accept invitation" };
    }
  }, []);

  useEffect(() => {
    fetchPlatformAdminProfile();
  }, [fetchPlatformAdminProfile]);

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchStats();
      fetchAllUsers();
      fetchInvitations();
    }
  }, [isPlatformAdmin]); // Removed function dependencies to prevent re-subscriptions

  // Set up real-time updates - simplified to prevent multiple subscriptions
  useEffect(() => {
    if (!isPlatformAdmin) return;

    // Create a unique channel name with timestamp to avoid conflicts
    const channelName = `platform-admin-updates-${Date.now()}-${Math.random()}`;
    
    logger.debug('Setting up platform admin real-time subscription:', channelName);
    
    // Subscribe to changes in key tables for real-time updates
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        logger.debug('Real-time update: profiles table changed');
        fetchStats();
        fetchAllUsers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buyers' }, () => {
        logger.debug('Real-time update: buyers table changed');
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, () => {
        logger.debug('Real-time update: suppliers table changed');
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buyer_supplier_connections' }, () => {
        logger.debug('Real-time update: buyer_supplier_connections table changed');
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_uploads' }, () => {
        logger.debug('Real-time update: document_uploads table changed');
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, () => {
        logger.debug('Real-time update: chat_sessions table changed');
        fetchStats();
      })
      .subscribe();

    return () => {
      logger.debug('Cleaning up platform admin real-time subscription:', channelName);
      supabase.removeChannel(channel);
    };
  }, [isPlatformAdmin]); // Only depend on isPlatformAdmin to prevent re-subscriptions

  return {
    stats,
    users,
    platformAdmin,
    invitations,
    loading,
    profileLoading,
    error,
    isPlatformAdmin,
    fetchStats,
    fetchAllUsers,
    updateUserRole,
    resetUserPassword,
    signInPlatformAdmin,
    fetchInvitations,
    createInvitation,
    revokeInvitation,
    acceptInvitation,
  };
};