import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface PDFExportData {
  supplier: any;
  requests: any[];
  categoryStats: any[];
  overallStats: {
    totalRequests: number;
    approvedRequests: number;
    pendingRequests: number;
    rejectedRequests: number;
    complianceScore: number;
  };
  riskAssessment: {
    level: string;
    score: number;
    factors: string[];
  };
  buyerId: string;
}

export class PDFExportService {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  async generateSupplierReport(data: PDFExportData): Promise<void> {
    try {
      await this.addHeader(data);
      this.addSupplierOverview(data);
      this.addKeyMetrics(data);
      await this.addCharts(data);
      this.addRequestHistory(data);
      this.addFooter(data);
      
      const filename = `${data.supplier.company_name}_compliance_report_${format(new Date(), 'yyyy-MM-dd')}_${data.buyerId}.pdf`;
      this.doc.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  private async addHeader(data: PDFExportData): Promise<void> {
    // Header background
    this.doc.setFillColor(59, 130, 246); // blue-500
    this.doc.rect(0, 0, this.pageWidth, 40, 'F');
    
    // Title
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Supplier Compliance Report', this.margin, 25);
    
    // Subtitle
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Generated on ${format(new Date(), 'MMMM dd, yyyy')}`, this.margin, 35);
    
    // Reset text color
    this.doc.setTextColor(0, 0, 0);
  }

  private addSupplierOverview(data: PDFExportData): void {
    let currentY = 60;
    
    // Section title
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Supplier Overview', this.margin, currentY);
    currentY += 15;
    
    // Company details
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Company Name: ${data.supplier.company_name}`, this.margin, currentY);
    currentY += 8;
    this.doc.text(`Contact Email: ${data.supplier.contact_email || 'Not provided'}`, this.margin, currentY);
    currentY += 8;
    this.doc.text(`Industry: ${data.supplier.industry || 'Not specified'}`, this.margin, currentY);
    currentY += 15;
    
    // Risk assessment
    const riskColor = this.getRiskColor(data.riskAssessment.level);
    this.doc.setTextColor(...riskColor);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`Risk Level: ${data.riskAssessment.level.toUpperCase()}`, this.margin, currentY);
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont('helvetica', 'normal');
    currentY += 10;
    
    // Risk factors
    this.doc.text('Risk Factors:', this.margin, currentY);
    currentY += 8;
    data.riskAssessment.factors.forEach(factor => {
      this.doc.text(`• ${factor}`, this.margin + 5, currentY);
      currentY += 6;
    });
  }

  private addKeyMetrics(data: PDFExportData): void {
    let currentY = this.doc.internal.pageSize.getHeight() / 2 - 20;
    
    // Section title
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Key Metrics', this.margin, currentY);
    currentY += 15;
    
    // Metrics grid
    const metrics = [
      { label: 'Compliance Score', value: `${data.overallStats.complianceScore}%` },
      { label: 'Total Requests', value: data.overallStats.totalRequests.toString() },
      { label: 'Approved', value: data.overallStats.approvedRequests.toString() },
      { label: 'Pending', value: data.overallStats.pendingRequests.toString() },
      { label: 'Rejected', value: data.overallStats.rejectedRequests.toString() }
    ];
    
    const boxWidth = 35;
    const boxHeight = 25;
    const spacing = 5;
    
    metrics.forEach((metric, index) => {
      const x = this.margin + (index * (boxWidth + spacing));
      const y = currentY;
      
      // Box background
      this.doc.setFillColor(248, 250, 252); // gray-50
      this.doc.rect(x, y, boxWidth, boxHeight, 'F');
      
      // Box border
      this.doc.setDrawColor(226, 232, 240); // gray-200
      this.doc.rect(x, y, boxWidth, boxHeight, 'S');
      
      // Value
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(59, 130, 246); // blue-500
      const valueWidth = this.doc.getTextWidth(metric.value);
      this.doc.text(metric.value, x + (boxWidth - valueWidth) / 2, y + 12);
      
      // Label
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(100, 116, 139); // slate-500
      const labelWidth = this.doc.getTextWidth(metric.label);
      this.doc.text(metric.label, x + (boxWidth - labelWidth) / 2, y + 20);
    });
    
    this.doc.setTextColor(0, 0, 0);
  }

