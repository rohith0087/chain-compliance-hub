// ingest-ofac-sanctions — Slice 2 connector (refactored onto the shared matcher).
// Fetches the OFAC SDN list and ingests entries as regulatory sanction_match
// events via the shared matcher. System-invoked only. verify_jwt=false.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { isInternalSystemRequest, systemAuthErrorResponse } from "../_shared/systemAuth.ts";
import { ingestCandidates, type RiskCandidate } from "../_shared/supplierRiskIngest.ts";

const OFAC_SDN_CSV_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv";
const CONNECTOR = "ingest-ofac-sanctions";
const CONNECTOR_VERSION = "v1";
const SOURCE_TYPE = "ofac_sdn";

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
    const res = await fetch(OFAC_SDN_CSV_URL);
    if (!res.ok) throw new Error(`OFAC fetch failed: ${res.status}`);
    const csv = await res.text();

    const candidates: RiskCandidate[] = [];
    for (const line of csv.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const f = parseCsvLine(line);
      if (f.length < 4) continue;
      const name = f[1];
      if (!name || name === "-0-") continue;
      candidates.push({
        name,
        dimension: "regulatory",
        eventType: "sanction_match",
        severity: 0.9,
        eventKeyId: f[0], // ent_num
        rawPayload: { entNum: f[0], name, type: f[2] === "-0-" ? "" : f[2], program: f[3] === "-0-" ? "" : f[3] },
      });
    }

    const result = await ingestCandidates(
      supabase,
      { connector: CONNECTOR, connectorVersion: CONNECTOR_VERSION, sourceType: SOURCE_TYPE, sourceUrl: OFAC_SDN_CSV_URL },
      candidates,
    );
    const summary = { connector: CONNECTOR, sdn_entries: candidates.length, ...result };
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
