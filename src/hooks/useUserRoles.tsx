import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'buyer' | 'supplier' | 'admin' | 'super_admin' | 'company_admin' | 'viewer' | 'approver' | 'branch_manager' | 'document_manager' | 'platform_admin';

interface UserRole {
  role: AppRole;
  granted_at: string;
  expires_at: string | null;
}

export const useUserRoles = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [roleDetails, setRoleDetails] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserRoles();
    } else {
      setRoles([]);
      setRoleDetails([]);
      setLoading(false);
    }
  }, [user]);

  const fetchUserRoles = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Use the get_user_roles RPC function for server-side validation
      const { data, error } = await supabase
        .rpc('get_user_roles', { _user_id: user.id });

      if (error) {
        console.error('Error fetching user roles:', error);
      }

      // If user_roles has data, use it (authoritative source)
      if (data && data.length > 0) {
        setRoleDetails(data);
        setRoles(data.map((r: UserRole) => r.role));
        return;
      }

      // Fallback: Check profile.roles if user_roles is empty
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('roles')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile roles:', profileError);
        setRoles([]);
        setRoleDetails([]);
        return;
      }

      if (profileData?.roles && profileData.roles.length > 0) {
        // Convert to AppRole[] and set
        const fallbackRoles = profileData.roles as AppRole[];
        setRoles(fallbackRoles);
        setRoleDetails(fallbackRoles.map(role => ({
          role,
          granted_at: new Date().toISOString(),
          expires_at: null
        })));
      } else {
        setRoles([]);
        setRoleDetails([]);
      }
    } catch (err) {
      console.error('Error in fetchUserRoles:', err);
      setRoles([]);
      setRoleDetails([]);
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  const hasAnyRole = (checkRoles: AppRole[]): boolean => {
    return checkRoles.some(role => roles.includes(role));
  };

  const hasAllRoles = (checkRoles: AppRole[]): boolean => {
    return checkRoles.every(role => roles.includes(role));
  };

  return {
    roles,
    roleDetails,
    loading,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    refetch: fetchUserRoles
  };
};
