import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserContext {
  companyType: 'buyer' | 'supplier';
  companyId: string;
  companyName: string;
  role: string;
  branchId: string | null;
  isOwner: boolean;
  status: string;
  passwordResetRequired: boolean;
  companyUserId: string;
}

interface UseUserContextsReturn {
  contexts: UserContext[];
  currentContext: UserContext | null;
  switchContext: (companyType: 'buyer' | 'supplier') => void;
  loading: boolean;
  error: string | null;
  isDualRole: boolean;
  needsPasswordReset: boolean;
  buyerContexts: UserContext[];
  supplierContexts: UserContext[];
  refetch: () => Promise<void>;
}

const CONTEXT_STORAGE_KEY = 'user_current_context_type';

export const useUserContexts = (): UseUserContextsReturn => {
  const { user } = useAuth();
  const [contexts, setContexts] = useState<UserContext[]>([]);
  const [currentContext, setCurrentContext] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContexts = useCallback(async () => {
    if (!user) {
      setContexts([]);
      setCurrentContext(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch ALL company_users records for this user (no limit!)
      const { data: memberships, error: membershipError } = await supabase
        .from('company_users')
        .select('id, company_type, company_id, status, password_reset_required, role, branch_id')
        .eq('profile_id', user.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false });

      if (membershipError) {
        console.error('Error fetching user contexts:', membershipError);
        setError('Failed to load user contexts');
        setLoading(false);
        return;
      }

      if (!memberships || memberships.length === 0) {
        // User is a company owner (no company_users records)
        setContexts([]);
        setCurrentContext(null);
        setLoading(false);
        return;
      }

      // Build context objects for each membership
      const contextPromises = memberships.map(async (membership) => {
        let companyName = 'Unknown Company';
        let isOwner = false;

        // Fetch company name based on type
        if (membership.company_type === 'buyer') {
          const { data: buyer } = await supabase
            .from('buyers')
            .select('company_name, profile_id')
            .eq('id', membership.company_id)
            .single();
          
          if (buyer) {
            companyName = buyer.company_name;
            isOwner = buyer.profile_id === user.id;
          }
        } else if (membership.company_type === 'supplier') {
          const { data: supplier } = await supabase
            .from('suppliers')
            .select('company_name, profile_id')
            .eq('id', membership.company_id)
            .single();
          
          if (supplier) {
            companyName = supplier.company_name;
            isOwner = supplier.profile_id === user.id;
          }
        }

        return {
          companyType: membership.company_type as 'buyer' | 'supplier',
          companyId: membership.company_id,
          companyName,
          role: membership.role,
          branchId: membership.branch_id,
          isOwner,
          status: membership.status || 'active',
          passwordResetRequired: membership.password_reset_required || false,
          companyUserId: membership.id,
        };
      });

      const resolvedContexts = await Promise.all(contextPromises);
      setContexts(resolvedContexts);

      // Determine current context
      const storedContextType = localStorage.getItem(CONTEXT_STORAGE_KEY) as 'buyer' | 'supplier' | null;
      
      // Find the best matching context
      let selectedContext: UserContext | null = null;

      if (storedContextType) {
        // Try to restore stored context
        selectedContext = resolvedContexts.find(c => c.companyType === storedContextType) || null;
      }

      if (!selectedContext && resolvedContexts.length > 0) {
        // Default to first available context
        selectedContext = resolvedContexts[0];
      }

      setCurrentContext(selectedContext);

      if (selectedContext) {
        localStorage.setItem(CONTEXT_STORAGE_KEY, selectedContext.companyType);
      }

    } catch (err) {
      console.error('Error in useUserContexts:', err);
      setError('An error occurred while loading user contexts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchContexts();
  }, [fetchContexts]);

  const switchContext = useCallback((companyType: 'buyer' | 'supplier') => {
    const newContext = contexts.find(c => c.companyType === companyType);
    if (newContext) {
      setCurrentContext(newContext);
      localStorage.setItem(CONTEXT_STORAGE_KEY, companyType);
      console.log('Switched context to:', companyType, newContext);
    }
  }, [contexts]);

  // Derived state
  const buyerContexts = contexts.filter(c => c.companyType === 'buyer');
  const supplierContexts = contexts.filter(c => c.companyType === 'supplier');
  const isDualRole = buyerContexts.length > 0 && supplierContexts.length > 0;
  const needsPasswordReset = contexts.some(c => c.passwordResetRequired);

  return {
    contexts,
    currentContext,
    switchContext,
    loading,
    error,
    isDualRole,
    needsPasswordReset,
    buyerContexts,
    supplierContexts,
    refetch: fetchContexts,
  };
};
