import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { riskLevelOf, RISK_DIMENSION_LABELS, type RiskDimension } from '@/features/supplier-risk/templates';
import { documentTypeLabel, frameworkLabel, requirementLabel, outcomeLabel, documentStatusLabel } from './reportLabels';

// Supplier compliance & risk assessment — a decision-grade, point-in-time
// record rather than a dashboard export.
//
// The governing rule here: every number is named and scoped. An earlier
// version emitted a single "compliance score" that meant requirements-met to
// the renderer and requests-approved to the AI, so the same page could assert
// "0% compliant" and "score of 64". The three measures below are deliberately
// kept separate and always labelled:
//   requirement_completion — framework requirements with accepted evidence
//   document_approval      — document requests approved out of those raised
//   risk.score             — 0-100 where HIGHER MEANS MORE RISK
//
// Nothing is fabricated. Fields the platform does not record (supplier owner,
// business criticality, per-requirement criticality, waivers) are omitted
// rather than invented, because invented values in a compliance report are
// indistinguishable from falsified audit evidence.

export interface SupplierReportData {
  report_id?: string;
  generated_at: string;
  supplier: {
    id: string; company_name: string; industry: string | null; contact_email: string | null;
    description: string | null; connection_status: string; connected_since?: string | null;
  };
  /** @deprecated ambiguous; retained for older payloads. Prefer document_approval. */
  compliance_score: number;
  requirement_completion?: { compliant: number; total: number; pending: number; gaps: number; pct: number | null };
  document_approval?: { approved: number; total: number; pct: number | null };
  risk?: {
    score: number; level: 'High' | 'Medium' | 'Low'; previous_score: number | null; delta: number | null;
    dimension_scores: Record<string, number> | null; change_reasons: unknown;
    policy_version: string | null; engine_version: string | null; calculated_at: string | null;
  } | null;
  metrics: {
    total: number; approved: number; pending: number; submitted: number; rejected: number; overdue: number;
    avg_reply_days?: number | null; on_time_rate?: number | null;
    fastest_reply_days?: number | null; slowest_reply_days?: number | null;
  };
  totals: { framework_requirements: number; compliant: number; open_gaps: number; frameworks: number };
  framework_coverage: Array<{ framework_code: string; total: number; compliant: number; gaps: number; pending: number }>;
  requirements: Array<{
    framework_code: string; framework_version?: string | null; requirement: string; requirement_key?: string | null;
    outcome: string; valid_until: string | null; explanation: string | null;
    evidence_count?: number; is_overridden?: boolean; evaluated_at?: string | null;
  }>;
  recent_documents: Array<{ title: string; document_type: string | null; status: string; expiration_date: string | null; created_at: string }>;
  expiring_soon?: Array<{ title: string; document_type: string | null; expiration_date: string | null; days_remaining: number }>;
  overdue_requests?: Array<{ title: string; document_type: string | null; due_date: string | null; days_overdue: number }>;
  activity_trend?: Array<{ month: string; requested: number; received: number }>;
  ai_summary: { headline: string; overall_assessment: string; strengths: string[]; risks: string[]; recommendations: string[] } | null;
  ai_summary_meta?: { from_cache: boolean; generated_at: string | null };
}

const BRAND = {
  primary: [37, 99, 235] as const,
  ink: [17, 24, 39] as const,
  sub: [107, 114, 128] as const,
  green: [16, 185, 129] as const,
  amber: [245, 158, 11] as const,
  red: [239, 68, 68] as const,
  track: [229, 231, 235] as const,
  panel: [247, 248, 250] as const,
};
const M = 40;

type RGB = readonly [number, number, number];

const riskRGB = (level: 'High' | 'Medium' | 'Low'): RGB =>
  level === 'High' ? BRAND.red : level === 'Medium' ? BRAND.amber : BRAND.green;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return String(iso); }
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
  } catch { return String(iso); }
}

function outcomeRGB(outcome: string): RGB {
  if (outcome === 'compliant' || outcome === 'not_applicable') return BRAND.green;
  if (outcome === 'missing' || outcome === 'expired' || outcome === 'noncompliant') return BRAND.red;
  return BRAND.amber;
}

export function supplierReportFileName(d: SupplierReportData): string {
  const name = d.supplier.company_name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  return `${name}-compliance-report-${new Date(d.generated_at).toISOString().slice(0, 10)}.pdf`;
}

