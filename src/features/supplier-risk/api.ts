// Data access for the supplier-risk policy.
//
// The Slice 0 tables are intentionally NOT in the generated Supabase types until
// the migration is approved/applied (same convention as the evidence feature),
// so we cast the client to `any` for these calls. Swap to typed access once
// `src/integrations/supabase/types.ts` is regenerated post-migration.

import { supabase } from '@/integrations/supabase/client';
import type { RiskDimension } from './templates';

export interface BuyerRiskPolicy {
  id: string;
  buyer_id: string;
  policy_key: string;
  version: number;
  industry: string | null;
  dimensions: Record<RiskDimension, number>;
  critical_topics: string[];
  is_published: boolean;
  updated_at: string;
}

export interface RiskPolicyDraft {
  industry: string;
  dimensions: Record<RiskDimension, number>;
  critical_topics: string[];
  is_published: boolean;
}

// Resolve the buyer id for a user (team member first, then owner) — mirrors the
// resolveBuyerId pattern used across the app's buyer-scoped hooks.
export async function resolveBuyerId(userId: string): Promise<string | null> {
  const { data: teamMember } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('profile_id', userId)
    .eq('company_type', 'buyer')
    .eq('status', 'active')
    .maybeSingle();
  if (teamMember?.company_id) return teamMember.company_id;

  const { data: owner } = await supabase
    .from('buyers')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle();
  return owner?.id ?? null;
}

const POLICY_KEY = 'default';

export async function fetchBuyerRiskPolicy(buyerId: string): Promise<BuyerRiskPolicy | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from('buyer_risk_policies')
    .select('*')
    .eq('buyer_id', buyerId)
    .eq('policy_key', POLICY_KEY)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as BuyerRiskPolicy) ?? null;
}

export async function saveBuyerRiskPolicy(
  buyerId: string,
  draft: RiskPolicyDraft,
  existing: BuyerRiskPolicy | null,
): Promise<BuyerRiskPolicy> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const payload = {
    buyer_id: buyerId,
    policy_key: POLICY_KEY,
    industry: draft.industry,
    dimensions: draft.dimensions,
    critical_topics: draft.critical_topics,
    is_published: draft.is_published,
  };

  if (existing) {
    const { data, error } = await client
      .from('buyer_risk_policies')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data as BuyerRiskPolicy;
  }

  const { data, error } = await client
    .from('buyer_risk_policies')
    .insert({ ...payload, version: 1 })
    .select('*')
    .single();
  if (error) throw error;
  return data as BuyerRiskPolicy;
}
