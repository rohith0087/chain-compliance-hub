import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Gates the whole supplier-risk subsystem behind the `supplier_risk` feature
// flag (catalog default + optional per-buyer override). Mirrors the other
// use<Feature>Feature hooks in this app.
export function useSupplierRiskFeature(buyerId?: string) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(Boolean(buyerId));

  useEffect(() => {
    let active = true;
    if (!buyerId) {
      setEnabled(false);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const load = async () => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [{ data: catalog, error: catalogError }, { data: override, error: overrideError }] =
        await Promise.all([
          client.from('feature_flags').select('default_enabled').eq('key', 'supplier_risk').maybeSingle(),
          client
            .from('organization_feature_flags')
            .select('enabled, expires_at')
            .eq('organization_id', buyerId)
            .eq('organization_type', 'buyer')
            .eq('feature_key', 'supplier_risk')
            .maybeSingle(),
        ]);

      if (!active) return;
      if (catalogError || overrideError) {
        setEnabled(false);
      } else if (override && (!override.expires_at || new Date(override.expires_at) > new Date())) {
        setEnabled(override.enabled === true);
      } else {
        setEnabled(catalog?.default_enabled === true);
      }
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [buyerId]);

  return { enabled, loading };
}
