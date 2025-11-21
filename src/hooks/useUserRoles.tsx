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
        setRoles([]);
        setRoleDetails([]);
        return;
      }

      setRoleDetails(data || []);
      setRoles((data || []).map((r: UserRole) => r.role));
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
