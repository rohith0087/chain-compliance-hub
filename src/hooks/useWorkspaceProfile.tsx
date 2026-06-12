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
        // Team member?
        const { data: tm } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('profile_id', user.id)
          .eq('company_type', 'buyer')
          .eq('status', 'active')
          .maybeSingle();

        let buyerQuery = supabase.from('buyers').select('industry').limit(1);
        if (tm?.company_id) {
          buyerQuery = buyerQuery.eq('id', tm.company_id);
        } else {
          buyerQuery = buyerQuery.eq('profile_id', user.id);
        }
        const { data } = await buyerQuery.maybeSingle();
        if (!cancelled) setIndustry(data?.industry ?? null);
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
    industry,
    loading,
  };
}

export { DEFAULT_PROFILE };
