// Generate Audit Report PDF for an engagement.
// Called by the audit-assistant edge function or directly from UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYSTEM_SECRET = Deno.env.get("SYSTEM_INVOCATION_SECRET");

function wrap(text: string, max: number): string[] {
  const words = (text ?? "").split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { lines.push(cur); cur = w; }
    else cur = (cur ? cur + " " : "") + w;
  }
  if (cur) lines.push(cur);
  return lines;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req);

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    let { buyerId, clientId, engagementId, userId } = body as { buyerId?: string; clientId: string; engagementId?: string; userId?: string };

    const authHeader = req.headers.get("Authorization");
    const isSystem = authHeader === `Bearer ${SERVICE_KEY}` || (SYSTEM_SECRET && authHeader === `Bearer ${SYSTEM_SECRET}`);
    if (!isSystem) {
      if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      const sbUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await sbUser.auth.getUser();
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      userId = user.id;
      if (!buyerId) {
        const { data: tm } = await sb.from("company_users").select("company_id").eq("profile_id", user.id).eq("company_type", "buyer").eq("status", "active").maybeSingle();
        buyerId = (tm?.company_id as string) ?? null as any;
        if (!buyerId) {
          const { data: own } = await sb.from("buyers").select("id").eq("profile_id", user.id).maybeSingle();
          buyerId = (own?.id as string) ?? undefined;
        }
      }
    }
    if (!buyerId || !clientId) return new Response(JSON.stringify({ error: "buyerId and clientId required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const [client, buyer, findingsRes, evidenceRes, engagementRes] = await Promise.all([
      sb.from("suppliers").select("company_name, industry, country").eq("id", clientId).maybeSingle(),
      sb.from("buyers").select("company_name").eq("id", buyerId).maybeSingle(),
      (engagementId
        ? sb.from("audit_findings").select("*").eq("buyer_id", buyerId).eq("supplier_id", clientId).eq("engagement_id", engagementId)
        : sb.from("audit_findings").select("*").eq("buyer_id", buyerId).eq("supplier_id", clientId)
      ).order("severity", { ascending: false }),
      sb.from("document_uploads").select("file_name, document_type, status, expiration_date").eq("supplier_id", clientId).limit(50),
      engagementId ? sb.from("document_requests").select("title, status, due_date").eq("id", engagementId).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const findings = (findingsRes.data ?? []) as any[];
    const evidence = (evidenceRes.data ?? []) as any[];

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.11, 0.22, 0.42);
    const grey = rgb(0.35, 0.4, 0.45);
    let page = pdf.addPage([595, 842]);
    let y = 800;
    const margin = 50;

    const addPage = () => { page = pdf.addPage([595, 842]); y = 800; };
    const ensure = (need = 40) => { if (y - need < 60) addPage(); };
    const heading = (t: string, size = 16) => { ensure(size + 20); page.drawText(t, { x: margin, y, size, font: bold, color: navy }); y -= size + 8; };
    const text = (t: string, size = 10, color = rgb(0.1, 0.1, 0.1)) => {
      for (const line of wrap(t, Math.floor(495 / (size * 0.55)))) {
        ensure(size + 4);
        page.drawText(line, { x: margin, y, size, font, color });
        y -= size + 4;
      }
    };

    // Cover
    page.drawRectangle({ x: 0, y: 780, width: 595, height: 62, color: navy });
    page.drawText("AUDIT REPORT", { x: margin, y: 805, size: 22, font: bold, color: rgb(1, 1, 1) });
    y = 760;
    text(`Auditor: ${buyer.data?.company_name ?? "—"}`, 12);
    text(`Client: ${client.data?.company_name ?? "—"} (${client.data?.industry ?? "n/a"}, ${client.data?.country ?? ""})`, 12);
    if (engagementRes.data) text(`Engagement: ${(engagementRes.data as any).title}`, 12);
    text(`Issued: ${new Date().toLocaleDateString()}`, 10, grey);
    y -= 12;

    // Executive summary
    heading("Executive Summary");
    const sev = { Critical: 0, Major: 0, Minor: 0 } as Record<string, number>;
    findings.forEach((f) => { sev[f.severity] = (sev[f.severity] || 0) + 1; });
    text(`This report summarizes the audit performed by ${buyer.data?.company_name ?? "the auditor"} on ${client.data?.company_name ?? "the client"}. A total of ${findings.length} findings were identified: ${sev.Critical} critical, ${sev.Major} major, and ${sev.Minor} minor. ${evidence.length} pieces of evidence were reviewed.`);

    // Scope & methodology
    heading("Scope & Methodology");
    text("The engagement was performed in accordance with applicable Standards on Auditing (ICAI), CARO 2020 where relevant, and supporting international frameworks (ISO 9001/27001, SOC 2, HACCP). Evidence was obtained via documentation review, inquiry, and observation. Findings are rated by severity using likelihood × impact analysis.");

    // Findings
    heading("Findings");
    if (findings.length === 0) text("No findings recorded.", 10, grey);
    findings.forEach((f, i) => {
      ensure(80);
      page.drawText(`${i + 1}. ${f.title}`, { x: margin, y, size: 12, font: bold, color: navy });
      y -= 16;
      const sevColor = f.severity === "Critical" ? rgb(0.7, 0.1, 0.1) : f.severity === "Major" ? rgb(0.85, 0.45, 0.05) : rgb(0.4, 0.5, 0.2);
      page.drawText(`[${f.severity}]${f.framework ? "  " + f.framework : ""}${f.clause_reference ? " — " + f.clause_reference : ""}`, { x: margin, y, size: 9, font: bold, color: sevColor });
      y -= 14;
      if (f.description) text(`Observation: ${f.description}`);
      if (f.recommendation) text(`Recommendation: ${f.recommendation}`);
      y -= 6;
    });

    // Evidence appendix
    heading("Evidence Appendix");
    if (evidence.length === 0) text("No evidence recorded.", 10, grey);
    evidence.forEach((d) => {
      ensure(16);
      const exp = d.expiration_date ? ` (exp ${new Date(d.expiration_date).toLocaleDateString()})` : "";
      page.drawText(`• ${d.document_type ?? "Document"} — ${d.file_name ?? "n/a"} [${d.status}]${exp}`.slice(0, 100), { x: margin, y, size: 9, font, color: grey });
      y -= 12;
    });

    const bytes = await pdf.save();
    const fileName = `audit-report/${buyerId}/${clientId}/${Date.now()}.pdf`;
    const { error: upErr } = await sb.storage.from("documents").upload(fileName, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error("upload err", upErr);
      return new Response(JSON.stringify({ error: "Failed to store report" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const { data: signed } = await sb.storage.from("documents").createSignedUrl(fileName, 3600);

    if (engagementId) {
      await sb.from("audit_engagement_summaries").upsert({
        engagement_id: engagementId,
        client_id: clientId,
        buyer_id: buyerId,
        auditor_user_id: userId ?? null,
        report_url: signed?.signedUrl ?? null,
        report_generated_at: new Date().toISOString(),
      }, { onConflict: "engagement_id" });
    }

    return new Response(JSON.stringify({ ok: true, url: signed?.signedUrl, fileName, findings: findings.length }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("generate-audit-report error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
