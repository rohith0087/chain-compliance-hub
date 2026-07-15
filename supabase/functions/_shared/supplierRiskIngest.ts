// Shared supplier-risk ingestion: normalization, confidence-gated name matching,
// and writing provenance (risk_source_records) + buyer-agnostic events
// (supplier_risk_events). Every connector (OFAC, CPSC, openFDA, ...) maps its
// source data into RiskCandidate[] and calls ingestCandidates — one code path,
// one matching policy. Scores are never computed here.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface RiskCandidate {
  name: string; // entity/firm name to match against suppliers
  dimension: string; // 'regulatory' | 'product_safety' | 'labor_esg' | ...
  eventType: string; // 'product_recall' | 'sanction_match' | ...
  severity: number; // 0..1
  occurredAt?: string | null; // YYYY-MM-DD
  eventKeyId: string; // stable id from the source, for dedup
  rawPayload: unknown;
}

export interface IngestSource {
  connector: string;
  connectorVersion: string;
  sourceType: string;
  sourceUrl: string;
}

export interface IngestResult {
  candidates: number;
  suppliers: number;
  matches: number;
  active_events: number;
  review_events: number;
}

const HIGH_CONFIDENCE = 0.9; // active event
const REVIEW_CONFIDENCE = 0.75; // under_review event

// Legal-form words removed before comparison (do NOT over-strip).
const LEGAL_SUFFIXES = new Set([
  "LLC", "LTD", "LIMITED", "INC", "INCORPORATED", "CORP", "CORPORATION", "CO",
  "COMPANY", "GMBH", "SA", "SAS", "BV", "PTE", "PLC", "GROUP", "HOLDING",
  "HOLDINGS", "INDUSTRIES", "INDUSTRY", "TRADING", "MANUFACTURING", "MFG",
  "THE", "AND",
]);

export function normalizeName(raw: string): string {
  const upper = raw.toUpperCase().normalize("NFKD").replace(/[^A-Z0-9 ]/g, " ");
  const tokens = upper.split(/\s+/).filter((t) => t && !LEGAL_SUFFIXES.has(t));
  return tokens.join(" ").trim();
}

// Jaccard token overlap — cheap, transparent triage of fuzzy matches.
export function tokenOverlap(a: string, b: string): number {
  const as = new Set(a.split(" ").filter(Boolean));
  const bs = new Set(b.split(" ").filter(Boolean));
  if (as.size === 0 || bs.size === 0) return 0;
  let inter = 0;
  for (const t of as) if (bs.has(t)) inter++;
  return inter / new Set([...as, ...bs]).size;
}

interface SupplierRow {
  id: string;
  company_name: string | null;
}

export async function ingestCandidates(
  supabase: SupabaseClient,
  source: IngestSource,
  candidates: RiskCandidate[],
): Promise<IngestResult> {
  const { data: suppliers, error: supErr } = await supabase
    .from("suppliers")
    .select("id, company_name");
  if (supErr) throw supErr;

  // Pre-normalize candidates and index by normalized name for exact hits.
  const normCands = candidates
    .map((c) => ({ cand: c, norm: normalizeName(c.name) }))
    .filter((c) => c.norm.length > 0);
  const byNorm = new Map<string, { cand: RiskCandidate; norm: string }[]>();
  for (const nc of normCands) {
    const arr = byNorm.get(nc.norm) ?? [];
    arr.push(nc);
    byNorm.set(nc.norm, arr);
  }

  let matches = 0;
  let active = 0;
  let review = 0;

  for (const supplier of (suppliers ?? []) as SupplierRow[]) {
    if (!supplier.company_name) continue;
    const norm = normalizeName(supplier.company_name);
    if (!norm) continue;

    const matched: { cand: RiskCandidate; confidence: number }[] = [];
    const exact = byNorm.get(norm);
    if (exact) {
      for (const e of exact) matched.push({ cand: e.cand, confidence: 0.95 });
    } else {
      let best: { cand: RiskCandidate; confidence: number } | null = null;
      for (const nc of normCands) {
        const score = tokenOverlap(norm, nc.norm);
        if (score >= REVIEW_CONFIDENCE && (!best || score > best.confidence)) {
          best = { cand: nc.cand, confidence: Number(score.toFixed(2)) };
        }
      }
      if (best) matched.push(best);
    }

    for (const m of matched) {
      matches++;
      const { data: rec, error: recErr } = await supabase
        .from("risk_source_records")
        .insert({
          source_type: source.sourceType,
          source_url: source.sourceUrl,
          connector: source.connector,
          connector_version: source.connectorVersion,
          raw_payload: m.cand.rawPayload,
        })
        .select("id")
        .single();
      if (recErr) throw recErr;

      const isActive = m.confidence >= HIGH_CONFIDENCE;
      const eventKey = `${source.connector}:${supplier.id}:${m.cand.eventKeyId}`;
      const { error: evtErr } = await supabase.from("supplier_risk_events").upsert(
        {
          supplier_id: supplier.id,
          event_type: m.cand.eventType,
          dimension: m.cand.dimension,
          severity: m.cand.severity,
          entity_match_confidence: m.confidence,
          source_confidence: 1.0,
          status: isActive ? "open" : "under_review",
          evidence_status: isActive ? "verified" : "unconfirmed",
          source_record_id: rec.id,
          event_key: eventKey,
          occurred_at: m.cand.occurredAt ?? null,
          industry_relevance: {},
        },
        { onConflict: "event_key" },
      );
      if (evtErr) throw evtErr;
      if (isActive) active++;
      else review++;
    }
  }

  return {
    candidates: normCands.length,
    suppliers: suppliers?.length ?? 0,
    matches,
    active_events: active,
    review_events: review,
  };
}