/** Requirement completion %, or null when no requirements are in scope yet. */
export function requirementScore(d: SupplierReportData): number | null {
  if (d.requirement_completion) return d.requirement_completion.pct;
  return d.totals.framework_requirements > 0
    ? Math.round((d.totals.compliant / d.totals.framework_requirements) * 100)
    : null;
}

/** Six-month requests-vs-received sparkline, drawn to an offscreen canvas. */
function trendDataUrl(trend: Array<{ month: string; requested: number; received: number }>): string {
  const W = 640, H = 150, pad = 26;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
  const max = Math.max(1, ...trend.flatMap((t) => [t.requested, t.received]));
  const bw = (W - pad * 2) / trend.length;
  ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad + ((H - pad * 2) * i) / 4;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
  }
  trend.forEach((t, i) => {
    const x = pad + i * bw;
    const h1 = ((H - pad * 2) * t.requested) / max;
    const h2 = ((H - pad * 2) * t.received) / max;
    ctx.fillStyle = '#93C5FD';
    ctx.fillRect(x + bw * 0.18, H - pad - h1, bw * 0.28, h1);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(x + bw * 0.54, H - pad - h2, bw * 0.28, h2);
    ctx.fillStyle = '#6B7280'; ctx.font = '13px Helvetica'; ctx.textAlign = 'center';
    ctx.fillText(t.month, x + bw / 2, H - 8);
  });
  return c.toDataURL('image/png');
}

