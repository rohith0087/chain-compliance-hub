import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// First-class supplier compliance report. Data comes from supplier-report-v1
// (real computed compliance + an AI executive summary); this renders it into a
// branded, graph-rich PDF. Charts are drawn to an offscreen canvas and embedded.

export interface SupplierReportData {
  generated_at: string;
  supplier: { id: string; company_name: string; industry: string | null; contact_email: string | null; description: string | null; connection_status: string };
  compliance_score: number;
  metrics: { total: number; approved: number; pending: number; submitted: number; rejected: number; overdue: number };
  totals: { framework_requirements: number; compliant: number; open_gaps: number; frameworks: number };
  framework_coverage: Array<{ framework_code: string; total: number; compliant: number; gaps: number; pending: number }>;
  requirements: Array<{ framework_code: string; requirement: string; outcome: string; valid_until: string | null; explanation: string | null }>;
  recent_documents: Array<{ title: string; document_type: string | null; status: string; expiration_date: string | null; created_at: string }>;
  ai_summary: { headline: string; overall_assessment: string; strengths: string[]; risks: string[]; recommendations: string[] } | null;
}

// Brand palette (matches the app)
const BRAND = { primary: [37, 99, 235] as const, ink: [17, 24, 39] as const, sub: [107, 114, 128] as const, green: [16, 185, 129] as const, amber: [245, 158, 11] as const, red: [239, 68, 68] as const, track: [229, 231, 235] as const, panel: [247, 248, 250] as const };
const M = 40; // page margin

function scoreColor(pct: number): readonly [number, number, number] {
  if (pct >= 85) return BRAND.green;
  if (pct >= 50) return BRAND.amber;
  return BRAND.red;
}

