import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DossierEvidenceLike {
  document_type: string | null;
  issuer: string | null;
  certificate_number: string | null;
  expiry_date: string | null;
  status: string;
}

interface DossierStatementLike {
  framework_code: string;
  framework_version: string;
  requirement_key: string;
  title: string;
  outcome: string;
  explanation: string;
  citation: string | null;
  evidence: DossierEvidenceLike[];
}

interface DossierContentSnapshotLike {
  subject_type: string;
  subject_display_name: string;
  effective_at: string;
  generated_at: string;
  statements: DossierStatementLike[];
}

export interface DossierPdfInput {
  dossierId: string;
  versionNumber: number;
  contentHash: string;
  signature: string;
  contentSnapshot: DossierContentSnapshotLike;
}

const MARGIN = 14;

function outcomeLabel(outcome: string): string {
  return outcome.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase());
}

export function renderDossierPdf(input: DossierPdfInput): Blob {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text('Compliance Dossier', MARGIN, 20);

  doc.setFontSize(11);
  const snapshot = input.contentSnapshot;
  doc.text(`Subject: ${snapshot.subject_display_name} (${snapshot.subject_type})`, MARGIN, 30);
  doc.text(`Effective as of: ${snapshot.effective_at}`, MARGIN, 37);
  doc.text(`Generated: ${new Date(snapshot.generated_at).toLocaleString()}`, MARGIN, 44);
  doc.text(`Dossier version: ${input.versionNumber}`, MARGIN, 51);

  autoTable(doc, {
    startY: 60,
    head: [['Requirement', 'Framework', 'Outcome', 'Citation', 'Evidence']],
    body: snapshot.statements.map((statement) => [
      `${statement.title}\n${statement.explanation}`,
      `${statement.framework_code} ${statement.framework_version}`,
      outcomeLabel(statement.outcome),
      statement.citation || '-',
      statement.evidence.length
        ? statement.evidence.map((evidence) => `${evidence.document_type || 'Document'} (${evidence.status})`).join('\n')
        : 'None',
    ]),
    styles: { fontSize: 8, cellWidth: 'wrap' },
    columnStyles: { 0: { cellWidth: 60 } },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(120);
    const footer = `Dossier ${input.dossierId} v${input.versionNumber} | SHA-256: ${input.contentHash} | Signature: ${input.signature.slice(0, 32)}... | Page ${page} of ${pageCount}`;
    doc.text(footer, MARGIN, doc.internal.pageSize.getHeight() - 8, { maxWidth: pageWidth - MARGIN * 2 });
  }

  return doc.output('blob');
}

export function dossierPdfFileName(input: DossierPdfInput): string {
  const subjectSlug = input.contentSnapshot.subject_display_name.replace(/[^a-zA-Z0-9]+/g, '_');
  return `${subjectSlug}_dossier_v${input.versionNumber}.pdf`;
}