export function renderSupplierReport(d: SupplierReportData): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const BOTTOM = H - 56;

  const rc = d.requirement_completion ?? {
    compliant: d.totals.compliant, total: d.totals.framework_requirements,
    pending: d.framework_coverage.reduce((a, f) => a + (f.pending ?? 0), 0),
    gaps: d.totals.open_gaps, pct: requirementScore(d),
  };
  const da = d.document_approval ?? {
    approved: d.metrics.approved, total: d.metrics.total,
    pct: d.metrics.total > 0 ? Math.round((d.metrics.approved / d.metrics.total) * 100) : null,
  };
  const risk = d.risk ?? null;
  const reportId = d.report_id ?? `SCR-${new Date(d.generated_at).toISOString().slice(0, 10).replace(/-/g, '')}`;

  let y = 0;
  const ensure = (needed: number) => { if (y + needed > BOTTOM) { doc.addPage(); y = M; } };

  const sectionHeader = (title: string, note?: string) => {
    ensure(40);
    doc.setTextColor(...BRAND.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
    doc.text(title, M, y);
    if (note) {
      doc.setTextColor(...BRAND.sub); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text(note, W - M, y, { align: 'right' });
    }
    y += 7;
    doc.setDrawColor(...BRAND.track); doc.setLineWidth(1); doc.line(M, y, W - M, y);
    y += 16;
  };

  // ══════════════ PAGE 1 — Executive summary ══════════════
  doc.setFillColor(...BRAND.primary); doc.rect(0, 0, W, 100, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text(d.supplier.company_name, M, 42);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  doc.text([d.supplier.industry, d.supplier.connection_status].filter(Boolean).join('  ·  '), M, 62);
  doc.setFontSize(9); doc.setTextColor(219, 234, 254);
  doc.text('SUPPLIER COMPLIANCE & RISK ASSESSMENT', M, 84);
  doc.text(reportId, W - M, 62, { align: 'right' });
  doc.text(`Assessed ${fmtDate(d.generated_at)}`, W - M, 84, { align: 'right' });

  y = 122;

  // ---- Risk classification banner (only when an assessment exists) ----
  if (risk) {
    const rgb = riskRGB(risk.level);
    doc.setFillColor(...BRAND.panel); doc.roundedRect(M, y, W - 2 * M, 66, 8, 8, 'F');
    doc.setFillColor(...rgb); doc.roundedRect(M, y, 5, 66, 2, 2, 'F');
    doc.setTextColor(...rgb); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
    doc.text(String(risk.score), M + 20, y + 34);
    doc.setFontSize(8.5); doc.setTextColor(...BRAND.sub); doc.setFont('helvetica', 'normal');
    doc.text('/100 risk', M + 20, y + 48);

    doc.setTextColor(...rgb); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(`${risk.level.toUpperCase()} RISK`, M + 92, y + 26);
    doc.setTextColor(...BRAND.sub); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text('Higher score = higher risk. Thresholds: High >= 67, Medium >= 34, Low < 34.', M + 92, y + 42);
    if (risk.delta !== null && risk.previous_score !== null) {
      const up = risk.delta > 0;
      const dRgb: RGB = risk.delta === 0 ? BRAND.sub : up ? BRAND.red : BRAND.green;
      doc.setTextColor(...dRgb); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      const arrow = risk.delta === 0 ? '=' : up ? '^' : 'v';
      doc.text(`${arrow} ${risk.delta > 0 ? '+' : ''}${risk.delta} vs previous (${risk.previous_score})`, M + 92, y + 56);
    }
    doc.setTextColor(...BRAND.sub); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(`Scored ${fmtDate(risk.calculated_at)}`, W - M - 14, y + 26, { align: 'right' });
    y += 82;
  } else {
    doc.setFillColor(...BRAND.panel); doc.roundedRect(M, y, W - 2 * M, 40, 8, 8, 'F');
    doc.setTextColor(...BRAND.sub); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text('No supplier risk assessment has been run for this supplier yet.', M + 16, y + 24);
    y += 56;
  }

  // ---- KPI row: each metric named, none blended ----
  const kpis: Array<[string, string, RGB]> = [
    [rc.total > 0 ? `${rc.compliant}/${rc.total}` : '—', 'Requirements met', rc.gaps > 0 ? BRAND.red : BRAND.ink],
    [String(rc.gaps), 'Open gaps', rc.gaps > 0 ? BRAND.red : BRAND.green],
    [String(rc.pending), 'Pending verification', BRAND.amber],
    [String(d.metrics.overdue), 'Overdue requests', d.metrics.overdue > 0 ? BRAND.red : BRAND.ink],
    [da.total > 0 ? `${da.approved}/${da.total}` : '—', 'Documents approved', BRAND.ink],
  ];
  const gap = 10;
  const kw = (W - 2 * M - gap * 4) / 5;
  kpis.forEach((k, i) => {
    const x = M + i * (kw + gap);
    doc.setFillColor(...BRAND.panel); doc.roundedRect(x, y, kw, 52, 8, 8, 'F');
    doc.setTextColor(...k[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(k[0], x + 10, y + 24);
    doc.setTextColor(...BRAND.sub); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(k[1], kw - 16), x + 10, y + 38);
  });
  y += 72;

  // ---- Automated assessment ----
  if (d.ai_summary) {
    const s = d.ai_summary;
    sectionHeader('AUTOMATED COMPLIANCE ASSESSMENT', 'AI-assisted · derived from the recorded data below');
    doc.setTextColor(...BRAND.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    const headline = doc.splitTextToSize(s.headline, W - 2 * M);
    ensure(headline.length * 15 + 20);
    doc.text(headline, M, y); y += headline.length * 14 + 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    const assess = doc.splitTextToSize(s.overall_assessment, W - 2 * M);
    ensure(assess.length * 13 + 10);
    doc.text(assess, M, y); y += assess.length * 13 + 12;

    const lists: Array<[string, string[], RGB]> = [
      ['Strengths', s.strengths, BRAND.green],
      ['Risks', s.risks, BRAND.red],
      ['Recommended actions', s.recommendations, BRAND.primary],
    ];
    for (const [label, items, color] of lists) {
      if (!items.length) continue;
      ensure(30);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...color);
      doc.text(label, M, y); y += 13;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      for (const it of items) {
        const lines = doc.splitTextToSize(it, W - 2 * M - 14);
        ensure(lines.length * 12 + 4);
        doc.setTextColor(...color); doc.text('•', M + 2, y);
        doc.setTextColor(...BRAND.ink); doc.text(lines, M + 14, y);
        y += lines.length * 12 + 2;
      }
      y += 6;
    }
  }

  // ---- Framework coverage ----
  if (d.framework_coverage.length) {
    sectionHeader('FRAMEWORK COVERAGE');
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Framework', 'Status', 'Met', 'Pending', 'Gaps']],
      body: d.framework_coverage.map((f) => {
        const status = f.gaps > 0 ? 'Action required' : f.pending > 0 ? 'Pending review' : f.total > 0 ? 'Complete' : 'No requirements';
        return [frameworkLabel(f.framework_code), status, `${f.compliant}/${f.total}`, String(f.pending), String(f.gaps)];
      }),
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [235, 237, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      columnStyles: { 2: { cellWidth: 52 }, 3: { cellWidth: 56 }, 4: { cellWidth: 46 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const f = d.framework_coverage[data.row.index];
          const rgb: RGB = f.gaps > 0 ? BRAND.red : f.pending > 0 ? BRAND.amber : BRAND.green;
          data.cell.styles.textColor = [rgb[0], rgb[1], rgb[2]];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 22;
  }

  // ---- Six-month activity trend ----
  const trend = d.activity_trend ?? [];
  if (trend.some((t) => t.requested > 0 || t.received > 0)) {
    ensure(150);
    sectionHeader('ACTIVITY — LAST 6 MONTHS', 'Requests raised (blue) vs. documents received (green)');
    const img = trendDataUrl(trend);
    if (img) { doc.addImage(img, 'PNG', M, y, W - 2 * M, 110); y += 124; }
  }

  // ══════════════ PAGE 2 — Requirements & evidence ══════════════
  if (d.requirements.length) {
    doc.addPage(); y = M;
    sectionHeader('COMPLIANCE REQUIREMENTS & EVIDENCE', `${d.requirements.length} requirement(s) in scope`);
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Requirement', 'Framework', 'Status', 'Evidence', 'Valid until']],
      body: d.requirements.map((r) => [
        requirementLabel(r.requirement),
        frameworkLabel(r.framework_code),
        outcomeLabel(r.outcome) + (r.is_overridden ? ' (override)' : ''),
        r.evidence_count && r.evidence_count > 0 ? `${r.evidence_count} linked` : '—',
        fmtDate(r.valid_until),
      ]),
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [235, 237, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      columnStyles: { 1: { cellWidth: 96 }, 2: { cellWidth: 92 }, 3: { cellWidth: 60 }, 4: { cellWidth: 66 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const rgb = outcomeRGB(d.requirements[data.row.index].outcome);
          data.cell.styles.textColor = [rgb[0], rgb[1], rgb[2]];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 22;
  }

  // ══════════════ PAGE 3 — Document & evidence register ══════════════
  const expiring = d.expiring_soon ?? [];
  const overdue = d.overdue_requests ?? [];
  if (expiring.length || overdue.length || d.recent_documents.length) {
    doc.addPage(); y = M;
    doc.setTextColor(...BRAND.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('Document & Evidence Register', M, y); y += 22;

    if (overdue.length) {
      sectionHeader('OVERDUE REQUESTS', 'Awaiting supplier response past the due date');
      autoTable(doc, {
        startY: y, margin: { left: M, right: M },
        head: [['Document', 'Due', 'Days overdue']],
        body: overdue.map((r) => [documentTypeLabel(r.title), fmtDate(r.due_date), String(r.days_overdue)]),
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [235, 237, 240], lineWidth: 0.5 },
        headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
        alternateRowStyles: { fillColor: [254, 250, 250] },
        columnStyles: { 1: { cellWidth: 90 }, 2: { cellWidth: 78 } },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 22;
    }

    if (expiring.length) {
      sectionHeader('EXPIRING WITHIN 90 DAYS', 'Renewals to schedule before evidence lapses');
      autoTable(doc, {
        startY: y, margin: { left: M, right: M },
        head: [['Document', 'Expires', 'Days remaining']],
        body: expiring.map((r) => [
          documentTypeLabel(r.title),
          fmtDate(r.expiration_date),
          r.days_remaining < 0 ? `Expired ${Math.abs(r.days_remaining)}d ago` : String(r.days_remaining),
        ]),
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [235, 237, 240], lineWidth: 0.5 },
        headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
        alternateRowStyles: { fillColor: [255, 252, 245] },
        columnStyles: { 1: { cellWidth: 90 }, 2: { cellWidth: 92 } },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 22;
    }

    if (d.recent_documents.length) {
      sectionHeader('RECENT SUBMISSIONS');
      autoTable(doc, {
        startY: y, margin: { left: M, right: M },
        head: [['Document', 'Type', 'Status', 'Expires', 'Received']],
        body: d.recent_documents.map((r) => [
          documentTypeLabel(r.title),
          documentTypeLabel(r.document_type),
          documentStatusLabel(r.status),
          fmtDate(r.expiration_date),
          fmtDate(r.created_at),
        ]),
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [235, 237, 240], lineWidth: 0.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
        alternateRowStyles: { fillColor: [250, 251, 252] },
        columnStyles: { 3: { cellWidth: 66 }, 4: { cellWidth: 66 } },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 22;
    }
  }

  // ══════════════ PAGE 4 — Methodology & audit ══════════════
  doc.addPage(); y = M;
  doc.setTextColor(...BRAND.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('Methodology & Audit Record', M, y); y += 22;

  sectionHeader('HOW EACH MEASURE IS CALCULATED', 'These are distinct measures on different bases');
  const measures: Array<[string, string, string]> = [
    ['Requirement completion',
      rc.total > 0 ? `${rc.compliant} of ${rc.total} (${rc.pct}%)` : 'No requirements in scope',
      'Framework requirements with accepted evidence, divided by requirements in scope. Higher is better. Requirements pending verification are not counted as failures.'],
    ['Document approval',
      da.total > 0 ? `${da.approved} of ${da.total} (${da.pct}%)` : 'No requests raised',
      'Document requests approved, divided by requests raised. Higher is better. Measures request throughput, not framework coverage.'],
    ['Supplier risk score',
      risk ? `${risk.score}/100 (${risk.level})` : 'Not assessed',
      'Weighted score across the risk dimensions configured for this buyer. HIGHER MEANS MORE RISK. Bands: High >= 67, Medium >= 34, Low < 34.'],
  ];
  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['Measure', 'This report', 'Definition']],
    body: measures,
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 6, lineColor: [235, 237, 240], lineWidth: 0.5, valign: 'top' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    columnStyles: { 0: { cellWidth: 118, fontStyle: 'bold' }, 1: { cellWidth: 104 } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 22;

  // Risk dimension breakdown, when the engine recorded one.
  if (risk?.dimension_scores && Object.keys(risk.dimension_scores).length) {
    sectionHeader('RISK DIMENSION BREAKDOWN');
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Dimension', 'Score']],
      body: Object.entries(risk.dimension_scores).map(([k, v]) => [
        RISK_DIMENSION_LABELS[k as RiskDimension] ?? k,
        String(Math.round(Number(v))),
      ]),
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [235, 237, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      columnStyles: { 1: { cellWidth: 70 } },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 22;
  }

  sectionHeader('STATUS DEFINITIONS');
  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['Status', 'Meaning']],
    body: [
      ['Met', 'Accepted evidence satisfies the requirement.'],
      ['Pending verification', 'Evidence has been supplied and is awaiting review. Not a failure.'],
      ['Missing evidence', 'No evidence has been supplied against the requirement.'],
      ['Expired', 'Evidence was accepted but has passed its validity date.'],
      ['Not met', 'Evidence was reviewed and did not satisfy the requirement.'],
      ['Not applicable', 'The requirement does not apply to this supplier.'],
      ['Override', 'Outcome was manually set by an authorised reviewer rather than computed.'],
    ],
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [235, 237, 240], lineWidth: 0.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    columnStyles: { 0: { cellWidth: 118, fontStyle: 'bold' } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 22;

  sectionHeader('AUDIT RECORD');
  const audit: Array<[string, string]> = [
    ['Report ID', reportId],
    ['Assessment generated', fmtDateTime(d.generated_at)],
    ['Supplier record ID', d.supplier.id],
    ['Connected since', fmtDate(d.supplier.connected_since)],
    ['Frameworks in scope', d.framework_coverage.map((f) => frameworkLabel(f.framework_code)).join(', ') || '—'],
    ['Risk policy version', risk?.policy_version ?? 'Not assessed'],
    ['Risk engine version', risk?.engine_version ?? 'Not assessed'],
    ['Risk last scored', risk ? fmtDateTime(risk.calculated_at) : 'Not assessed'],
    ['Narrative generated', d.ai_summary_meta?.generated_at ? fmtDateTime(d.ai_summary_meta.generated_at) : 'Not generated'],
    ['Data sources', 'Framework requirement evaluations, document requests and uploads, supplier risk scores.'],
  ];
  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['Field', 'Value']],
    body: audit,
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [235, 237, 240], lineWidth: 0.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    columnStyles: { 0: { cellWidth: 130, fontStyle: 'bold' } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 18;

  ensure(60);
  doc.setTextColor(...BRAND.sub); doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5);
  const disclaimer = doc.splitTextToSize(
    'This report reflects the evidence and requirement status recorded in TraceR2C as of the stated assessment time. ' +
    'The narrative assessment is generated automatically from that recorded data and is advisory; all figures are computed ' +
    'from the platform record, not from the narrative. Requirements shown as pending verification are awaiting review and ' +
    'are not findings of non-compliance.',
    W - 2 * M,
  );
  doc.text(disclaimer, M, y);

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BRAND.track); doc.setLineWidth(0.5); doc.line(M, H - 34, W - M, H - 34);
    doc.setTextColor(...BRAND.sub); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text('CONFIDENTIAL · TraceR2C Supplier Compliance Report', M, H - 21);
    doc.text(`${reportId} · Data as of ${fmtDateTime(d.generated_at)}`, M, H - 12);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 12, { align: 'right' });
  }

  return doc.output('blob');
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}
