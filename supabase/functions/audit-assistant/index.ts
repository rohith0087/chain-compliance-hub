import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { z } from "npm:zod@3.23.8";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM_PROMPT = `You are an expert senior auditor and the user's Audit Assistant.

You help auditors plan engagements, review client evidence, identify gaps, draft findings, and explain audit posture.

Frameworks you are fluent in (cite the specific clause / standard whenever possible):
- ISO 9001, ISO 14001, ISO 27001 / 27002, ISO 22000
- SOC 2 (Trust Services Criteria)
- HACCP, GFSI, BRC, FSSC 22000
- Indian compliance: Companies Act 2013, CARO 2020, ICAI Standards on Auditing, GST Act, Income Tax Act 1961, SEBI LODR, FSSAI, Factories Act 1948, Labour Codes

Rules:
1. Ground every answer in the supplied client, engagement, evidence, and findings context. Never invent documents.
2. When proposing a finding, map it to a specific control or clause and provide a concise recommendation.
3. Cite evidence by document title and id when available. If evidence is missing or expired, say so clearly.
4. Use markdown. Be concise, precise, and practical for a working auditor.
5. Auto-Drafting: If you identify a gap or propose a finding, you MUST output a draft action at the very end of your message in this exact format:
[CREATE_FINDING: Short Title | Brief Recommendation | High/Medium/Low]
6. If the user asks for a database-changing action you cannot execute here, explain the next manual step instead of pretending it was saved.`;

const RequestSchema = z.object({
  messages: z.array(z.any()).default([]),
  clientId: z.string().uuid().optional(),
  engagementId: z.string().uuid().optional(),
});

interface AuditCtx {
  userId: string;
  buyerId: string;
  clientId?: string;
  engagementId?: string;
}

type DbClient = ReturnType<typeof createClient<any>>;

async function resolveBuyerId(sb: DbClient, userId: string): Promise<string | null> {
  const { data: tm } = await sb
    .from("company_users")
    .select("company_id")
    .eq("profile_id", userId)
    .eq("company_type", "buyer")
    .eq("status", "active")
    .maybeSingle();
  if (tm?.company_id) return tm.company_id as string;
  const { data: owner } = await sb.from("buyers").select("id").eq("profile_id", userId).maybeSingle();
  return (owner?.id as string) ?? null;
}

function messageText(message: any): string {
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.parts)) {
    return message.parts
      .filter((part: any) => part?.type === "text" && typeof part?.text === "string")
      .map((part: any) => part.text)
      .join("\n")
      .trim();
  }
  return "";
}

function messageRole(role: string): "user" | "assistant" {
  return role === "assistant" ? "assistant" : "user";
}

