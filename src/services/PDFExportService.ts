import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';

interface PDFExportData {
  supplier: {
    company_name: string;
    email: string;
    phone?: string;
    industry?: string;
    country?: string;
  };
  requests: any[];
  uploads: any[];
  categoryStats: any[];
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  submittedRequests: number;
  complianceScore: number;
  riskLevel: string;
  buyerId: string;
  averageResponseTime: number;
  overdueRequests: number;
}

export class PDFExportService {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 20;
  }

  async generateSupplierReport(data: PDFExportData, reportType: 'standard' | 'detailed' = 'standard'): Promise<void> {
    // Consume credits before generating report
    const { data: creditResult, error } = await supabase.functions.invoke('consume-credits', {
      body: { 
        reportType,
        description: `${reportType} compliance report for ${data.supplier?.company_name}`,
        referenceId: data.buyerId,
        referenceType: 'buyer'
      }
    });

    if (error) {
      console.error('Error consuming credits:', error);
      throw new Error('Failed to process credit payment for report generation');
    }

    if (!creditResult?.success) {
      throw new Error(creditResult?.error || 'Insufficient credits for report generation');
    }

    // Page 1: Executive Summary & Overview
    await this.addExecutiveSummary(data);
    this.addSupplierOverview(data);

    // Page 2: Visual Analytics
    this.doc.addPage();
    await this.addVisualAnalytics(data);

    // Page 3: Performance Analysis
    this.doc.addPage();
    await this.addPerformanceAnalysis(data);

    // Page 4: Request History & Recommendations
    this.doc.addPage();
    this.addRequestHistory(data);
    this.addRecommendations(data);

    // Add footer to all pages
    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.addFooter(data, i, pageCount);
    }

    // Save the PDF with formatted filename
    const timestamp = new Date().toISOString().split('T')[0];
    const companyName = this.safeText(data.supplier?.company_name).replace(/[^a-zA-Z0-9]/g, '_');
    this.doc.save(`${companyName}_compliance_report_${timestamp}_${data.buyerId}.pdf`);
  }

  private async addExecutiveSummary(data: PDFExportData): Promise<void> {
    // Professional header with gradient effect
    this.doc.setFillColor(30, 58, 138); // Dark blue
    this.doc.rect(0, 0, this.pageWidth, 50, 'F');

    // Header text
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(28);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('SUPPLIER COMPLIANCE REPORT', this.margin, 25);

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(this.safeText(data.supplier?.company_name).toUpperCase(), this.margin, 35);

    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    this.doc.text(`Report Generated: ${date}`, this.margin, 42);

    // Reset text color
    this.doc.setTextColor(0, 0, 0);

    // Executive Summary Box
    const summaryY = 60;
    this.doc.setFillColor(248, 250, 252); // Light gray background
    this.doc.rect(this.margin, summaryY, this.pageWidth - 2 * this.margin, 60, 'F');
    this.doc.setDrawColor(203, 213, 225);
    this.doc.rect(this.margin, summaryY, this.pageWidth - 2 * this.margin, 60, 'S');

    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(30, 58, 138);
    this.doc.text('EXECUTIVE SUMMARY', this.margin + 10, summaryY + 15);

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);

    const summary = [
      `• Overall Compliance Score: ${this.safeNumber(data.complianceScore)}% (${this.getPerformanceRating(data.complianceScore)})`,
      `• Risk Assessment: ${this.safeText(data.riskLevel)} Risk Level`,
      `• Total Requests Processed: ${this.safeNumber(data.totalRequests)}`,
      `• Average Response Time: ${this.safeNumber(data.averageResponseTime)} days`,
      `• Outstanding Issues: ${this.safeNumber(data.pendingRequests + data.overdueRequests)} pending/overdue requests`
    ];

    summary.forEach((line, index) => {
      this.doc.text(line, this.margin + 10, summaryY + 30 + (index * 7));
    });
  }

  private getPerformanceRating(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Fair';
    return 'Needs Improvement';
  }

  private addSupplierOverview(data: PDFExportData): void {
    let yPos = 135;

    // Company Information Section
    this.doc.setFillColor(239, 246, 255); // Light blue background
    this.doc.rect(this.margin, yPos, this.pageWidth - 2 * this.margin, 80, 'F');
    this.doc.setDrawColor(59, 130, 246);
    this.doc.rect(this.margin, yPos, this.pageWidth - 2 * this.margin, 80, 'S');

    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(30, 58, 138);
    this.doc.text('COMPANY INFORMATION', this.margin + 10, yPos + 15);

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);

    const companyInfo = [
      { label: 'Company Name:', value: this.safeText(data.supplier?.company_name) },
      { label: 'Email:', value: this.safeText(data.supplier?.email) },
      { label: 'Phone:', value: this.safeText(data.supplier?.phone) || 'Not provided' },
      { label: 'Industry:', value: this.safeText(data.supplier?.industry) || 'Not specified' },
      { label: 'Country:', value: this.safeText(data.supplier?.country) || 'Not specified' }
    ];

    companyInfo.forEach((item, index) => {
      const y = yPos + 30 + (index * 10);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(item.label, this.margin + 10, y);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(item.value, this.margin + 70, y);
    });

    // Risk Assessment Badge
    const riskY = yPos + 15;
    const riskX = this.pageWidth - 80;
    const riskColor = this.getRiskColor(data.riskLevel);

    this.doc.setFillColor(riskColor[0], riskColor[1], riskColor[2]);
    this.doc.roundedRect(riskX, riskY - 5, 60, 20, 3, 3, 'F');

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`${this.safeText(data.riskLevel).toUpperCase()} RISK`, riskX + 30, riskY + 7, { align: 'center' });

    this.doc.setTextColor(0, 0, 0);
  }

  private async addVisualAnalytics(data: PDFExportData): Promise<void> {
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(30, 58, 138);
    this.doc.text('VISUAL ANALYTICS DASHBOARD', this.margin, 30);
    this.doc.setTextColor(0, 0, 0);

    // Row 1: Compliance Score and Status Distribution
    const topY = 50;
    const leftX = this.margin;
    const rightX = this.pageWidth / 2 + 10;
    
    // Left Column - Compliance Score Circle
    await this.drawComplianceScoreCircle(data.complianceScore, leftX, topY);
    
    // Right Column - Status Distribution Legend
    await this.drawStatusPieChart(data, rightX, topY);
    
    // Define a starting Y position below the first row of visuals
    let yPos = 140; 

    // Section 1: Category Performance (takes up the left side, labels can extend right)
    await this.drawCategoryBarChart(data.categoryStats, leftX, yPos);

    // Calculate the height of the category chart and add padding
    const categoryStatsCount = Math.min(data.categoryStats.length, 5);
    const categoryChartHeight = 10 + (categoryStatsCount * 15); // Approximate height: title + bars
    yPos += categoryChartHeight + 15; // Move Y position down for the next component

    // Section 2: Risk Assessment (now full-width and positioned below the category chart)
    await this.drawRiskGauge(data.riskLevel, data.complianceScore, leftX, yPos);
  }

  private async drawComplianceScoreCircle(score: number, x: number, y: number): Promise<void> {
    const radius = 30;
    const centerX = x + radius;
    const centerY = y + radius;

    // Draw background circle
    this.doc.setDrawColor(229, 231, 235);
    this.doc.setLineWidth(8);
    this.doc.circle(centerX, centerY, radius, 'S');

    // Draw progress arc
    const progressColor = score >= 80 ? [34, 197, 94] : score >= 60 ? [251, 191, 36] : [239, 68, 68];
    this.doc.setDrawColor(progressColor[0], progressColor[1], progressColor[2]);

    // Calculate arc
    const angle = (score / 100) * 360;
    const startAngle = -90;
    const endAngle = startAngle + angle;

    // Draw the arc (simplified circle for now since jsPDF doesn't have native arc support)
    if (score > 0) {
      this.doc.circle(centerX, centerY, radius - 2, 'S');
    }

    // Add text
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`${score}%`, centerX, centerY + 2, { align: 'center' });

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Compliance Score', centerX, centerY + 12, { align: 'center' });
  }

  private async drawStatusPieChart(data: PDFExportData, x: number, y: number): Promise<void> {
    const radius = 25;
    const centerX = x + radius;
    const centerY = y + radius;

    const total = data.totalRequests;
    if (total === 0) return;

    const slices = [
      { value: data.approvedRequests, color: [34, 197, 94], label: 'Approved' },
      { value: data.pendingRequests, color: [251, 191, 36], label: 'Pending' },
      { value: data.rejectedRequests, color: [239, 68, 68], label: 'Rejected' },
      { value: data.submittedRequests, color: [59, 130, 246], label: 'Submitted' }
    ];

    // Draw simplified pie chart as rectangles for legend
    let legendY = y + 60;
    slices.forEach((slice, index) => {
      if (slice.value > 0) {
        this.doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
        this.doc.rect(x, legendY + (index * 12), 8, 8, 'F');
        
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(0, 0, 0);
        this.doc.text(`${slice.label}: ${slice.value} (${Math.round((slice.value / total) * 100)}%)`, x + 12, legendY + (index * 12) + 6);
      }
    });

    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Request Status Distribution', x, y - 5);
  }

  private async drawCategoryBarChart(categoryStats: any[], x: number, y: number): Promise<void> {
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Category Performance', x, y - 5);

    const barWidth = 100;
    const barHeight = 8;

    categoryStats.slice(0, 5).forEach((category, index) => {
      const barY = y + (index * 15);
      const percentage = Math.round((category.approved / category.total) * 100) || 0;
      
      // Background bar
      this.doc.setFillColor(229, 231, 235);
      this.doc.rect(x, barY, barWidth, barHeight, 'F');
      
      // Progress bar
      const progressWidth = (percentage / 100) * barWidth;
      const color = percentage >= 80 ? [34, 197, 94] : percentage >= 60 ? [251, 191, 36] : [239, 68, 68];
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.rect(x, barY, progressWidth, barHeight, 'F');
      
      // Label
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(0, 0, 0);
      this.doc.text(`${category.category}: ${percentage}%`, x + barWidth + 5, barY + 6);
    });
  }

  private async drawRiskGauge(riskLevel: string, score: number, x: number, y: number): Promise<void> {
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Risk Assessment', x, y - 5);
    
    // Make the gauge width responsive to the page margins
    const gaugeWidth = this.pageWidth - (2 * this.margin);
    const gaugeHeight = 20;
    
    // Risk level indicator colors
    const riskColors = {
      'Low': [34, 197, 94],
      'Medium': [251, 191, 36],
      'High': [239, 68, 68]
    };
    
    const color = riskColors[riskLevel as keyof typeof riskColors] || [229, 231, 235];
    
    // To match the example image, the entire bar is filled with the risk color
    // instead of showing a progress-style indicator.
    this.doc.setFillColor(color[0], color[1], color[2]);
    this.doc.rect(x, y, gaugeWidth, gaugeHeight, 'F');
    
    // Add centered text inside the colored bar
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(255, 255, 255); // White text for better contrast
    this.doc.text(`${riskLevel.toUpperCase()} RISK`, x + gaugeWidth / 2, y + gaugeHeight / 2 + 3, { align: 'center' });
    this.doc.setTextColor(0, 0, 0); // Reset text color
  }

  private async addPerformanceAnalysis(data: PDFExportData): Promise<void> {
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(30, 58, 138);
    this.doc.text('PERFORMANCE ANALYSIS', this.margin, 30);
    this.doc.setTextColor(0, 0, 0);

    // Key Performance Indicators
    const kpiY = 50;
    this.drawKPISection(data, kpiY);

    // Detailed Category Analysis
    const categoryY = 120;
    this.drawDetailedCategoryAnalysis(data.categoryStats, categoryY);

    // Performance Trends
    const trendsY = 180;
    this.drawPerformanceTrends(data, trendsY);
  }

  private drawKPISection(data: PDFExportData, y: number): void {
    this.doc.setFillColor(248, 250, 252);
    this.doc.rect(this.margin, y, this.pageWidth - 2 * this.margin, 60, 'F');
    this.doc.setDrawColor(203, 213, 225);
    this.doc.rect(this.margin, y, this.pageWidth - 2 * this.margin, 60, 'S');

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(30, 58, 138);
    this.doc.text('KEY PERFORMANCE INDICATORS', this.margin + 10, y + 15);

    const kpis = [
      { label: 'Compliance Score', value: `${data.complianceScore}%`, target: '≥80%' },
      { label: 'Response Time', value: `${data.averageResponseTime} days`, target: '≤5 days' },
      { label: 'Success Rate', value: `${Math.round((data.approvedRequests / data.totalRequests) * 100)}%`, target: '≥90%' },
      { label: 'Overdue Requests', value: `${data.overdueRequests}`, target: '0' }
    ];

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);

    kpis.forEach((kpi, index) => {
      const x = this.margin + 10 + (index % 2) * 80;
      const kpiY = y + 30 + Math.floor(index / 2) * 15;
      
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${kpi.label}:`, x, kpiY);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`${kpi.value} (Target: ${kpi.target})`, x, kpiY + 7);
    });
  }

  private drawDetailedCategoryAnalysis(categoryStats: any[], y: number): void {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(30, 58, 138);
    this.doc.text('DETAILED CATEGORY ANALYSIS', this.margin, y);
    this.doc.setTextColor(0, 0, 0);

    if (categoryStats.length === 0) {
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('No category data available', this.margin, y + 15);
      return;
    }

    const headers = ['Category', 'Total', 'Approved', 'Pending', 'Success Rate'];
    const rows = categoryStats.slice(0, 8).map(cat => [
      cat.category,
      cat.total.toString(),
      cat.approved.toString(),
      cat.pending.toString(),
      `${Math.round((cat.approved / cat.total) * 100)}%`
    ]);

    autoTable(this.doc, {
      startY: y + 10,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' }
      }
    });
  }

  private drawPerformanceTrends(data: PDFExportData, y: number): void {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(30, 58, 138);
    this.doc.text('PERFORMANCE INSIGHTS', this.margin, y);
    this.doc.setTextColor(0, 0, 0);

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');

    const insights = [
      `• Total document requests processed: ${data.totalRequests}`,
      `• Current approval rate: ${Math.round((data.approvedRequests / data.totalRequests) * 100)}%`,
      `• Pending requests requiring attention: ${data.pendingRequests}`,
      `• Average response time: ${data.averageResponseTime} days`,
      `• Risk assessment level: ${data.riskLevel}`
    ];

    insights.forEach((insight, index) => {
      this.doc.text(insight, this.margin, y + 15 + (index * 8));
    });
  }

  private addRequestHistory(data: PDFExportData): void {
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(30, 58, 138);
    this.doc.text('REQUEST HISTORY', this.margin, 30);
    this.doc.setTextColor(0, 0, 0);

    if (data.requests.length === 0) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('No requests found for this supplier.', this.margin, 50);
      return;
    }

    // Create enhanced table data
    const headers = ['Document Type', 'Status', 'Priority', 'Created Date', 'Deadline', 'Days Pending'];
    const rows = data.requests.slice(0, 15).map(request => {
      const createdDate = new Date(request.created_at);
      const deadline = request.deadline ? new Date(request.deadline) : null;
      const daysPending = request.status === 'pending' ? 
        Math.floor((new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      return [
        request.document_type || 'N/A',
        request.status || 'N/A',
        request.priority || 'Medium',
        createdDate.toLocaleDateString(),
        deadline ? deadline.toLocaleDateString() : 'N/A',
        daysPending > 0 ? daysPending.toString() : '-'
      ];
    });

    // Enhanced table with better styling
    autoTable(this.doc, {
      startY: 40,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' }
      },
      didParseCell: function(data) {
        // Color code status cells
        if (data.column.index === 1 && data.cell.section === 'body') {
          const status = data.cell.raw as string;
          if (status === 'approved') {
            data.cell.styles.fillColor = [220, 252, 231]; // Light green
            data.cell.styles.textColor = [21, 128, 61]; // Dark green
          } else if (status === 'rejected') {
            data.cell.styles.fillColor = [254, 226, 226]; // Light red
            data.cell.styles.textColor = [153, 27, 27]; // Dark red
          } else if (status === 'pending') {
            data.cell.styles.fillColor = [255, 237, 213]; // Light orange
            data.cell.styles.textColor = [154, 52, 18]; // Dark orange
          }
        }
      }
    });
  }

  private addRecommendations(data: PDFExportData): void {
    const finalY = (this.doc as any).lastAutoTable?.finalY || 120;
    let yPos = finalY + 20;

    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(30, 58, 138);
    this.doc.text('RECOMMENDATIONS & NEXT STEPS', this.margin, yPos);
    this.doc.setTextColor(0, 0, 0);

    yPos += 15;

    // Generate recommendations based on data
    const recommendations = this.generateRecommendations(data);

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');

    recommendations.forEach((rec, index) => {
      const bullet = `${index + 1}.`;
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(bullet, this.margin, yPos);
      this.doc.setFont('helvetica', 'normal');
      
      const lines = this.doc.splitTextToSize(rec, this.pageWidth - 2 * this.margin - 10);
      lines.forEach((line: string, lineIndex: number) => {
        this.doc.text(line, this.margin + 10, yPos + (lineIndex * 5));
      });
      
      yPos += lines.length * 5 + 5;
    });
  }

  private generateRecommendations(data: PDFExportData): string[] {
    const recommendations: string[] = [];

    if (data.complianceScore < 70) {
      recommendations.push('Compliance score is below acceptable threshold. Implement immediate action plan to address gaps in documentation and processes.');
    }

    if (data.pendingRequests > 5) {
      recommendations.push(`${data.pendingRequests} requests are currently pending. Prioritize timely responses to maintain compliance standards.`);
    }

    if (data.overdueRequests > 0) {
      recommendations.push(`${data.overdueRequests} requests are overdue. Immediate attention required to prevent compliance violations.`);
    }

    if (data.riskLevel === 'High') {
      recommendations.push('High risk assessment indicates significant compliance concerns. Consider implementing enhanced monitoring and support measures.');
    }

    if (data.averageResponseTime > 7) {
      recommendations.push(`Average response time of ${data.averageResponseTime} days exceeds recommended standards. Streamline internal processes to improve efficiency.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Supplier demonstrates strong compliance performance. Continue current practices and maintain regular monitoring.');
    }

    recommendations.push('Schedule quarterly compliance review meetings to maintain ongoing performance standards.');

    return recommendations;
  }

  private addFooter(data: PDFExportData, pageNum: number, totalPages: number): void {
    const footerY = this.pageHeight - 15;

    // Add footer background
    this.doc.setFillColor(248, 250, 252);
    this.doc.rect(0, footerY - 5, this.pageWidth, 20, 'F');

    // Add separator line
    this.doc.setDrawColor(203, 213, 225);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, footerY - 5, this.pageWidth - this.margin, footerY - 5);

    // Footer text
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(100, 116, 139);

    const timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // Left side: Generation info
    this.doc.text(`Generated: ${timestamp}`, this.margin, footerY);

    // Center: Buyer ID
    this.doc.text(`Buyer ID: ${data.buyerId}`, this.pageWidth / 2, footerY, { align: 'center' });

    // Right side: Page numbers
    this.doc.text(`Page ${pageNum} of ${totalPages}`, this.pageWidth - this.margin, footerY, { align: 'right' });

    // Confidentiality notice
    this.doc.setFontSize(7);
    this.doc.text('CONFIDENTIAL - This report contains proprietary business information', 
                  this.pageWidth / 2, footerY + 6, { align: 'center' });
  }

  // Helper methods for safe text and number handling
  private safeText(value: any): string {
    if (value === null || value === undefined) {
      return 'Not provided';
    }
    return String(value);
  }

  private safeNumber(value: any): number {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return 0;
    }
    return Number(value);
  }

  private getRiskColor(level: string): [number, number, number] {
    const safeLevel = this.safeText(level);
    switch (safeLevel.toLowerCase()) {
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

export type { PDFExportData };