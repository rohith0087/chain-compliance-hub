// Audit Assistant: streaming AI chat with audit-domain tools.
// Frameworks: ISO 9001/14001/27001, SOC 2, HACCP/GFSI,
// Indian: Companies Act 2013, CARO 2020, ICAI Standards on Auditing, GST, Income Tax, SEBI LODR.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "npm:ai@4.3.16";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@0.2.14";
import { z } from "npm:zod@3.23.8";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM_PROMPT = `You are an expert senior auditor and the user's Audit Assistant.

You help auditors plan engagements, review client evidence, identify gaps, draft findings, and produce audit reports.

Frameworks you are fluent in (cite the specific clause / standard whenever possible):
- ISO 9001, ISO 14001, ISO 27001 / 27002, ISO 22000
- SOC 2 (Trust Services Criteria)
- HACCP, GFSI, BRC, FSSC 22000
- Indian compliance: Companies Act 2013, CARO 2020 (Companies Auditor's Report Order),
  ICAI Standards on Auditing (SA 200 series), GST Act, Income Tax Act 1961,
  SEBI LODR, FSSAI, Factories Act 1948, Labour Codes.

Rules:
1. Always use tools to ground answers in the auditor's actual client + engagement data. Never invent evidence.
2. When proposing a finding, ALWAYS map it to a specific control / clause and provide a recommendation.
3. Cite evidence by document title and id. If evidence is missing or expired, flag it.
4. Use markdown. Be concise but precise. Use tables for risk matrices and findings lists.
5. When the user asks to save a finding, call createFinding. When they ask for the report, call generateAuditReport.`;

interface AuditCtx {
  userId: string;
  buyerId: string;
  clientId?: string;
  engagementId?: string;
}

async function resolveBuyerId(sb: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data: tm } = await sb.from("company_users").select("company_id").eq("profile_id", userId).eq("company_type", "buyer").eq("status", "active").maybeSingle();
  if (tm?.company_id) return tm.company_id as string;
  const { data: owner } = await sb.from("buyers").select("id").eq("profile_id", userId).maybeSingle();
  return (owner?.id as string) ?? null;
}

