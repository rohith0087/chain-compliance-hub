// Data access for external risk scores + events. Tables aren't in generated
// types until regenerated post-migration, so we cast to `any` (app convention).

import { supabase } from '@/integrations/supabase/client';
import type { RiskDimension } from './templates';

export interface RiskScore {
  id: string;
  buyer_id: string;
  supplier_id: string;
  overall_score: number;
  dimension_scores: Partial<Record<RiskDimension, number>>;
  previous_score: number | null;
  change_reasons: { dimension: string; score: number; events: number }[];
  engine_version: string;
  policy_version: number | null;
  calculated_at: string;
}

export interface RiskEvent {
  id: string;
  supplier_id: string;
  event_type: string;
  dimension: RiskDimension;
  severity: number;
  entity_match_confidence: number;
  status: string;
  evidence_status: string;
  detected_at: string;
  // Source citation (from risk_source_records via the *_with_sources RPC).
  // Null for synthetic/internal signals that have no external record.
  source_record_id?: string | null;
  source_url?: string | null;
  source_type?: string | null;
  connector?: string | null;
  source_title?: string | null;
  source_published?: string | null;
  source_summary?: string | null;
}

export async function fetchLatestRiskScore(
  buyerId: string,
  supplierId: string,
): Promise<RiskScore | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from('supplier_risk_scores')
    .select('*')
    .eq('buyer_id', buyerId)
    .eq('supplier_id', supplierId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as RiskScore) ?? null;
}

export async function fetchRiskEvents(supplierId: string): Promise<RiskEvent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  // Uses the *_with_sources RPC so each event carries its source citation
  // (source_url + normalized title/date/summary) from risk_source_records.
  const { data, error } = await client.rpc('get_supplier_risk_events_with_sources', {
    p_supplier_id: supplierId,
  });
  if (error) throw error;
  return (data ?? []).map((e: RiskEvent) => ({ ...e, supplier_id: e.supplier_id ?? supplierId })) as RiskEvent[];
}

export type FeedbackType =
  | 'relevant'
  | 'not_relevant'
  | 'false_entity_match'
  | 'escalated'
  | 'remediated'
  | 'disruption_occurred';

// Buyer-scoped label on an event. RLS enforces buyer_id ∈ get_user_buyer_ids().
// The scoring engine (v2) excludes events this buyer marked not_relevant /
// false_entity_match — so a label only ever affects THIS buyer's score.
export async function submitRiskFeedback(
  buyerId: string,
  riskEventId: string,
  feedbackType: FeedbackType,
  note?: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client.from('supplier_risk_feedback').insert({
    buyer_id: buyerId,
    risk_event_id: riskEventId,
    feedback_type: feedbackType,
    note: note ?? null,
  });
  if (error) throw error;
}

export interface SupplierRiskOverview {
  supplier_id: string;
  company_name: string;
  country: string | null;
  industry: string | null;
  active_events: number;
  review_events: number;
  max_severity: number;
  dimensions: string[];
  latest_event_at: string | null;
}

// Platform-wide overview (super-admin): ALL suppliers, regardless of connection.
export async function fetchAllSuppliersRiskOverview(): Promise<SupplierRiskOverview[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client.rpc('get_all_suppliers_risk_overview');
  if (error) throw error;
  return (data ?? []) as SupplierRiskOverview[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'supplier' | 'event' | 'source' | 'entity';
  dimension?: string;
  severity?: number;
  status?: string;
}
export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  verified: boolean;
}
export interface RiskGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export async function fetchSupplierRiskGraph(supplierId: string): Promise<RiskGraph> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client.rpc('get_supplier_risk_graph', {
    p_supplier_id: supplierId,
  });
  if (error) throw error;
  return (data ?? { nodes: [], edges: [] }) as RiskGraph;
}

// Runs the deterministic engine (Postgres RPC) and returns the new snapshot.
export async function recomputeRiskScore(
  buyerId: string,
  supplierId: string,
): Promise<RiskScore> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client.rpc('calculate_supplier_risk_score', {
    p_buyer_id: buyerId,
    p_supplier_id: supplierId,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as RiskScore;
}
