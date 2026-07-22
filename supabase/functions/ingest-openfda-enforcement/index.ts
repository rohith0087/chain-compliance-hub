// ingest-openfda-enforcement — Slice 6 connector (targeted per-supplier search).
// For each known supplier, searches FDA food enforcement (recalls) for that firm
// and ingests hits as product_safety events. Targeted search (vs. bulk) is the
// right design for MONITORING known suppliers — it catches historical recalls.
// System-invoked only. verify_jwt=false.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { isInternalSystemRequest, systemAuthErrorResponse } from "../_shared/systemAuth.ts";
import { ingestCandidates, normalizeName, type RiskCandidate } from "../_shared/supplierRiskIngest.ts";

const CONNECTOR = "ingest-openfda-enforcement";
const CONNECTOR_VERSION = "v1";
const SOURCE_TYPE = "openfda_enforcement";
const ENDPOINT = "food";

interface FdaEnforcement {
  recall_number?: string;
  recalling_firm?: string;
  reason_for_recall?: string;
  classification?: string;
  report_date?: string;
  status?: string;
}

interface SupplierRow {
  id: string;
  company_name: string | null;
}

function severityFor(classification: string | undefined): number {
  switch (classification) {
    case "Class I":
      return 0.9;
    case "Class II":
      return 0.7;
    case "Class III":
      return 0.5;
    default:
      return 0.6;
  }
}

function toIsoDate(yyyymmdd: string | undefined): string | null {
  if (!yyyymmdd || yyyymmdd.length !== 8) return null;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  if (!(await isInternalSystemRequest(req, supabase))) {
    return systemAuthErrorResponse(corsHeaders);
  }

  try {
    const { data: suppliers, error: supErr } = await supabase
      .from("suppliers")
      .select("id, company_name");
    if (supErr) throw supErr;

    const candidates: RiskCandidate[] = [];
    let searched = 0;

    for (const s of (suppliers ?? []) as SupplierRow[]) {
      const term = normalizeName(s.company_name ?? "");
      // Skip empty/short/test-ish names to avoid noise and wasted calls.
      if (term.length < 5 || term.includes("TEST")) continue;
      searched++;

      const q = encodeURIComponent('"' + term + '"');
      const url = `https://api.fda.gov/${ENDPOINT}/enforcement.json?search=recalling_firm:${q}&limit=25`;
      const res = await fetch(url);
      if (!res.ok) continue; // 404 = no matches for this firm
      const body = (await res.json()) as { results?: FdaEnforcement[] };
      for (const r of body.results ?? []) {
        if (!r.recalling_firm) continue;
        candidates.push({
          name: r.recalling_firm,
          dimension: "product_safety",
          eventType: "product_recall",
          severity: severityFor(r.classification),
          occurredAt: toIsoDate(r.report_date),
          eventKeyId: `${ENDPOINT}:${r.recall_number ?? ""}`,
          rawPayload: {
            endpoint: ENDPOINT,
            recall_number: r.recall_number,
            recalling_firm: r.recalling_firm,
            classification: r.classification,
            reason_for_recall: r.reason_for_recall,
            report_date: r.report_date,
            status: r.status,
          },
        });
      }
    }

    const result = await ingestCandidates(
      supabase,
      { connector: CONNECTOR, connectorVersion: CONNECTOR_VERSION, sourceType: SOURCE_TYPE, sourceUrl: `https://api.fda.gov/${ENDPOINT}/enforcement.json` },
      candidates,
    );
    const summary = { connector: CONNECTOR, firms_searched: searched, ...result };
    console.log("ingest-openfda-enforcement:", JSON.stringify(summary));
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error("ingest-openfda-enforcement error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
