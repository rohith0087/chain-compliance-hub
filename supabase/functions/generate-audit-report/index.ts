// Generate Audit Report PDF for an engagement.
// Called by the audit-assistant edge function or directly from UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import jsPDF from "npm:jspdf@2.5.1";
import autoTable from "npm:jspdf-autotable@3.8.2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYSTEM_SECRET = Deno.env.get("SYSTEM_INVOCATION_SECRET");

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
      sb.from("document_uploads")
        .select("file_name, document_name, status, expiration_date, document_requests!inner(supplier_id, buyer_id)")
        .eq("document_requests.supplier_id", clientId)
        .eq("document_requests.buyer_id", buyerId)
        .limit(80),
      engagementId ? sb.from("document_requests").select("title, status, due_date").eq("id", engagementId).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const findings = (findingsRes.data ?? []) as any[];
    const evidence = (evidenceRes.data ?? []) as any[];

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 44;
    const navy: [number, number, number] = [28, 55, 90];
    const textColor: [number, number, number] = [24, 32, 44];
    const grey: [number, number, number] = [97, 110, 128];
    const light: [number, number, number] = [241, 245, 249];

    pdf.setFillColor(...navy);
    pdf.rect(0, 0, pageWidth, 88, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.text("AUDIT REPORT", margin, 48);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Auditor: ${buyer.data?.company_name ?? "—"}`, margin, 68);
    pdf.text(`Client: ${client.data?.company_name ?? "—"}`, margin, 84);

    pdf.setTextColor(...textColor);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    let y = 124;

    const writeSection = (title: string, body: string) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.setTextColor(...navy);
      pdf.text(title, margin, y);
      y += 18;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      pdf.setTextColor(...textColor);
      const lines = pdf.splitTextToSize(body, pageWidth - margin * 2);
      pdf.text(lines, margin, y);
      y += lines.length * 14 + 16;
    };

    const sev = { Critical: 0, Major: 0, Minor: 0 } as Record<string, number>;
    findings.forEach((f) => { sev[f.severity] = (sev[f.severity] || 0) + 1; });

    writeSection(
      "Executive Summary",
      `This report summarizes the audit performed by ${buyer.data?.company_name ?? "the auditor"} on ${client.data?.company_name ?? "the client"}. A total of ${findings.length} findings were identified: ${sev.Critical} critical, ${sev.Major} major, and ${sev.Minor} minor. ${evidence.length} pieces of evidence were reviewed.${engagementRes.data ? ` Engagement: ${(engagementRes.data as any).title}.` : ""} Issued: ${new Date().toLocaleDateString()}.`
    );

    writeSection(
      "Scope & Methodology",
      "The engagement was performed in accordance with applicable Standards on Auditing (ICAI), CARO 2020 where relevant, and supporting international frameworks including ISO 9001, ISO 27001, SOC 2, and HACCP where applicable. Evidence was obtained through documentation review, inquiry, and observation. Findings are rated using likelihood and impact based scoping."
    );

    autoTable(pdf, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6, textColor },
      headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: light },
      head: [["#", "Finding", "Severity", "Framework", "Clause", "Recommendation"]],
      body: findings.length
        ? findings.map((f, i) => [
            String(i + 1),
            f.title ?? "—",
            f.severity ?? "—",
            f.framework ?? "—",
            f.clause_reference ?? "—",
            (f.recommendation ?? "—").slice(0, 160),
          ])
        : [["—", "No findings recorded", "—", "—", "—", "—"]],
      margin: { left: margin, right: margin },
    });

    const findingsEndY = (pdf as any).lastAutoTable?.finalY ?? y;
    autoTable(pdf, {
      startY: findingsEndY + 24,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 5, textColor },
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: light },
      head: [["Evidence", "Status", "Expiration"]],
      body: evidence.length
        ? evidence.map((d) => [
            d.document_name || d.file_name || "Document",
            d.status || "—",
            d.expiration_date ? new Date(d.expiration_date).toLocaleDateString() : "—",
          ])
        : [["No evidence recorded", "—", "—"]],
      margin: { left: margin, right: margin, bottom: 42 },
      didDrawPage: () => {
        pdf.setFontSize(9);
        pdf.setTextColor(...grey);
        pdf.text(String(pdf.getCurrentPageInfo().pageNumber), pageWidth - margin, pageHeight - 18, { align: "right" });
      },
    });

    const bytes = pdf.output("arraybuffer");
    const fileName = `audit-report/${buyerId}/${clientId}/${Date.now()}.pdf`;
    const { error: upErr } = await sb.storage.from("compliance-documents").upload(fileName, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error("upload err", upErr);
      return new Response(JSON.stringify({ error: "Failed to store report" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const { data: signed } = await sb.storage.from("compliance-documents").createSignedUrl(fileName, 3600);

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