function donutDataUrl(pct: number, rgb: readonly [number, number, number]): string {
  const size = 260;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const cx = size / 2, cy = size / 2, r = size / 2 - 22, lw = 26;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = lw; ctx.strokeStyle = '#E5E7EB'; ctx.stroke();
  if (pct > 0) {
    ctx.beginPath(); ctx.lineCap = 'round';
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (pct / 100));
    ctx.lineWidth = lw; ctx.strokeStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; ctx.stroke();
  }
  ctx.fillStyle = '#111827'; ctx.font = 'bold 60px Helvetica'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${pct}%`, cx, cy - 8);
  ctx.fillStyle = '#6B7280'; ctx.font = '18px Helvetica';
  ctx.fillText('Compliant', cx, cy + 34);
  return c.toDataURL('image/png');
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return String(iso); }
}

function outcomeRGB(outcome: string): readonly [number, number, number] {
  if (outcome === 'compliant' || outcome === 'not_applicable') return BRAND.green;
  if (outcome === 'missing' || outcome === 'expired' || outcome === 'noncompliant') return BRAND.red;
  return BRAND.amber;
}

export function supplierReportFileName(d: SupplierReportData): string {
  const name = d.supplier.company_name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  return `${name}-compliance-report-${new Date(d.generated_at).toISOString().slice(0, 10)}.pdf`;
}

export function renderSupplierReport(d: SupplierReportData): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const sc = scoreColor(d.compliance_score);

  // ---------- Header band ----------
  doc.setFillColor(...BRAND.primary); doc.rect(0, 0, W, 96, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(d.supplier.company_name, M, 44);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text([d.supplier.industry, d.supplier.connection_status].filter(Boolean).join('  ·  '), M, 64);
  doc.setFontSize(10); doc.setTextColor(219, 234, 254);
  doc.text('SUPPLIER COMPLIANCE REPORT', M, 82);
  doc.text(`Generated ${fmtDate(d.generated_at)}`, W - M, 82, { align: 'right' });

  // ---------- Score donut + KPI cards ----------
  let y = 122;
  const donut = donutDataUrl(d.compliance_score, sc);
  if (donut) doc.addImage(donut, 'PNG', M, y, 120, 120);

  const kpis: Array<[string, string, readonly [number, number, number]]> = [
    [`${d.totals.compliant}/${d.totals.framework_requirements}`, 'Requirements met', BRAND.ink],
    [String(d.totals.open_gaps), 'Open gaps', d.totals.open_gaps > 0 ? BRAND.red : BRAND.green],
    [String(d.metrics.pending + d.metrics.submitted), 'Pending review', BRAND.amber],
    [String(d.metrics.overdue), 'Overdue requests', d.metrics.overdue > 0 ? BRAND.red : BRAND.ink],
  ];
  const kx = M + 150, kw = (W - M - kx - 12) / 2, kh = 54;
  kpis.forEach((k, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = kx + col * (kw + 12), yy = y + row * (kh + 12);
    doc.setFillColor(...BRAND.panel); doc.roundedRect(x, yy, kw, kh, 8, 8, 'F');
    doc.setTextColor(...k[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(k[0], x + 14, yy + 26);
    doc.setTextColor(...BRAND.sub); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text(k[1], x + 14, yy + 44);
  });
  y += 140;

  // ---------- AI executive summary ----------
  if (d.ai_summary) {
    const s = d.ai_summary;
    doc.setTextColor(...BRAND.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('EXECUTIVE SUMMARY', M, y);
    doc.setTextColor(...BRAND.sub); doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
    doc.text('AI-generated · grounded in this supplier’s compliance record', W - M, y, { align: 'right' });
    y += 8;
    doc.setDrawColor(...BRAND.track); doc.setLineWidth(1); doc.line(M, y, W - M, y); y += 16;

    doc.setTextColor(...BRAND.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
    const headline = doc.splitTextToSize(s.headline, W - 2 * M); doc.text(headline, M, y); y += headline.length * 15 + 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...BRAND.ink);
    const assess = doc.splitTextToSize(s.overall_assessment, W - 2 * M); doc.text(assess, M, y); y += assess.length * 14 + 10;

    const lists: Array<[string, string[], readonly [number, number, number]]> = [
      ['Strengths', s.strengths, BRAND.green], ['Risks', s.risks, BRAND.red], ['Recommended actions', s.recommendations, BRAND.primary],
    ];
    for (const [label, items, color] of lists) {
      if (!items.length) continue;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...color); doc.text(label, M, y); y += 14;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...BRAND.ink);
      for (const it of items) {
        const lines = doc.splitTextToSize(it, W - 2 * M - 14);
        doc.setTextColor(...color); doc.text('•', M + 2, y); doc.setTextColor(...BRAND.ink); doc.text(lines, M + 14, y);
        y += lines.length * 13;
      }
      y += 6;
    }
    y += 4;
  }

  // ---------- Framework coverage bars ----------
  if (d.framework_coverage.length) {
    if (y > 640) { doc.addPage(); y = M; }
    doc.setTextColor(...BRAND.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('FRAMEWORK COVERAGE', M, y); y += 8;
    doc.setDrawColor(...BRAND.track); doc.line(M, y, W - M, y); y += 18;
    const barX = M + 110, barW = W - M - barX - 70;
    for (const f of d.framework_coverage) {
      const pct = f.total > 0 ? f.compliant / f.total : 0;
      const col = f.gaps > 0 ? BRAND.red : (f.compliant === f.total ? BRAND.green : BRAND.amber);
      doc.setTextColor(...BRAND.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.text(f.framework_code, M, y + 9);
      doc.setFillColor(...BRAND.track); doc.roundedRect(barX, y, barW, 12, 6, 6, 'F');
      if (pct > 0) { doc.setFillColor(...(col as readonly [number, number, number])); doc.roundedRect(barX, y, Math.max(barW * pct, 8), 12, 6, 6, 'F'); }
      doc.setTextColor(...BRAND.sub); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(`${f.compliant}/${f.total}${f.gaps ? ` · ${f.gaps} gap${f.gaps > 1 ? 's' : ''}` : ''}`, barX + barW + 8, y + 9);
      y += 24;
    }
    y += 6;
  }

  // ---------- Requirement status table ----------
  if (d.requirements.length) {
    if (y > 660) { doc.addPage(); y = M; }
    doc.setTextColor(...BRAND.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('REQUIREMENT STATUS', M, y); y += 12;
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Framework', 'Requirement', 'Status', 'Valid until']],
      body: d.requirements.map((r) => [r.framework_code, r.requirement, r.outcome.replace(/_/g, ' '), fmtDate(r.valid_until)]),
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [235, 237, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      columnStyles: { 0: { cellWidth: 78 }, 2: { cellWidth: 78 }, 3: { cellWidth: 72 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const rgb = outcomeRGB(d.requirements[data.row.index].outcome);
          data.cell.styles.textColor = [rgb[0], rgb[1], rgb[2]]; data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 24;
  }

  // ---------- Recent documents ----------
  if (d.recent_documents.length) {
    if (y > 680) { doc.addPage(); y = M; }
    doc.setTextColor(...BRAND.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('RECENT DOCUMENTS', M, y); y += 12;
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Document', 'Type', 'Status', 'Expires', 'Received']],
      body: d.recent_documents.map((r) => [r.title, r.document_type ?? '—', r.status.replace(/_/g, ' '), fmtDate(r.expiration_date), fmtDate(r.created_at)]),
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [235, 237, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
    });
  }

  // ---------- Footer on every page ----------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...BRAND.track); doc.setLineWidth(0.5); doc.line(M, H - 30, W - M, H - 30);
    doc.setTextColor(...BRAND.sub); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('TraceR2C · Confidential — generated from computed compliance data', M, H - 16);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 16, { align: 'right' });
  }

  return doc.output('blob');
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}
