// ingest-ofac-sanctions — Slice 2 connector.
//
// Fetches the OFAC SDN list, matches entries against this app's `suppliers` by
// normalized name, and writes provenance (`risk_source_records`) + buyer-agnostic
// `supplier_risk_events` (event_type='sanction_match'). Entity matching is the
// hard part: only HIGH-confidence matches become active events; MEDIUM matches
// are written as `under_review` so a human confirms them; LOW matches are dropped
// to avoid noise. This function NEVER computes a score.
//
// System-invoked (cron) only: guarded by validateSystemSecret. verify_jwt=false.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { isInternalSystemRequest, systemAuthErrorResponse } from "../_shared/systemAuth.ts";

const OFAC_SDN_CSV_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv";
const CONNECTOR = "ingest-ofac-sanctions";
const CONNECTOR_VERSION = "v1";
const SOURCE_TYPE = "ofac_sdn";

// Confidence thresholds for what a name match becomes.
const HIGH_CONFIDENCE = 0.9; // active event
const REVIEW_CONFIDENCE = 0.75; // under_review event

interface SdnEntry {
  entNum: string;
  name: string;
  type: string; // '', 'individual', 'vessel', 'aircraft'
  program: string;
}

interface SupplierRow {
  id: string;
  company_name: string | null;
  country: string | null;
}

// Legal-form words removed before comparison (do NOT over-strip — see plan §7).
const LEGAL_SUFFIXES = [
  "LLC", "LTD", "LIMITED", "INC", "INCORPORATED", "CORP", "CORPORATION", "CO",
  "COMPANY", "GMBH", "SA", "SAS", "BV", "PTE", "PLC", "GROUP", "HOLDING",
  "HOLDINGS", "INDUSTRIES", "INDUSTRY", "TRADING", "MANUFACTURING", "MFG",
];

function normalizeName(raw: string): string {
  const upper = raw.toUpperCase().normalize("NFKD").replace(/[^A-Z0-9 ]/g, " ");
  const tokens = upper.split(/\s+/).filter((t) => t && !LEGAL_SUFFIXES.includes(t));
  return tokens.join(" ").trim();
}

// Minimal CSV line parser (handles quoted fields with embedded commas).
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

function parseSdnCsv(text: string): SdnEntry[] {
  const entries: SdnEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    if (f.length < 4) continue;
    const name = f[1];
    if (!name || name === "-0-") continue;
    entries.push({
      entNum: f[0],
      name,
      type: f[2] === "-0-" ? "" : f[2],
      program: f[3] === "-0-" ? "" : f[3],
    });
  }
  return entries;
}

// Jaccard token overlap — cheap, transparent, good enough to triage matches.
function tokenOverlap(a: string, b: string): number {
  const as = new Set(a.split(" ").filter(Boolean));
  const bs = new Set(b.split(" ").filter(Boolean));
  if (as.size === 0 || bs.size === 0) return 0;
  let inter = 0;
  for (const t of as) if (bs.has(t)) inter++;
  return inter / new Set([...as, ...bs]).size;
}

interface Match {
  supplier: SupplierRow;
  entry: SdnEntry;
  confidence: number;
}

function matchSuppliers(suppliers: SupplierRow[], entries: SdnEntry[]): Match[] {
  // Index SDN entries by normalized name for exact hits.
  const byNorm = new Map<string, SdnEntry[]>();
  const normEntries: { norm: string; entry: SdnEntry }[] = [];
  for (const e of entries) {
    const norm = normalizeName(e.name);
    if (!norm) continue;
    normEntries.push({ norm, entry: e });
    const arr = byNorm.get(norm) ?? [];
    arr.push(e);
    byNorm.set(norm, arr);
  }

  const matches: Match[] = [];
  for (const supplier of suppliers) {
    if (!supplier.company_name) continue;
    const norm = normalizeName(supplier.company_name);
    if (!norm) continue;

    // Exact normalized match → high confidence.
    const exact = byNorm.get(norm);
    if (exact) {
      for (const entry of exact) matches.push({ supplier, entry, confidence: 0.95 });
      continue;
    }
    // Otherwise best token-overlap candidate, if it clears the review bar.
    let best: Match | null = null;
    for (const { norm: en, entry } of normEntries) {
      const score = tokenOverlap(norm, en);
      if (score >= REVIEW_CONFIDENCE && (!best || score > best.confidence)) {
        best = { supplier, entry, confidence: Number(score.toFixed(2)) };
      }
    }
    if (best) matches.push(best);
  }
  return matches;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Trusted internal invocation only (cron secret / service-role / env secret).
  if (!(await isInternalSystemRequest(req, supabase))) {
    return systemAuthErrorResponse(corsHeaders);
  }

  try {
    // 1. Fetch + parse the OFAC SDN list.
    const res = await fetch(OFAC_SDN_CSV_URL);
    if (!res.ok) throw new Error(`OFAC fetch failed: ${res.status}`);
    const csv = await res.text();
    const entries = parseSdnCsv(csv);

    // 2. Load suppliers to match against.
    const { data: suppliers, error: supErr } = await supabase
      .from("suppliers")
      .select("id, company_name, country");
    if (supErr) throw supErr;

    // 3. Match, then persist provenance + events (high/medium only).
    const matches = matchSuppliers((suppliers ?? []) as SupplierRow[], entries);

    let active = 0;
    let review = 0;
    for (const m of matches) {
      const { data: srcRec, error: srcErr } = await supabase
        .from("risk_source_records")
        .insert({
          source_type: SOURCE_TYPE,
          source_url: OFAC_SDN_CSV_URL,
          connector: CONNECTOR,
          connector_version: CONNECTOR_VERSION,
          raw_payload: m.entry,
        })
        .select("id")
        .single();
      if (srcErr) throw srcErr;

      const isActive = m.confidence >= HIGH_CONFIDENCE;
      const eventKey = `ofac:${m.supplier.id}:${m.entry.entNum}`;
      const { error: evtErr } = await supabase.from("supplier_risk_events").upsert(
        {
          supplier_id: m.supplier.id,
          event_type: "sanction_match",
          dimension: "regulatory",
          severity: 0.9,
          entity_match_confidence: m.confidence,
          source_confidence: 1.0,
          status: isActive ? "open" : "under_review",
          evidence_status: isActive ? "verified" : "unconfirmed",
          source_record_id: srcRec.id,
          event_key: eventKey,
          industry_relevance: {},
        },
        { onConflict: "event_key" },
      );
      if (evtErr) throw evtErr;
      if (isActive) active++;
      else review++;
    }

    const summary = {
      connector: CONNECTOR,
      sdn_entries: entries.length,
      suppliers: suppliers?.length ?? 0,
      matches: matches.length,
      active_events: active,
      review_events: review,
    };
    console.log("ingest-ofac-sanctions:", JSON.stringify(summary));
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error("ingest-ofac-sanctions error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
