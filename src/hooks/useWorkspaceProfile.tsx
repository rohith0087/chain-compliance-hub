import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DEFAULT_PROFILE,
  AUDITEE_PROFILE,
  WorkspaceProfile,
  getWorkspaceProfileForIndustry,
} from '@/config/workspaceProfiles';

/**
 * Resolves the active WorkspaceProfile based on the current user's industry and role.
 *
 * - Buyer with industry "Auditor"  → AUDITOR_PROFILE  (auditing firm managing clients)
 * - Supplier with industry "Auditor" → AUDITEE_PROFILE  (company being audited)
 * - Falls back to DEFAULT_PROFILE while loading or when no match.
 */
export function useWorkspaceProfile() {
  const { user } = useAuth();
  const [industry, setIndustry] = useState<string | null>(null);
  // 'buyer' | 'supplier' | null — tracks which role provided the industry
  const [sourceRole, setSourceRole] = useState<'buyer' | 'supplier' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        if (!cancelled) {
          setIndustry(null);
          setSourceRole(null);
          setLoading(false);
        }
        return;
      }
      try {
        // Determine the current role from the URL to prioritize which profile to check
        const urlParams = new URLSearchParams(window.location.search);
        const activeRole = urlParams.get('role'); // 'buyer' or 'supplier'

        const checkBuyerFirst = activeRole !== 'supplier';

        const fetchBuyerIndustry = async () => {
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
          return buyerData?.industry;
        };

        const fetchSupplierIndustry = async () => {
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
          return supplierData?.industry;
        };

        if (checkBuyerFirst) {
          const buyerInd = await fetchBuyerIndustry();
          if (buyerInd) {
            if (!cancelled) { setIndustry(buyerInd); setSourceRole('buyer'); }
            return;
          }
          const supplierInd = await fetchSupplierIndustry();
          if (!cancelled) { setIndustry(supplierInd || null); setSourceRole('supplier'); }
        } else {
          // If viewing as supplier, check supplier profile first
          const supplierInd = await fetchSupplierIndustry();
          if (supplierInd) {
            if (!cancelled) { setIndustry(supplierInd); setSourceRole('supplier'); }
            return;
          }
          const buyerInd = await fetchBuyerIndustry();
          if (!cancelled) { setIndustry(buyerInd || null); setSourceRole('buyer'); }
        }

      } catch {
        if (!cancelled) {
          setIndustry(null);
          setSourceRole(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  const profile: WorkspaceProfile = useMemo(() => {
    // A supplier whose industry is "Auditor" is an *auditee* (being audited),
    // not an auditing firm — give them the AUDITEE_PROFILE so their dashboard
    // shows "Auditor Connections" instead of generic "Buyer Connections".
    if (sourceRole === 'supplier' && industry === 'Auditor') {
      return AUDITEE_PROFILE;
    }
    return getWorkspaceProfileForIndustry(industry);
  }, [industry, sourceRole]);

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
