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
  const { data, error } = await client
    .from('supplier_risk_events')
    .select('id, supplier_id, event_type, dimension, severity, entity_match_confidence, status, evidence_status, detected_at')
    .eq('supplier_id', supplierId)
    .order('detected_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RiskEvent[];
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