function makeTools(sb: ReturnType<typeof createClient>, ctx: AuditCtx) {
  return {
    getClientProfile: tool({
      description: "Fetch the active client (supplier) profile, industry, contacts.",
      inputSchema: z.object({ clientId: z.string().uuid().optional() }),
      execute: async ({ clientId }) => {
        const id = clientId || ctx.clientId;
        if (!id) return { error: "No client selected" };
        const { data: c } = await sb.from("suppliers").select("id, company_name, industry, contact_email, contact_phone, country, address").eq("id", id).maybeSingle();
        return c ?? { error: "Client not found" };
      },
    }),

    listEngagements: tool({
      description: "List engagements (document requests) for the active client.",
      inputSchema: z.object({ clientId: z.string().uuid().optional() }),
      execute: async ({ clientId }) => {
        const id = clientId || ctx.clientId;
        if (!id) return { error: "No client selected" };
        const { data } = await sb.from("document_requests")
          .select("id, title, status, due_date, created_at, supplier_type")
          .eq("buyer_id", ctx.buyerId).eq("supplier_id", id)
          .order("created_at", { ascending: false }).limit(50);
        return { engagements: data ?? [] };
      },
    }),

    listEvidence: tool({
      description: "List evidence documents for the active client (and optionally engagement). Includes status and expiration.",
      inputSchema: z.object({
        clientId: z.string().uuid().optional(),
        engagementId: z.string().uuid().optional(),
        statusFilter: z.enum(["all", "approved", "pending", "rejected", "expired"]).optional(),
      }),
      execute: async ({ clientId, engagementId, statusFilter }) => {
        const cid = clientId || ctx.clientId;
        if (!cid) return { error: "No client selected" };
        let q = sb.from("document_uploads")
          .select("id, document_type, file_name, status, expiration_date, created_at, request_id, ai_summary")
          .eq("supplier_id", cid).order("created_at", { ascending: false }).limit(100);
        const eid = engagementId || ctx.engagementId;
        if (eid) q = q.eq("request_id", eid);
        const { data, error } = await q;
        if (error) return { error: error.message };
        let docs = data ?? [];
        if (statusFilter && statusFilter !== "all") {
          docs = docs.filter((d: any) => (d.status ?? "").toLowerCase().includes(statusFilter));
        }
        const today = new Date();
        const enriched = docs.map((d: any) => {
          let expiry: string | null = null;
          if (d.expiration_date) {
            const days = Math.ceil((new Date(d.expiration_date).getTime() - today.getTime()) / 86400000);
            expiry = days < 0 ? `EXPIRED ${Math.abs(days)}d ago` : days <= 30 ? `Expires in ${days}d` : `OK (${days}d left)`;
          }
          return { ...d, expiry_label: expiry };
        });
        return { count: enriched.length, evidence: enriched };
      },
    }),

    getDocumentContent: tool({
      description: "Get the AI-extracted content/summary for a single evidence document.",
      inputSchema: z.object({ documentId: z.string().uuid() }),
      execute: async ({ documentId }) => {
        const { data } = await sb.from("document_uploads").select("id, file_name, document_type, ai_summary, extracted_content, status, expiration_date").eq("id", documentId).maybeSingle();
        return data ?? { error: "Document not found" };
      },
    }),

    assessRisk: tool({
      description: "Compute an audit risk matrix from the current evidence: missing, expired, expiring-soon, rejected items. Returns rated rows.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!ctx.clientId) return { error: "No client selected" };
        const { data: docs } = await sb.from("document_uploads")
          .select("id, document_type, status, expiration_date")
          .eq("supplier_id", ctx.clientId);
        const today = new Date();
        const matrix: { area: string; risk: "High" | "Medium" | "Low"; likelihood: number; impact: number; note: string }[] = [];
        (docs ?? []).forEach((d: any) => {
          const status = (d.status ?? "").toLowerCase();
          if (status === "rejected") matrix.push({ area: d.document_type, risk: "High", likelihood: 5, impact: 4, note: "Rejected — control gap" });
          else if (d.expiration_date) {
            const days = Math.ceil((new Date(d.expiration_date).getTime() - today.getTime()) / 86400000);
            if (days < 0) matrix.push({ area: d.document_type, risk: "High", likelihood: 5, impact: 5, note: `Expired ${Math.abs(days)}d ago` });
            else if (days <= 30) matrix.push({ area: d.document_type, risk: "Medium", likelihood: 4, impact: 3, note: `Expires in ${days}d` });
          } else if (status === "pending" || status === "submitted") {
            matrix.push({ area: d.document_type, risk: "Medium", likelihood: 3, impact: 3, note: "Awaiting review" });
          }
        });
        return { count: matrix.length, matrix };
      },
    }),

    createFinding: tool({
      description: "Save a new audit finding to the database. Use after the user confirms.",
      inputSchema: z.object({
        title: z.string().min(3),
        description: z.string(),
        severity: z.enum(["Minor", "Major", "Critical"]),
        framework: z.string().optional().describe("e.g. 'CARO 2020 §3(ix)' or 'ISO 27001 A.8.2'"),
        clauseReference: z.string().optional(),
        recommendation: z.string(),
        evidenceDocIds: z.array(z.string().uuid()).optional(),
      }),
      execute: async (input) => {
        if (!ctx.clientId) return { error: "No client selected" };
        const { data, error } = await sb.from("audit_findings").insert({
          buyer_id: ctx.buyerId,
          supplier_id: ctx.clientId,
          engagement_id: ctx.engagementId ?? null,
          title: input.title,
          description: input.description,
          severity: input.severity,
          status: "Open",
          framework: input.framework ?? null,
          clause_reference: input.clauseReference ?? null,
          recommendation: input.recommendation,
          evidence_doc_ids: input.evidenceDocIds ?? [],
          finding_date: new Date().toISOString().slice(0, 10),
          created_by: ctx.userId,
        }).select("id").single();
        if (error) return { error: error.message };
        return { ok: true, findingId: data!.id };
      },
    }),

    listFindings: tool({
      description: "List existing audit findings for the active client / engagement.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!ctx.clientId) return { findings: [] };
        let q = sb.from("audit_findings").select("*").eq("buyer_id", ctx.buyerId).eq("supplier_id", ctx.clientId);
        if (ctx.engagementId) q = q.eq("engagement_id", ctx.engagementId);
        const { data } = await q.order("created_at", { ascending: false }).limit(50);
        return { findings: data ?? [] };
      },
    }),

    generateAuditReport: tool({
      description: "Generate the PDF audit report for the active engagement. Returns a download URL.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!ctx.clientId) return { error: "No client selected" };
        const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-audit-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ buyerId: ctx.buyerId, clientId: ctx.clientId, engagementId: ctx.engagementId, userId: ctx.userId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { error: json.error || "Report generation failed" };
        return json;
      },
    }),
  };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const sbUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await sbUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const rl = checkRateLimit(`audit-assistant:${user.id}`, 60, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetIn, cors);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const buyerId = await resolveBuyerId(sb, user.id);
    if (!buyerId) return new Response(JSON.stringify({ error: "Not a buyer/auditor account" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

    const body = await req.json();
    const messages: UIMessage[] = body.messages ?? [];
    const clientId: string | undefined = body.clientId;
    const engagementId: string | undefined = body.engagementId;

    if (clientId) {
      const { data: ok } = await sb.from("buyer_supplier_connections").select("id").eq("buyer_id", buyerId).eq("supplier_id", clientId).maybeSingle();
      if (!ok) return new Response(JSON.stringify({ error: "Client not connected to this auditor" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const provider = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": LOVABLE_API_KEY, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const model = provider("google/gemini-2.5-flash");

    const ctx: AuditCtx = { userId: user.id, buyerId, clientId, engagementId };
    const tools = makeTools(sb, ctx);

    const contextNote = clientId
      ? `\n\nActive context: clientId=${clientId}${engagementId ? `, engagementId=${engagementId}` : ""}. Use the tools to fetch real data before answering.`
      : `\n\nNo client is currently selected. Ask the user to pick a client from the left panel before doing engagement-specific work.`;

    const result = streamText({
      model,
      system: SYSTEM_PROMPT + contextNote,
      messages: convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(50),
    });

    return result.toUIMessageStreamResponse({ headers: cors });
  } catch (err) {
    console.error("audit-assistant error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
