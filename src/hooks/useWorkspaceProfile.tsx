import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DEFAULT_PROFILE,
  WorkspaceProfile,
  getWorkspaceProfileForIndustry,
} from '@/config/workspaceProfiles';

/**
 * Resolves the active WorkspaceProfile based on the current user's buyer industry.
 * Auditor buyers (industry === 'Auditor') get the auditor terminology pack and
 * auditor-only feature flags. Falls back to DEFAULT_PROFILE while loading or
 * when the user isn't a buyer.
 */
export function useWorkspaceProfile() {
  const { user } = useAuth();
  const [industry, setIndustry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        if (!cancelled) {
          setIndustry(null);
          setLoading(false);
        }
        return;
      }
      try {
        // Try buyer team member first
        const { data: buyerTm } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('profile_id', user.id)
          .eq('company_type', 'buyer')
          .eq('status', 'active')
          .maybeSingle();

        let buyerQuery = supabase.from('buyers').select('industry').limit(1);
        if (buyerTm?.company_id) {
          buyerQuery = buyerQuery.eq('id', buyerTm.company_id);
        } else {
          buyerQuery = buyerQuery.eq('profile_id', user.id);
        }
        const { data: buyerData } = await buyerQuery.maybeSingle();
        if (buyerData?.industry) {
          if (!cancelled) setIndustry(buyerData.industry);
          return;
        }

        // Fall back to supplier industry
        const { data: supplierTm } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('profile_id', user.id)
          .eq('company_type', 'supplier')
          .eq('status', 'active')
          .maybeSingle();

        let supplierQuery = supabase.from('suppliers').select('industry').limit(1);
        if (supplierTm?.company_id) {
          supplierQuery = supplierQuery.eq('id', supplierTm.company_id);
        } else {
          supplierQuery = supplierQuery.eq('profile_id', user.id);
        }
        const { data: supplierData } = await supplierQuery.maybeSingle();
        if (!cancelled) setIndustry(supplierData?.industry ?? null);
      } catch {
        if (!cancelled) setIndustry(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const profile: WorkspaceProfile = useMemo(
    () => getWorkspaceProfileForIndustry(industry),
    [industry]
  );

  return {
    profile,
    t: profile.terms,
    flags: profile.flags,
    isAuditor: profile.id === 'auditor',
    isAuditee: profile.id === 'auditee',
    industry,
    loading,
  };
}

export { DEFAULT_PROFILE };