  private async addCharts(data: PDFExportData): Promise<void> {
    // This would capture charts from the DOM if they exist
    // For now, we'll add a placeholder section
    this.doc.addPage();
    
    let currentY = 30;
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Performance Analytics', this.margin, currentY);
    currentY += 20;
    
    // Status distribution text summary
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Request Status Distribution:', this.margin, currentY);
    currentY += 10;
    
    this.doc.setFont('helvetica', 'normal');
    const total = data.overallStats.totalRequests;
    if (total > 0) {
      this.doc.text(`• Approved: ${data.overallStats.approvedRequests} (${Math.round((data.overallStats.approvedRequests / total) * 100)}%)`, this.margin + 5, currentY);
      currentY += 8;
      this.doc.text(`• Pending: ${data.overallStats.pendingRequests} (${Math.round((data.overallStats.pendingRequests / total) * 100)}%)`, this.margin + 5, currentY);
      currentY += 8;
      this.doc.text(`• Rejected: ${data.overallStats.rejectedRequests} (${Math.round((data.overallStats.rejectedRequests / total) * 100)}%)`, this.margin + 5, currentY);
      currentY += 15;
    }
    
    // Category performance
    if (data.categoryStats.length > 0) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Category Performance:', this.margin, currentY);
      currentY += 10;
      
      this.doc.setFont('helvetica', 'normal');
      data.categoryStats.forEach(cat => {
        const score = cat.total > 0 ? Math.round((cat.approved / cat.total) * 100) : 0;
        this.doc.text(`• ${cat.category}: ${score}% (${cat.approved}/${cat.total})`, this.margin + 5, currentY);
        currentY += 8;
      });
    }
  }

  private addRequestHistory(data: PDFExportData): void {
    this.doc.addPage();
    
    let currentY = 30;
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Request History', this.margin, currentY);
    currentY += 15;
    
    if (data.requests.length === 0) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('No document requests found.', this.margin, currentY);
      return;
    }
    
    // Prepare table data
    const tableData = data.requests.slice(0, 20).map(req => [
      req.document_type || 'N/A',
      req.status || 'N/A',
      req.priority || 'N/A',
      req.created_at ? format(new Date(req.created_at), 'MMM dd, yyyy') : 'N/A',
      req.deadline ? format(new Date(req.deadline), 'MMM dd, yyyy') : 'N/A'
    ]);
    
    autoTable(this.doc, {
      head: [['Document Type', 'Status', 'Priority', 'Created', 'Deadline']],
      body: tableData,
      startY: currentY,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [59, 130, 246], // blue-500
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // gray-50
      },
      margin: { left: this.margin, right: this.margin },
    });
  }

  private addFooter(data: PDFExportData): void {
    const pageCount = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      
      // Footer line
      this.doc.setDrawColor(226, 232, 240); // gray-200
      this.doc.line(this.margin, this.pageHeight - 25, this.pageWidth - this.margin, this.pageHeight - 25);
      
      // Footer text
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(100, 116, 139); // slate-500
      
      const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
      this.doc.text(`Generated: ${timestamp}`, this.margin, this.pageHeight - 15);
      this.doc.text(`Buyer ID: ${data.buyerId}`, this.margin, this.pageHeight - 10);
      
      // Page number
      const pageText = `Page ${i} of ${pageCount}`;
      const pageTextWidth = this.doc.getTextWidth(pageText);
      this.doc.text(pageText, this.pageWidth - this.margin - pageTextWidth, this.pageHeight - 15);
    }
  }

  private getRiskColor(level: string): [number, number, number] {
    switch (level.toLowerCase()) {
      case 'high':
        return [239, 68, 68]; // red-500
      case 'medium':
        return [245, 158, 11]; // amber-500
      case 'low':
        return [34, 197, 94]; // green-500
      default:
        return [107, 114, 128]; // gray-500
    }
  }
}