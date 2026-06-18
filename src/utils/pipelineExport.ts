import Papa from 'papaparse';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface ExportData {
  supplier_company_name: string;
  supplier_email: string;
  status: string;
  created_at: string;
  responded_at?: string;
  progress: number;
  documents_submitted: number;
  documents_required: number;
  time_in_stage_days: number;
  branch_name?: string;
}

export const exportToCSV = (data: ExportData[], filename: string = 'onboarding-pipeline') => {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const escapeXml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const columnName = (index: number) => {
  let name = '';
  for (let current = index + 1; current > 0; current = Math.floor((current - 1) / 26)) {
    name = String.fromCharCode(65 + ((current - 1) % 26)) + name;
  }
  return name;
};

const worksheetXml = (rows: unknown[][]) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rows.map((row, rowIndex) => `
    <row r="${rowIndex + 1}">${row.map((cell, columnIndex) => `
      <c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`).join('')}
    </row>`).join('')}
  </sheetData>
</worksheet>`;

export const exportToExcel = async (data: ExportData[], analytics: any, filename: string = 'onboarding-pipeline') => {
  const zip = new JSZip();
  const pipelineHeaders = Object.keys(data[0] ?? {
    supplier_company_name: '', supplier_email: '', status: '', created_at: '', progress: '',
  });
  const pipelineRows = [pipelineHeaders, ...data.map((row) => pipelineHeaders.map((key) => row[key as keyof ExportData]))];
  const analyticsRows = [
    ['Metric', 'Value'],
    ['Total Requests', analytics.total],
    ['In Progress', analytics.inProgress],
    ['Completed', analytics.completed],
    ['Conversion Rate', `${analytics.conversionRate}%`],
    ['Avg Time to Complete (days)', analytics.avgTimeToComplete],
  ];

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Pipeline Data" sheetId="1" r:id="rId1"/><sheet name="Analytics" sheetId="2" r:id="rId2"/></sheets>
</workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`);
  zip.file('xl/worksheets/sheet1.xml', worksheetXml(pipelineRows));
  zip.file('xl/worksheets/sheet2.xml', worksheetXml(analyticsRows));

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportToPDF = (data: ExportData[], analytics: any, filename: string = 'onboarding-pipeline') => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(20);
  doc.text('Onboarding Pipeline Report', 14, 22);
  
  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 30);
  
  // Analytics Summary
  doc.setFontSize(14);
  doc.text('Summary', 14, 42);
  doc.setFontSize(10);
  doc.text(`Total Requests: ${analytics.total}`, 14, 50);
  doc.text(`In Progress: ${analytics.inProgress}`, 14, 56);
  doc.text(`Completed: ${analytics.completed}`, 14, 62);
  doc.text(`Conversion Rate: ${analytics.conversionRate}%`, 14, 68);
  doc.text(`Avg Time to Complete: ${analytics.avgTimeToComplete} days`, 14, 74);
  
  // Pipeline Data Table
  autoTable(doc, {
    head: [['Supplier', 'Email', 'Status', 'Progress', 'Created', 'Days in Stage']],
    body: data.map(r => [
      r.supplier_company_name,
      r.supplier_email,
      r.status,
      `${r.progress}%`,
      format(new Date(r.created_at), 'PP'),
      r.time_in_stage_days
    ]),
    startY: 85,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [63, 81, 181] },
  });
  
  doc.save(`${filename}.pdf`);
};
