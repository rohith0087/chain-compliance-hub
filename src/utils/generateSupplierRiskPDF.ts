import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SupplierRiskProfile } from '@/components/buyer/supplier-risk/riskData';

interface PDFLabelPack {
  supplier_risk_report?: string;
  supplier?: string;
  supplier_profile?: string;
}

interface PDFOptions {
  supplier: SupplierRiskProfile;
  userName: string;
  userEmail: string;
  terms?: PDFLabelPack;
}

const COLORS = {
  primary: [30, 64, 175] as [number, number, number],      // blue-800
  primaryLight: [219, 234, 254] as [number, number, number], // blue-100
  dark: [15, 23, 42] as [number, number, number],           // slate-900
  muted: [100, 116, 139] as [number, number, number],       // slate-500
  white: [255, 255, 255] as [number, number, number],
  bg: [248, 250, 252] as [number, number, number],          // slate-50
  border: [226, 232, 240] as [number, number, number],      // slate-200
  red: [220, 38, 38] as [number, number, number],
  redBg: [254, 226, 226] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  amberBg: [254, 243, 199] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  greenBg: [220, 252, 231] as [number, number, number],
};

function getRiskColor(level: string): [number, number, number] {
  if (level === 'High' || level === 'Critical') return COLORS.red;
  if (level === 'Medium' || level === 'Moderate') return COLORS.amber;
  return COLORS.green;
}

function getRiskBgColor(level: string): [number, number, number] {
  if (level === 'High' || level === 'Critical') return COLORS.redBg;
  if (level === 'Medium' || level === 'Moderate') return COLORS.amberBg;
  return COLORS.greenBg;
}

function getStatusColor(status: string): [number, number, number] {
  if (status === 'Approved' || status === 'Resolved') return COLORS.green;
  if (status === 'Pending' || status === 'Open') return COLORS.amber;
  return COLORS.red;
}

function getStatusBgColor(status: string): [number, number, number] {
  if (status === 'Approved' || status === 'Resolved') return COLORS.greenBg;
  if (status === 'Pending' || status === 'Open') return COLORS.amberBg;
  return COLORS.redBg;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(14, y, 4, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.dark);
  doc.text(title, 24, y + 10);
  return y + 22;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 270) {
    doc.addPage();
    return 20;
  }
  return y;
}

