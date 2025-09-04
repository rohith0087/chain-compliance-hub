import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useCompanyUserRole = (companyId?: string, companyType?: 'buyer' | 'supplier') => {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user && companyId && companyType) {
      fetchUserRole();
    } else {
      setRole(null);
      setLoading(false);
    }
  }, [user, companyId, companyType]);

  const fetchUserRole = async () => {
    if (!user || !companyId || !companyType) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('company_users')
        .select('role, status')
        .eq('profile_id', user.id)
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user role:', error);
        setRole(null);
        return;
      }

      setRole(data?.role || null);
    } catch (err) {
      console.error('Error in fetchUserRole:', err);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    role,
    loading,
    refetch: fetchUserRole
  };
};