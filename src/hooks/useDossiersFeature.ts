import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useDossiersFeature(buyerId?: string) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(Boolean(buyerId));

  useEffect(() => {
    let active = true;
    if (!buyerId) {
      setEnabled(false);
      setLoading(false);
      return () => { active = false; };
    }

    const load = async () => {
      setLoading(true);
      // Phase 5 tables are intentionally not added to generated types until the migration is approved.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [{ data: catalog, error: catalogError }, { data: override, error: overrideError }] = await Promise.all([
        client.from('feature_flags').select('default_enabled').eq('key', 'compliance_dossiers_v1').maybeSingle(),
        client.from('organization_feature_flags').select('enabled, expires_at')
          .eq('organization_id', buyerId)
          .eq('organization_type', 'buyer')
          .eq('feature_key', 'compliance_dossiers_v1')
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
    return () => { active = false; };
  }, [buyerId]);

  return { enabled, loading };
}