export function generateSupplierRiskPDF({ supplier, userName, userEmail, terms }: PDFOptions) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();
  const timestamp = now.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const titleLabel = terms?.supplier_risk_report || 'Supplier Risk Assessment';
  const subtitleLabel = terms?.supplier_risk_report
    ? `${terms.supplier_risk_report}`
    : 'Comprehensive Risk Report';

  // ─── PAGE 1: COVER + SUMMARY ───
  // Header band
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 52, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(titleLabel, 20, 24);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitleLabel, 20, 35);
  doc.setFontSize(9);
  doc.text(`Generated: ${timestamp}`, 20, 46);

  // Supplier name block
  let y = 64;
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(supplier.name, 20, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(`${supplier.industry} · ${supplier.industryDetail}`, 20, y);
  y += 6;
  doc.text(`HQ: ${supplier.hq}  ·  Facilities: ${supplier.facilities}  ·  Connected: ${supplier.connectedDate}`, 20, y);
  y += 6;
  doc.text(`Downloaded by: ${userName} (${userEmail})`, 20, y);

  // Risk Score Box
  y += 14;
  const scoreBoxW = pageWidth - 40;
  doc.setFillColor(...getRiskBgColor(supplier.scoreLevel));
  doc.roundedRect(20, y, scoreBoxW, 30, 3, 3, 'F');
  doc.setDrawColor(...getRiskColor(supplier.scoreLevel));
  doc.setLineWidth(0.5);
  doc.roundedRect(20, y, scoreBoxW, 30, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...getRiskColor(supplier.scoreLevel));
  doc.text(`${supplier.score}`, 32, y + 20);
  doc.setFontSize(12);
  doc.text(`/ 100`, 55, y + 20);

  doc.setFontSize(11);
  doc.setTextColor(...COLORS.dark);
  doc.text(`${supplier.scoreLevel} Risk`, 80, y + 14);
  const trendSign = supplier.trend >= 0 ? '+' : '';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Trend: ${trendSign}${supplier.trend} pts (7 days)`, 80, y + 22);
  y += 40;

  // Risk Breakdown table
  y = drawSectionTitle(doc, 'Risk Breakdown', y);
  autoTable(doc, {
    startY: y,
    head: [['Category', 'Score', 'Weight']],
    body: supplier.breakdown.map(b => {
      const totalScore = supplier.breakdown.reduce((sum, x) => sum + x.value, 0);
      const pct = totalScore > 0 ? Math.round((b.value / totalScore) * 100) : 0;
      return [b.label, `${b.value}`, `${pct}%`];
    }),
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 1: { halign: 'center', fontStyle: 'bold' }, 2: { halign: 'center' } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Score Explanation
  y = checkPageBreak(doc, y, 60);
  y = drawSectionTitle(doc, 'Score Explanation', y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.dark);
  supplier.scoreExplanation.forEach(exp => {
    y = checkPageBreak(doc, y, 12);
    const lines = doc.splitTextToSize(`• ${exp}`, pageWidth - 50);
    doc.text(lines, 24, y);
    y += lines.length * 5 + 2;
  });

  // ─── PAGE 2: KEY DRIVERS + SIGNALS ───
  doc.addPage();
  y = 20;
  y = drawSectionTitle(doc, 'Key Risk Drivers', y);
  autoTable(doc, {
    startY: y,
    head: [['Driver', 'Impact', 'Confidence', 'Source']],
    body: supplier.drivers.map(d => [d.description, `+${d.impact}`, d.confidence, d.source]),
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bg },
    margin: { left: 20, right: 20 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 25 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const impact = parseInt(String(data.cell.raw).replace('+', ''));
        if (impact >= 8) {
          data.cell.styles.textColor = COLORS.red;
        } else if (impact >= 5) {
          data.cell.styles.textColor = COLORS.amber;
        } else {
          data.cell.styles.textColor = COLORS.green;
        }
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // News Signals
  if (supplier.news.length > 0) {
    y = checkPageBreak(doc, y, 40);
    y = drawSectionTitle(doc, 'News Signals', y);
    autoTable(doc, {
      startY: y,
      head: [['Headline', 'Source', 'Time', 'Impact']],
      body: supplier.news.map(n => [n.headline, n.source, n.timestamp, `+${n.riskImpact}`]),
      theme: 'grid',
      headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.bg },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 80 },
        3: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const impact = parseInt(String(data.cell.raw).replace('+', ''));
          if (impact >= 7) data.cell.styles.textColor = COLORS.red;
          else if (impact >= 4) data.cell.styles.textColor = COLORS.amber;
          else data.cell.styles.textColor = COLORS.green;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Web Intelligence
  if (supplier.webSignals.length > 0) {
    y = checkPageBreak(doc, y, 40);
    y = drawSectionTitle(doc, 'Web Intelligence', y);
    autoTable(doc, {
      startY: y,
      head: [['Signal', 'Type', 'Confidence', 'Detail']],
      body: supplier.webSignals.map(w => [w.title, w.type, w.confidence, w.detail]),
      theme: 'grid',
      headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.bg },
      margin: { left: 20, right: 20 },
      columnStyles: { 0: { cellWidth: 40 }, 2: { halign: 'center', cellWidth: 22 } },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // ─── PAGE 3: REGULATORY & DOCUMENTS ───
  doc.addPage();
  y = 20;

  // Recalls
  if (supplier.recalls.length > 0) {
    y = drawSectionTitle(doc, 'Recall History', y);
    autoTable(doc, {
      startY: y,
      head: [['Event', 'Date', 'Product', 'Severity', 'Status', 'Agency']],
      body: supplier.recalls.map(r => [r.eventType, r.date, r.product, r.severity, r.status, r.agency]),
      theme: 'grid',
      headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.bg },
      margin: { left: 20, right: 20 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const sev = String(data.cell.raw);
          data.cell.styles.textColor = getRiskColor(sev);
          data.cell.styles.fillColor = getRiskBgColor(sev);
        }
        if (data.section === 'body' && data.column.index === 4) {
          const st = String(data.cell.raw);
          data.cell.styles.textColor = getStatusColor(st);
          data.cell.styles.fillColor = getStatusBgColor(st);
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  } else {
    y = drawSectionTitle(doc, 'Recall History', y);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text('No recalls found for this supplier.', 24, y);
    y += 12;
  }

  // Document Compliance
  y = checkPageBreak(doc, y, 40);
  y = drawSectionTitle(doc, `Document Compliance (Subscore: ${supplier.documentSubscore}/100)`, y);
  autoTable(doc, {
    startY: y,
    head: [['Document', 'Status', 'Expiry']],
    body: supplier.documents.map(d => [d.name, d.status, d.expiryDate]),
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const st = String(data.cell.raw);
        data.cell.styles.textColor = getStatusColor(st);
        data.cell.styles.fillColor = getStatusBgColor(st);
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // ─── PAGE 4: PROFILE & QUESTIONNAIRE ───
  doc.addPage();
  y = 20;
  y = drawSectionTitle(doc, 'Supplier Profile', y);

  // Profile info box
  doc.setFillColor(...COLORS.bg);
  doc.roundedRect(20, y, pageWidth - 40, 28, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.dark);
  doc.text(`Company: ${supplier.name}`, 26, y + 8);
  doc.text(`Industry: ${supplier.industry} — ${supplier.industryDetail}`, 26, y + 15);
  doc.text(`HQ: ${supplier.hq}  ·  Facilities: ${supplier.facilities}  ·  Connected: ${supplier.connectedDate}`, 26, y + 22);
  y += 36;

  // Monitoring sources
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Monitoring Sources:', 24, y);
  doc.setFont('helvetica', 'normal');
  doc.text(supplier.monitoringSources.join(', '), 70, y);
  y += 6;
  doc.text(`Next refresh: ${supplier.nextRefresh}`, 24, y);
  y += 14;

  // Questionnaire tables
  const qaSection = (title: string, data: { question: string; answer: string }[]) => {
    y = checkPageBreak(doc, y, 30);
    y = drawSectionTitle(doc, title, y);
    autoTable(doc, {
      startY: y,
      head: [['Question', 'Answer']],
      body: data.map(qa => [qa.question, qa.answer]),
      theme: 'grid',
      headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.bg },
      margin: { left: 20, right: 20 },
      columnStyles: { 0: { cellWidth: 80, fontStyle: 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  };

  qaSection('Operations', supplier.operations);
  qaSection('Quality & Compliance', supplier.quality);
  qaSection('Risk & Resilience', supplier.riskResilience);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Confidential — ${supplier.name} Risk Report — ${timestamp}`, 20, 288);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 40, 288);
  }

  // Save
  const dateStr = now.toISOString().slice(0, 10);
  const safeName = supplier.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`${safeName}_Risk_Report_${dateStr}.pdf`);
}