function expiryLabel(expirationDate?: string | null): string {
  if (!expirationDate) return "No expiry";
  const days = Math.ceil((new Date(expirationDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days <= 30) return `Expires in ${days}d`;
  return `Valid for ${days}d`;
}

async function buildContextSummary(sb: DbClient, ctx: AuditCtx) {
  if (!ctx.clientId) {
    return "No client is selected. Ask the user to choose a client from the left panel before giving engagement-specific advice.";
  }

  const [clientRes, engagementRes, findingsRes, evidenceRes, auditorRes, auditingCompanyRes] = await Promise.all([
    sb.from("suppliers").select("id, company_name, industry, country").eq("id", ctx.clientId).maybeSingle(),
    ctx.engagementId
      ? sb.from("document_requests").select("id, title, status, due_date").eq("id", ctx.engagementId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    (ctx.engagementId
      ? sb.from("audit_findings").select("id, title, severity, framework, clause_reference, recommendation, status, created_at").eq("buyer_id", ctx.buyerId).eq("supplier_id", ctx.clientId).eq("engagement_id", ctx.engagementId)
      : sb.from("audit_findings").select("id, title, severity, framework, clause_reference, recommendation, status, created_at").eq("buyer_id", ctx.buyerId).eq("supplier_id", ctx.clientId)
    )
      .order("created_at", { ascending: false })
      .limit(12),
    (() => {
      let query = sb
        .from("document_uploads")
        .select("id, document_name, file_name, status, expiration_date, content_summary, created_at, request_id, document_requests!inner(supplier_id, buyer_id, title, notes)")
        .eq("document_requests.supplier_id", ctx.clientId!)
        .eq("document_requests.buyer_id", ctx.buyerId)
        .order("created_at", { ascending: false })
        .limit(24);
      if (ctx.engagementId) query = query.eq("request_id", ctx.engagementId);
      return query;
    })(),
    sb.from("profiles").select("full_name, email").eq("id", ctx.userId).maybeSingle(),
    sb.from("buyers").select("company_name").eq("id", ctx.buyerId).maybeSingle(),
  ]);

  const client = clientRes.data;
  const engagement = engagementRes.data as any;
  const findings = (findingsRes.data ?? []) as any[];
  const evidence = (evidenceRes.data ?? []) as any[];
  const auditor = auditorRes.data;
  const auditingCompany = auditingCompanyRes.data;

  const evidenceCounts = evidence.reduce(
    (acc, item) => {
      const status = String(item.status ?? "unknown").toLowerCase();
      acc.total += 1;
      acc[status] = (acc[status] ?? 0) + 1;
      if (item.expiration_date && new Date(item.expiration_date).getTime() < Date.now()) acc.expired += 1;
      return acc;
    },
    { total: 0, expired: 0 } as Record<string, number>,
  );

  const findingsText = findings.length
    ? findings
        .map((finding, index) => {
          const clause = finding.clause_reference || finding.framework || "No clause mapped";
          return `${index + 1}. [${finding.severity ?? "Unrated"}] ${finding.title ?? "Untitled finding"} | ${clause} | status: ${finding.status ?? "Open"} | rec: ${finding.recommendation ?? "—"}`;
        })
        .join("\n")
    : "No findings recorded for this context.";

  const evidenceText = evidence.length
    ? evidence
        .map((doc, index) => {
          const name = doc.document_name || doc.file_name || "Untitled document";
          const summary = typeof doc.content_summary === "string" ? doc.content_summary.slice(0, 3000) : "No summary";
          const notes = doc.document_requests?.notes ? ` | auditor_notes: ${doc.document_requests.notes}` : "";
          return `${index + 1}. ${name} (id: ${doc.id}) | status: ${doc.status ?? "unknown"} | ${expiryLabel(doc.expiration_date)} | summary: ${summary}${notes}`;
        })
        .join("\n")
    : "No evidence documents found for this context.";

  return [
    `Context about YOU (the auditor's identity): You are speaking with ${auditor?.full_name ?? "an auditor"} who works for ${auditingCompany?.company_name ?? "the auditing company"}. Address them naturally when appropriate.`,
    `Active client: ${client?.company_name ?? "Unknown client"}`,
    `Industry: ${client?.industry ?? "Unknown"}`,
    `Country: ${client?.country ?? "Unknown"}`,
    engagement ? `Engagement: ${engagement.title ?? "Untitled"} | status: ${engagement.status ?? "unknown"} | due: ${engagement.due_date ?? "n/a"}` : "Engagement: none selected",
    `Findings count: ${findings.length}`,
    `Evidence count: ${evidenceCounts.total} | approved: ${evidenceCounts.approved ?? 0} | pending: ${evidenceCounts.pending ?? 0} | rejected: ${evidenceCounts.rejected ?? 0} | expired: ${evidenceCounts.expired ?? 0}`,
    "Recent findings:",
    findingsText,
    "Recent evidence:",
    evidenceText,
  ].join("\n\n");
}

async function callGateway(messages: Array<{ role: "user" | "assistant"; content: string }>, system: string, cors: Record<string, string>) {
  const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      stream: false,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => "");
    let message = errorText || `AI request failed (${upstream.status})`;
    if (upstream.status === 429) message = "Rate limit reached. Please wait a moment and try again.";
    if (upstream.status === 402) message = "AI credits exhausted. Please add credits in workspace settings.";
    return new Response(JSON.stringify({ error: message }), {
      status: upstream.status || 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const json = await upstream.json();
  const content = json?.choices?.[0]?.message?.content;
  let text = "";
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
      .map((p: any) => p.text)
      .join("");
  }

  if (!text.trim()) {
    return new Response(JSON.stringify({ error: "The assistant returned an empty response. Please try again." }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ text }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sbUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await sbUser.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const rl = checkRateLimit(`audit-assistant:${user.id}`, 60, 60_000);
    if (!rl.allowed) return rateLimitResponse(cors, rl.retryAfterMs);

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const buyerId = await resolveBuyerId(sb, user.id);
    if (!buyerId) {
      return new Response(JSON.stringify({ error: "Not a buyer/auditor account" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { messages, clientId, engagementId } = parsed.data;

    if (clientId) {
      const { data: ok } = await sb
        .from("buyer_supplier_connections")
        .select("id")
        .eq("buyer_id", buyerId)
        .eq("supplier_id", clientId)
        .maybeSingle();
      if (!ok) {
        return new Response(JSON.stringify({ error: "Client not connected to this auditor" }), {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    const gatewayMessages = messages
      .map((message: any) => ({ role: messageRole(message?.role), content: messageText(message) }))
      .filter((message: { content: string }) => message.content.trim().length > 0)
      .slice(-12);

    const ctx: AuditCtx = { userId: user.id, buyerId, clientId, engagementId };
    const contextSummary = await buildContextSummary(sb, ctx);
    const system = `${SYSTEM_PROMPT}\n\nWorking context:\n${contextSummary}`;

    return await callGateway(gatewayMessages, system, cors);
  } catch (err) {
    console.error("audit-assistant error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
