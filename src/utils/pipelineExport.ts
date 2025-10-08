import Papa from 'papaparse';
import * as XLSX from 'xlsx';
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

export const exportToExcel = (data: ExportData[], analytics: any, filename: string = 'onboarding-pipeline') => {
  const wb = XLSX.utils.book_new();
  
  // Main data sheet
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Pipeline Data');
  
  // Analytics sheet
  const analyticsData = [
    { Metric: 'Total Requests', Value: analytics.total },
    { Metric: 'In Progress', Value: analytics.inProgress },
    { Metric: 'Completed', Value: analytics.completed },
    { Metric: 'Conversion Rate', Value: `${analytics.conversionRate}%` },
    { Metric: 'Avg Time to Complete (days)', Value: analytics.avgTimeToComplete },
  ];
  const wsAnalytics = XLSX.utils.json_to_sheet(analyticsData);
  XLSX.utils.book_append_sheet(wb, wsAnalytics, 'Analytics');
  
  XLSX.writeFile(wb, `${filename}.xlsx`);
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
