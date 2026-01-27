import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';

export const useCompanyUserRole = (companyId?: string, companyType?: 'buyer' | 'supplier') => {
  const [role, setRole] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isImpersonating, impersonatedCompany } = useImpersonation();

  useEffect(() => {
    // When impersonating, grant owner permissions if viewing impersonated company
    if (isImpersonating && impersonatedCompany) {
      if (companyId === impersonatedCompany.id && companyType === impersonatedCompany.type) {
        setRole('company_admin');
        setIsOwner(true);
        setLoading(false);
        return;
      }
    }

    if (user && companyId && companyType) {
      fetchUserRole();
    } else {
      setRole(null);
      setIsOwner(false);
      setLoading(false);
    }
  }, [user, companyId, companyType, isImpersonating, impersonatedCompany]);

  const fetchUserRole = async () => {
    if (!user || !companyId || !companyType) return;

    try {
      setLoading(true);

      // Check if user is the company owner (profile_id in buyers/suppliers table)
      const ownerTable = companyType === 'buyer' ? 'buyers' : 'suppliers';
      const { data: ownerCheck } = await supabase
        .from(ownerTable)
        .select('id')
        .eq('profile_id', user.id)
        .eq('id', companyId)
        .maybeSingle();

      const userIsOwner = !!ownerCheck;
      setIsOwner(userIsOwner);

      // If owner, they have implicit company_admin role
      if (userIsOwner) {
        setRole('company_admin');
        return;
      }

      // Otherwise check company_users table for team member role
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
      setIsOwner(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    role,
    isOwner,
    loading,
    refetch: fetchUserRole
  };
};