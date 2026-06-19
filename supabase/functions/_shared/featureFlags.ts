import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type SupabaseAdmin = ReturnType<typeof createClient>;

export async function isBuyerFeatureEnabled(admin: SupabaseAdmin, buyerId: string, featureKey: string): Promise<boolean> {
  const now = new Date().toISOString();
  const [{ data: catalog }, { data: override }] = await Promise.all([
    admin.from('feature_flags').select('default_enabled').eq('key', featureKey).maybeSingle(),
    admin.from('organization_feature_flags').select('enabled, expires_at')
      .eq('organization_id', buyerId).eq('organization_type', 'buyer')
      .eq('feature_key', featureKey).maybeSingle(),
  ]);
  if (override && (!override.expires_at || override.expires_at > now)) return override.enabled === true;
  return catalog?.default_enabled === true;
}
