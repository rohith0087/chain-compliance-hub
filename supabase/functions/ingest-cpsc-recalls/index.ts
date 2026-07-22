// ingest-cpsc-recalls — Slice 6 connector.
// Fetches recent CPSC product recalls, extracts the firms associated with each
// (manufacturers / importers / distributors), and ingests them as product_safety
// events via the shared matcher. System-invoked only. verify_jwt=false.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { isInternalSystemRequest, systemAuthErrorResponse } from "../_shared/systemAuth.ts";
import { ingestCandidates, type RiskCandidate } from "../_shared/supplierRiskIngest.ts";

const CONNECTOR = "ingest-cpsc-recalls";
const CONNECTOR_VERSION = "v1";
const SOURCE_TYPE = "cpsc_recall";

interface CpscFirm {
  Name?: string;
}
interface CpscRecall {
  RecallID?: number;
  RecallNumber?: string;
  RecallDate?: string; // "2025-01-30T00:00:00"
  Title?: string;
  Manufacturers?: CpscFirm[];
  Importers?: CpscFirm[];
  Distributors?: CpscFirm[];
}

function firmNames(r: CpscRecall): string[] {
  const names = [
    ...(r.Manufacturers ?? []),
    ...(r.Importers ?? []),
    ...(r.Distributors ?? []),
  ]
    .map((f) => (f?.Name ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(names));
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
    // Recalls from the last ~2 years.
    const start = new Date();
    start.setFullYear(start.getFullYear() - 2);
    const startStr = start.toISOString().slice(0, 10);
    const url = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=${startStr}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`CPSC fetch failed: ${res.status}`);
    const recalls = (await res.json()) as CpscRecall[];

    const candidates: RiskCandidate[] = [];
    for (const r of recalls) {
      const occurredAt = r.RecallDate ? r.RecallDate.slice(0, 10) : null;
      const keyBase = r.RecallNumber ?? String(r.RecallID ?? "");
      for (const name of firmNames(r)) {
        candidates.push({
          name,
          dimension: "product_safety",
          eventType: "product_recall",
          severity: 0.7,
          occurredAt,
          eventKeyId: keyBase,
          rawPayload: {
            RecallNumber: r.RecallNumber,
            RecallDate: r.RecallDate,
            Title: r.Title,
            Firm: name,
          },
        });
      }
    }

    const result = await ingestCandidates(
      supabase,
      { connector: CONNECTOR, connectorVersion: CONNECTOR_VERSION, sourceType: SOURCE_TYPE, sourceUrl: url },
      candidates,
    );
    const summary = { connector: CONNECTOR, recalls: recalls.length, ...result };
    console.log("ingest-cpsc-recalls:", JSON.stringify(summary));
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error("ingest-cpsc-recalls error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
