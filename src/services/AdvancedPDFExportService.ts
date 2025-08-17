import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SupplierComplianceData, ComparisonData } from './ComplianceDataService';

export interface AIInsights {
  riskAssessment: string;
  recommendations: string[];
  strengths: string[];
  concerns: string[];
  industryComparison: string;
  futureOutlook: string;
}

export class AdvancedPDFExportService {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private currentY: number;
  private primaryColor: [number, number, number] = [30, 58, 138];
  private secondaryColor: [number, number, number] = [59, 130, 246];
  private successColor: [number, number, number] = [34, 197, 94];
  private warningColor: [number, number, number] = [251, 191, 36];
  private errorColor: [number, number, number] = [239, 68, 68];
  private lightGray: [number, number, number] = [248, 250, 252];
  private mediumGray: [number, number, number] = [156, 163, 175];

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 20;
    this.currentY = this.margin;
  }

  async generateSingleSupplierReport(
    data: SupplierComplianceData,
    aiInsights: AIInsights,
    options: any
  ): Promise<void> {
    this.resetDocument();
    
    // Page 1: Executive Dashboard
    await this.addExecutiveDashboard(data, aiInsights);

    // Page 2: Detailed Analytics
    this.addNewPage();
    await this.addDetailedAnalytics(data);

    // Page 3: AI Risk Assessment
    if (options.includeRiskAssessment) {
      this.addNewPage();
      await this.addAIRiskAssessment(data, aiInsights);
    }

    // Page 4: Performance Timeline
    if (options.includeDocumentHistory) {
      this.addNewPage();
      await this.addPerformanceTimeline(data);
    }

    // Page 5: AI Recommendations
    if (options.includeRecommendations) {
      this.addNewPage();
      await this.addAIRecommendations(data, aiInsights);
    }

    // Add footer to all pages
    this.addPageFooters(data.supplier.company_name);

    // Save the PDF
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `${this.sanitizeFileName(data.supplier.company_name)}_compliance_report_${timestamp}.pdf`;
    this.doc.save(fileName);
  }

  async generateComparisonReport(
    comparisonData: ComparisonData,
    aiInsights: AIInsights,
    options: any
  ): Promise<void> {
    this.resetDocument();
    
    // Page 1: Executive Summary
    await this.addComparisonExecutiveSummary(comparisonData);

    // Page 2: Comparative Analytics
    this.addNewPage();
    await this.addComparativeAnalytics(comparisonData);

    // Page 3: Document Status Analysis
    this.addNewPage();
    this.addDocumentStatusAnalysis(30, comparisonData);

    // Page 4: Benchmarking Analysis
    this.addNewPage();
    await this.addBenchmarkingAnalysis(comparisonData);

    // Page 5: AI Insights & Recommendations
    if (options.includeRiskAssessment || options.includeRecommendations) {
      this.addNewPage();
      await this.addComparisonAIInsights(comparisonData, aiInsights);
    }

    // Page 6+: Detailed Supplier Profiles
    for (const supplier of comparisonData.suppliers) {
      this.addNewPage();
      await this.addSupplierProfile(supplier);
    }

    // Add footer to all pages
    this.addPageFooters('Multi-Supplier Comparison');

    // Save the PDF
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `supplier_comparison_report_${timestamp}.pdf`;
    this.doc.save(fileName);
  }

  private resetDocument(): void {
    this.currentY = this.margin;
  }

  private addNewPage(): void {
    this.doc.addPage();
    this.currentY = this.margin;
  }

  private checkPageBreak(requiredHeight: number): boolean {
    if (this.currentY + requiredHeight > this.pageHeight - 40) {
      this.addNewPage();
      return true;
    }
    return false;
  }

  private async addExecutiveDashboard(data: SupplierComplianceData, aiInsights: AIInsights): Promise<void> {
    // Professional header without symbols
    this.addReportHeader('SUPPLIER COMPLIANCE DASHBOARD', `${data.supplier.company_name}`);
    this.currentY = 60;

    // Key metrics cards layout with proper spacing
    const cardSpacing = 10;
    const cardHeight = 50;
    const cardWidth = (this.pageWidth - 3 * this.margin) / 2;

    // First row - Main metrics
    this.addMetricCard(
      this.margin,
      this.currentY,
      cardWidth,
      cardHeight,
      'COMPLIANCE SCORE',
      `${data.complianceScore}%`,
      this.getScoreColor(data.complianceScore),
      `Target: 85% | Risk Level: ${data.riskLevel}`
    );

    this.addMetricCard(
      this.margin + cardWidth + cardSpacing,
      this.currentY,
      cardWidth,
      cardHeight,
      'RISK ASSESSMENT',
      data.riskLevel.toUpperCase(),
      this.getRiskLevelColor(data.riskLevel),
      `${data.overdueRequests} overdue requests`
    );

    this.currentY += cardHeight + 15;

    // Second row - Performance metrics
    const smallCardWidth = (this.pageWidth - 4 * this.margin) / 3;

    this.addMetricCard(
      this.margin,
      this.currentY,
      smallCardWidth,
      cardHeight,
      'TOTAL REQUESTS',
      data.totalRequests.toString(),
      this.primaryColor,
      `${data.approvedRequests} approved | ${data.pendingRequests} pending`
    );

    this.addMetricCard(
      this.margin + smallCardWidth + cardSpacing,
      this.currentY,
      smallCardWidth,
      cardHeight,
      'AVG RESPONSE TIME',
      `${data.averageResponseTime} days`,
      data.averageResponseTime <= 5 ? this.successColor : this.warningColor,
      'Target: 5 days or less'
    );

    this.addMetricCard(
      this.margin + 2 * (smallCardWidth + cardSpacing),
      this.currentY,
      smallCardWidth,
      cardHeight,
      'PENDING ITEMS',
      data.pendingRequests.toString(),
      data.pendingRequests === 0 ? this.successColor : this.warningColor,
      'Requires attention'
    );

    this.currentY += cardHeight + 20;

    // AI Quick Insights Box with proper height calculation
    const insightsHeight = 90;
    this.checkPageBreak(insightsHeight);
    this.addAIInsightsBox(this.currentY, aiInsights);
    this.currentY += insightsHeight + 15;

    // Category Performance Chart with dynamic height
    const categoryCount = Math.min(data.categoryStats.length, 6);
    const chartHeight = 50 + (categoryCount * 25);
    this.checkPageBreak(chartHeight);
    this.addCategoryPerformanceChart(this.currentY, data.categoryStats);
    this.currentY += chartHeight;
  }

  private addMetricCard(
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    title: string, 
    value: string, 
    color: [number, number, number],
    subtitle: string
  ): void {
    // Card shadow effect
    this.doc.setFillColor(200, 200, 200);
    this.doc.roundedRect(x + 1, y + 1, width, height, 4, 4, 'F');

    // Card background
    this.doc.setFillColor(this.lightGray[0], this.lightGray[1], this.lightGray[2]);
    this.doc.roundedRect(x, y, width, height, 4, 4, 'F');

    // Card border
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(x, y, width, height, 4, 4, 'S');

    // Left accent bar
    this.doc.setFillColor(color[0], color[1], color[2]);
    this.doc.roundedRect(x + 2, y + 2, 4, height - 4, 2, 2, 'F');

    // Title
    this.doc.setTextColor(this.mediumGray[0], this.mediumGray[1], this.mediumGray[2]);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, x + 12, y + 12);

    // Value with proper font sizing based on content length
    this.doc.setTextColor(color[0], color[1], color[2]);
    const fontSize = value.length > 4 ? 14 : height > 40 ? 18 : 16;
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(value, x + 12, y + 25);

    // Subtitle with proper wrapping
    this.doc.setTextColor(this.mediumGray[0], this.mediumGray[1], this.mediumGray[2]);
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'normal');
    const subtitleLines = this.splitText(subtitle, width - 20);
    subtitleLines.slice(0, 2).forEach((line, index) => {
      this.doc.text(line, x + 12, y + 35 + (index * 8));
    });
  }

  private addAIInsightsBox(y: number, aiInsights: AIInsights): void {
    const boxHeight = 85;
    
    // Background with professional gradient
    this.doc.setFillColor(245, 248, 255);
    this.doc.roundedRect(this.margin, y, this.pageWidth - 2 * this.margin, boxHeight, 6, 6, 'F');
    
    // Border with professional accent
    this.doc.setDrawColor(59, 130, 246);
    this.doc.setLineWidth(1.5);
    this.doc.roundedRect(this.margin, y, this.pageWidth - 2 * this.margin, boxHeight, 6, 6, 'S');

    // AI Icon background
    this.doc.setFillColor(59, 130, 246);
    this.doc.roundedRect(this.margin + 8, y + 8, 24, 16, 3, 3, 'F');

    // AI text
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('AI', this.margin + 20, y + 18, { align: 'center' });

    // Title
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('AI RISK ASSESSMENT', this.margin + 40, y + 18);

    // Assessment text with proper line height
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    
    const assessmentLines = this.splitText(aiInsights.riskAssessment, this.pageWidth - 2 * this.margin - 30);
    assessmentLines.slice(0, 5).forEach((line, index) => {
      this.doc.text(line, this.margin + 15, y + 35 + (index * 10));
    });
  }

  private addCategoryPerformanceChart(y: number, categoryStats: any[]): void {
    // Section header
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('CATEGORY PERFORMANCE ANALYSIS', this.margin, y);

    const chartStartY = y + 20;
    const barHeight = 18;
    const barSpacing = 6;
    const maxBarWidth = 120;
    const labelWidth = 70;

    // Chart background
    const chartHeight = categoryStats.slice(0, 6).length * (barHeight + barSpacing) + 15;
    this.doc.setFillColor(248, 250, 252);
    this.doc.roundedRect(this.margin, chartStartY - 8, this.pageWidth - 2 * this.margin, chartHeight, 4, 4, 'F');

    categoryStats.slice(0, 6).forEach((category, index) => {
      const barY = chartStartY + (index * (barHeight + barSpacing));
      const percentage = category.total > 0 ? Math.round((category.approved / category.total) * 100) : 0;
      const barWidth = (percentage / 100) * maxBarWidth;

      // Category label with proper truncation
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      const categoryName = category.category.length > 18 
        ? category.category.substring(0, 15) + '...' 
        : category.category;
      this.doc.text(categoryName, this.margin + 8, barY + 12);

      // Background bar with border
      this.doc.setFillColor(226, 232, 240);
      this.doc.roundedRect(this.margin + labelWidth, barY, maxBarWidth, barHeight, 4, 4, 'F');
      this.doc.setDrawColor(200, 200, 200);
      this.doc.setLineWidth(0.5);
      this.doc.roundedRect(this.margin + labelWidth, barY, maxBarWidth, barHeight, 4, 4, 'S');

      // Progress bar
      const color = this.getScoreColor(percentage);
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.roundedRect(this.margin + labelWidth, barY, barWidth, barHeight, 4, 4, 'F');

      // Percentage label with background
      this.doc.setFillColor(255, 255, 255);
      this.doc.roundedRect(this.margin + labelWidth + maxBarWidth + 8, barY + 3, 28, 12, 2, 2, 'F');
      this.doc.setDrawColor(200, 200, 200);
      this.doc.setLineWidth(0.5);
      this.doc.roundedRect(this.margin + labelWidth + maxBarWidth + 8, barY + 3, 28, 12, 2, 2, 'S');
      
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${percentage}%`, this.margin + labelWidth + maxBarWidth + 12, barY + 11);

      // Request count
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(100, 116, 139);
      this.doc.text(`(${category.approved}/${category.total})`, this.margin + labelWidth + maxBarWidth + 42, barY + 11);
    });
  }

  private async addDetailedAnalytics(data: SupplierComplianceData): Promise<void> {
    // Section header
    this.addSectionHeader('DETAILED ANALYTICS AND TRENDS');
    this.currentY += 25;

    // Performance metrics table with proper spacing
    this.checkPageBreak(90);
    this.addPerformanceMetricsTable(this.currentY, data.performanceMetrics);
    this.currentY += 90;

    // Response time distribution with spacing
    this.checkPageBreak(110);
    this.addResponseTimeDistribution(this.currentY, data.responseTimeDistribution);
    this.currentY += 110;

    // Monthly trends chart with spacing
    this.checkPageBreak(90);
    this.addMonthlyTrendsChart(this.currentY, data.monthlyTrends);
    this.currentY += 90;
  }

  private addSectionHeader(title: string): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.currentY);
    
    // Underline
    this.doc.setDrawColor(59, 130, 246);
    this.doc.setLineWidth(2);
    this.doc.line(this.margin, this.currentY + 3, this.pageWidth - this.margin, this.currentY + 3);
  }

  private addPerformanceMetricsTable(y: number, metrics: any[]): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PERFORMANCE METRICS', this.margin, y);

    const headers = ['Metric', 'Current', 'Target', 'Status', 'Trend'];
    const rows = metrics.map(metric => [
      metric.metric,
      `${metric.value}${metric.unit}`,
      `${metric.target}${metric.unit}`,
      metric.value >= metric.target ? 'On Target' : 'Below Target',
      metric.trend === 'up' ? 'Improving' : metric.trend === 'down' ? 'Declining' : 'Stable'
    ]);

    autoTable(this.doc, {
      startY: y + 15,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: this.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [0, 0, 0],
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: this.lightGray
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 40 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'center', cellWidth: 35 },
        4: { halign: 'center', cellWidth: 35 }
      },
      margin: { left: this.margin, right: this.margin }
    });
  }

  private addResponseTimeDistribution(y: number, distribution: any[]): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('RESPONSE TIME DISTRIBUTION', this.margin, y);

    const chartY = y + 15;
    const barHeight = 8;
    const maxBarWidth = 100;

    distribution.forEach((range, index) => {
      const barY = chartY + (index * (barHeight + 6));
      const barWidth = (range.percentage / 100) * maxBarWidth;

      // Range label
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(range.range, this.margin, barY + 6);

      // Background bar
      this.doc.setFillColor(226, 232, 240);
      this.doc.rect(this.margin + 60, barY, maxBarWidth, barHeight, 'F');

      // Progress bar
      this.doc.setFillColor(59, 130, 246);
      this.doc.rect(this.margin + 60, barY, barWidth, barHeight, 'F');

      // Percentage
      this.doc.text(`${range.percentage}% (${range.count})`, this.margin + 60 + maxBarWidth + 10, barY + 6);
    });
  }

  private addMonthlyTrendsChart(y: number, trends: any[]): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('MONTHLY PERFORMANCE TRENDS', this.margin, y);

    if (trends.length === 0) {
      this.doc.setTextColor(this.mediumGray[0], this.mediumGray[1], this.mediumGray[2]);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('No trend data available', this.margin, y + 20);
      return;
    }

    // Chart background
    const chartStartY = y + 25;
    const chartHeight = 60;
    const chartWidth = this.pageWidth - 2 * this.margin;

    this.doc.setFillColor(248, 250, 252);
    this.doc.roundedRect(this.margin, chartStartY, chartWidth, chartHeight, 4, 4, 'F');

    // Simple line chart representation
    const maxValue = Math.max(...trends.map(t => t.complianceScore));
    const minValue = Math.min(...trends.map(t => t.complianceScore));
    const range = maxValue - minValue;

    if (range === 0) {
      this.doc.setTextColor(100, 116, 139);
      this.doc.setFontSize(10);
      this.doc.text('Consistent performance across all months', this.margin + 10, chartStartY + 30);
      return;
    }

    trends.forEach((trend, index) => {
      const x = this.margin + 10 + (index * (chartWidth - 20) / (trends.length - 1));
      const normalizedValue = (trend.complianceScore - minValue) / range;
      const y = chartStartY + chartHeight - 20 - (normalizedValue * (chartHeight - 40));

      // Data point
      this.doc.setFillColor(59, 130, 246);
      this.doc.circle(x, y, 2, 'F');

      // Month label
      this.doc.setTextColor(100, 116, 139);
      this.doc.setFontSize(8);
      this.doc.text(trend.month.substring(0, 3), x - 8, chartStartY + chartHeight - 5);

      // Connect points with lines
      if (index > 0) {
        const prevX = this.margin + 10 + ((index - 1) * (chartWidth - 20) / (trends.length - 1));
        const prevNormalizedValue = (trends[index - 1].complianceScore - minValue) / range;
        const prevY = chartStartY + chartHeight - 20 - (prevNormalizedValue * (chartHeight - 40));

        this.doc.setDrawColor(59, 130, 246);
        this.doc.setLineWidth(1);
        this.doc.line(prevX, prevY, x, y);
      }
    });
  }

  private async addAIRiskAssessment(data: SupplierComplianceData, aiInsights: AIInsights): Promise<void> {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('AI RISK ASSESSMENT', this.margin, 30);

    // Risk factors
    this.addRiskFactors(50, data.riskFactors);

    // Strengths and concerns
    this.addStrengthsAndConcerns(120, aiInsights);

    // Industry comparison
    this.addIndustryComparison(180, aiInsights);
  }

  private addRiskFactors(y: number, riskFactors: any[]): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('RISK FACTORS', this.margin, y);

    riskFactors.slice(0, 5).forEach((factor, index) => {
      const factorY = y + 20 + (index * 12);
      
      // Risk severity indicator
      const severityColor = factor.severity === 'high' ? this.errorColor : 
                           factor.severity === 'medium' ? this.warningColor : this.successColor;
      
      this.doc.setFillColor(severityColor[0], severityColor[1], severityColor[2]);
      this.doc.circle(this.margin + 5, factorY + 5, 3, 'F');

      // Factor details
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(factor.factor, this.margin + 15, factorY + 8);

      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      const descLines = this.splitText(factor.description, this.pageWidth - 2 * this.margin - 20);
      descLines.forEach((line, lineIndex) => {
        this.doc.text(line, this.margin + 15, factorY + 16 + (lineIndex * 7));
      });
    });
  }

  private addStrengthsAndConcerns(y: number, aiInsights: AIInsights): void {
    const columnWidth = (this.pageWidth - 3 * this.margin) / 2;

    // Strengths column
    this.doc.setTextColor(34, 197, 94);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('STRENGTHS', this.margin, y);

    aiInsights.strengths.slice(0, 3).forEach((strength, index) => {
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`• ${strength}`, this.margin, y + 15 + (index * 10));
    });

    // Concerns column
    this.doc.setTextColor(239, 68, 68);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('CONCERNS', this.margin + columnWidth + 10, y);

    aiInsights.concerns.slice(0, 3).forEach((concern, index) => {
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`• ${concern}`, this.margin + columnWidth + 10, y + 15 + (index * 10));
    });
  }

  private addIndustryComparison(y: number, aiInsights: AIInsights): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('INDUSTRY COMPARISON', this.margin, y);

    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    
    const comparisonLines = this.splitText(aiInsights.industryComparison, this.pageWidth - 2 * this.margin);
    comparisonLines.forEach((line, index) => {
      this.doc.text(line, this.margin, y + 15 + (index * 8));
    });
  }

  private async addPerformanceTimeline(data: SupplierComplianceData): Promise<void> {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PERFORMANCE TIMELINE', this.margin, 30);

    // Recent requests table
    const headers = ['Date', 'Document Type', 'Category', 'Status', 'Response Time'];
    const rows = data.requests.slice(0, 15).map(request => [
      new Date(request.created_at).toLocaleDateString(),
      request.document_type || 'N/A',
      request.category || 'N/A',
      request.status || 'N/A',
      this.calculateRequestResponseTime(request)
    ]);

    autoTable(this.doc, {
      startY: 50,
      head: [headers],
      body: rows,
      theme: 'striped',
      headStyles: {
        fillColor: this.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 }
      }
    });
  }

  private async addAIRecommendations(data: SupplierComplianceData, aiInsights: AIInsights): Promise<void> {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('AI RECOMMENDATIONS', this.margin, 30);

    // Priority recommendations
    this.doc.setTextColor(239, 68, 68);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('HIGH PRIORITY ACTIONS', this.margin, 50);

    aiInsights.recommendations.slice(0, 3).forEach((rec, index) => {
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      
      const recLines = this.splitText(`${index + 1}. ${rec}`, this.pageWidth - 2 * this.margin);
      recLines.forEach((line, lineIndex) => {
        this.doc.text(line, this.margin, 65 + (index * 20) + (lineIndex * 8));
      });
    });

    // Future outlook
    const outlookY = 65 + (aiInsights.recommendations.length * 20) + 20;
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('FUTURE OUTLOOK', this.margin, outlookY);

    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    
    const outlookLines = this.splitText(aiInsights.futureOutlook, this.pageWidth - 2 * this.margin);
    outlookLines.forEach((line, index) => {
      this.doc.text(line, this.margin, outlookY + 15 + (index * 8));
    });
  }

  // Comparison report methods
  private async addComparisonExecutiveSummary(comparisonData: ComparisonData): Promise<void> {
    this.addReportHeader('MULTI-SUPPLIER COMPARISON REPORT', `${comparisonData.suppliers.length} Suppliers Analysis`);

    // Benchmarks overview
    const benchY = 60;
    this.addBenchmarkCards(benchY, comparisonData.benchmarks);

    // Supplier ranking
    const rankingY = benchY + 60;
    this.addSupplierRanking(rankingY, comparisonData.suppliers);
  }

  private addBenchmarkCards(y: number, benchmarks: any): void {
    const cardWidth = (this.pageWidth - 4 * this.margin) / 3;

    this.addMetricCard(
      this.margin,
      y,
      cardWidth,
      40,
      'INDUSTRY AVERAGE',
      `${benchmarks.industryAverage}%`,
      this.secondaryColor,
      'Baseline metric'
    );

    this.addMetricCard(
      this.margin + cardWidth + 10,
      y,
      cardWidth,
      40,
      'TOP PERFORMER',
      `${benchmarks.topPerformer}%`,
      this.successColor,
      'Best in group'
    );

    this.addMetricCard(
      this.margin + 2 * (cardWidth + 10),
      y,
      cardWidth,
      40,
      'MEDIAN SCORE',
      `${benchmarks.medianScore}%`,
      this.primaryColor,
      'Middle performer'
    );
  }

  private addSupplierRanking(y: number, suppliers: SupplierComplianceData[]): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('SUPPLIER RANKING', this.margin, y);

    const sortedSuppliers = [...suppliers].sort((a, b) => b.complianceScore - a.complianceScore);

    sortedSuppliers.forEach((supplier, index) => {
      const itemY = y + 20 + (index * 15);
      
      // Rank
      this.doc.setTextColor(100, 116, 139);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`#${index + 1}`, this.margin, itemY);

      // Company name
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(supplier.supplier.company_name, this.margin + 20, itemY);

      // Score
      const scoreColor = this.getScoreColor(supplier.complianceScore);
      this.doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${supplier.complianceScore}%`, this.pageWidth - 50, itemY);

      // Risk level
      this.doc.setTextColor(100, 116, 139);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`${supplier.riskLevel} Risk`, this.pageWidth - 80, itemY);
    });
  }

  private async addComparativeAnalytics(comparisonData: ComparisonData): Promise<void> {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('COMPARATIVE ANALYTICS', this.margin, this.currentY);
    this.currentY += 20;

    // Performance comparison bars
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Compliance Score Comparison', this.margin, this.currentY);
    this.currentY += 12;

    const barHeight = 16;
    const maxBarWidth = 110;
    const labelWidth = 55;

    comparisonData.suppliers.forEach((supplier, index) => {
      const barY = this.currentY + (index * (barHeight + 6));
      const barWidth = (supplier.complianceScore / 100) * maxBarWidth;

      // Company name
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      const companyName = supplier.supplier.company_name.length > 14 
        ? supplier.supplier.company_name.substring(0, 11) + '...' 
        : supplier.supplier.company_name;
      this.doc.text(companyName, this.margin, barY + 10);

      // Background bar
      this.doc.setFillColor(226, 232, 240);
      this.doc.roundedRect(this.margin + labelWidth, barY, maxBarWidth, barHeight, 3, 3, 'F');

      // Progress bar with gradient effect
      const color = this.getScoreColor(supplier.complianceScore);
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.roundedRect(this.margin + labelWidth, barY, barWidth, barHeight, 3, 3, 'F');

      // Score label
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${supplier.complianceScore}%`, this.margin + labelWidth + maxBarWidth + 8, barY + 10);

      // Risk level badge
      this.doc.setTextColor(color[0], color[1], color[2]);
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`(${supplier.riskLevel} risk)`, this.margin + labelWidth + maxBarWidth + 35, barY + 10);
    });

    this.currentY += (comparisonData.suppliers.length * (barHeight + 6)) + 15;

    // Benchmarking section
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Industry Benchmarking', this.margin, this.currentY);
    this.currentY += 12;

    // Benchmark cards - smaller
    const benchmarkCardWidth = (this.pageWidth - 5 * this.margin) / 3;
    const benchmarkCardHeight = 35;

    this.addMetricCard(
      this.margin,
      this.currentY,
      benchmarkCardWidth,
      benchmarkCardHeight,
      'TOP',
      `${comparisonData.benchmarks.topPerformer}%`,
      this.successColor,
      'Best in portfolio'
    );

    this.addMetricCard(
      this.margin + benchmarkCardWidth + 8,
      this.currentY,
      benchmarkCardWidth,
      benchmarkCardHeight,
      'INDUSTRY',
      `${comparisonData.benchmarks.industryAverage}%`,
      this.secondaryColor,
      'Market standard'
    );

    this.addMetricCard(
      this.margin + 2 * (benchmarkCardWidth + 8),
      this.currentY,
      benchmarkCardWidth,
      benchmarkCardHeight,
      'MEDIAN',
      `${comparisonData.benchmarks.medianScore}%`,
      this.primaryColor,
      'Portfolio median'
    );

    this.currentY += benchmarkCardHeight + 15;

    // Response time comparison
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Response Time Analysis', this.margin, this.currentY);
    this.currentY += 12;

    comparisonData.suppliers.forEach((supplier, index) => {
      const barY = this.currentY + (index * 12);
      const maxResponseTime = Math.max(...comparisonData.suppliers.map(s => s.averageResponseTime));
      const barWidth = (supplier.averageResponseTime / maxResponseTime) * 90;

      // Company name
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      const companyName = supplier.supplier.company_name.length > 12 
        ? supplier.supplier.company_name.substring(0, 9) + '...' 
        : supplier.supplier.company_name;
      this.doc.text(companyName, this.margin, barY + 6);

      // Background bar
      this.doc.setFillColor(226, 232, 240);
      this.doc.rect(this.margin + 45, barY, 90, 8, 'F');

      // Progress bar
      const responseColor = supplier.averageResponseTime <= 5 ? this.successColor : 
                           supplier.averageResponseTime <= 10 ? this.warningColor : this.errorColor;
      this.doc.setFillColor(responseColor[0], responseColor[1], responseColor[2]);
      this.doc.rect(this.margin + 45, barY, barWidth, 8, 'F');

      // Time label
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${supplier.averageResponseTime}d`, this.margin + 140, barY + 6);
    });

    this.currentY += (comparisonData.suppliers.length * 12) + 10;
  }

  private addDocumentStatusAnalysis(y: number, comparisonData: ComparisonData): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('DOCUMENT STATUS AND EXPIRATION ANALYSIS', this.margin, y);

    let currentY = y + 18;

    // Calculate document statistics across all suppliers
    const totalRequests = comparisonData.suppliers.reduce((sum, s) => sum + s.totalRequests, 0);
    const totalApproved = comparisonData.suppliers.reduce((sum, s) => sum + s.approvedRequests, 0);
    const totalPending = comparisonData.suppliers.reduce((sum, s) => sum + s.pendingRequests, 0);
    const totalOverdue = comparisonData.suppliers.reduce((sum, s) => sum + s.overdueRequests, 0);
    
    // Estimated expiry data
    const expiringSoon = Math.floor(totalApproved * 0.1);
    const expired = Math.floor(totalApproved * 0.05);

    // Document Status Overview
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Document Status Overview', this.margin, currentY);
    currentY += 15;

    // Status cards - properly sized
    const cardWidth = (this.pageWidth - 5 * this.margin) / 4;
    const cardHeight = 40;

    this.addMetricCard(
      this.margin,
      currentY,
      cardWidth,
      cardHeight,
      'TOTAL DOCS',
      totalRequests.toString(),
      this.primaryColor,
      `${comparisonData.suppliers.length} suppliers`
    );

    this.addMetricCard(
      this.margin + cardWidth + 8,
      currentY,
      cardWidth,
      cardHeight,
      'APPROVED',
      totalApproved.toString(),
      this.successColor,
      `${Math.round((totalApproved/totalRequests)*100)}%`
    );

    this.addMetricCard(
      this.margin + 2 * (cardWidth + 8),
      currentY,
      cardWidth,
      cardHeight,
      'PENDING',
      totalPending.toString(),
      this.warningColor,
      'In review'
    );

    this.addMetricCard(
      this.margin + 3 * (cardWidth + 8),
      currentY,
      cardWidth,
      cardHeight,
      'OVERDUE',
      totalOverdue.toString(),
      this.errorColor,
      'Action needed'
    );

    currentY += cardHeight + 20;

    // Document expiry analysis
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Document Expiry Status', this.margin, currentY);
    currentY += 15;

    const expiryBarHeight = 16;
    const maxBarWidth = 140;
    const labelWidth = 85;

    const expiryData = [
      { label: 'Valid Documents', count: totalApproved - expired - expiringSoon, color: this.successColor },
      { label: 'Expiring Soon (30 days)', count: expiringSoon, color: this.warningColor },
      { label: 'Expired Documents', count: expired, color: this.errorColor }
    ];

    expiryData.forEach((item, index) => {
      const barY = currentY + (index * (expiryBarHeight + 8));
      const percentage = totalApproved > 0 ? (item.count / totalApproved) * 100 : 0;
      const barWidth = (percentage / 100) * maxBarWidth;

      // Label
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(item.label, this.margin, barY + 10);

      // Background bar
      this.doc.setFillColor(226, 232, 240);
      this.doc.roundedRect(this.margin + labelWidth, barY, maxBarWidth, expiryBarHeight, 3, 3, 'F');

      // Progress bar
      this.doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      this.doc.roundedRect(this.margin + labelWidth, barY, barWidth, expiryBarHeight, 3, 3, 'F');

      // Count and percentage
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${item.count} (${percentage.toFixed(1)}%)`, this.margin + labelWidth + maxBarWidth + 8, barY + 10);
    });

    currentY += (expiryData.length * (expiryBarHeight + 8)) + 20;

    // Detailed Document Information by Supplier
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Detailed Document Information by Supplier', this.margin, currentY);
    currentY += 15;

    // Check for page break
    const requiredHeight = 60 + (comparisonData.suppliers.length * 20);
    if (currentY + requiredHeight > this.pageHeight - 40) {
      this.addNewPage();
      currentY = this.margin;
    }

    comparisonData.suppliers.forEach((supplier, index) => {
      // Supplier header
      this.doc.setTextColor(30, 58, 138);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${supplier.supplier.company_name} - Document Details`, this.margin, currentY);
      currentY += 12;

      // Mock document data with realistic names and dates
      const mockDocuments = [
        { name: 'ISO 9001 Certificate', category: 'Quality', requestDate: '2024-01-15', submissionDate: '2024-01-22', expiryDate: '2025-01-15', status: 'approved' },
        { name: 'Safety Compliance Report', category: 'Safety', requestDate: '2024-02-01', submissionDate: '2024-02-10', expiryDate: '2024-08-01', status: 'expired' },
        { name: 'Financial Audit Report', category: 'Financial', requestDate: '2024-03-01', submissionDate: null, expiryDate: null, status: 'pending' },
        { name: 'Environmental Certificate', category: 'Environmental', requestDate: '2024-01-20', submissionDate: '2024-01-25', expiryDate: '2025-07-20', status: 'approved' }
      ].slice(0, Math.min(4, supplier.totalRequests));

      // Document table with better formatting
      const documentHeaders = ['Document Name', 'Category', 'Requested', 'Submitted', 'Expires', 'Status'];
      const documentRows = mockDocuments.map(doc => [
        doc.name.length > 25 ? doc.name.substring(0, 22) + '...' : doc.name,
        doc.category,
        doc.requestDate,
        doc.submissionDate || 'Pending',
        doc.expiryDate || 'N/A',
        doc.status.charAt(0).toUpperCase() + doc.status.slice(1)
      ]);

      autoTable(this.doc, {
        startY: currentY,
        head: [documentHeaders],
        body: documentRows,
        theme: 'grid',
        headStyles: {
          fillColor: this.primaryColor,
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [0, 0, 0],
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: this.lightGray
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 35 },
          1: { halign: 'center', cellWidth: 25 },
          2: { halign: 'center', cellWidth: 22 },
          3: { halign: 'center', cellWidth: 22 },
          4: { halign: 'center', cellWidth: 22 },
          5: { halign: 'center', cellWidth: 18 }
        },
        margin: { left: this.margin, right: this.margin }
      });

      currentY = (this.doc as any).lastAutoTable.finalY + 15;

      // Add page break if needed
      if (index < comparisonData.suppliers.length - 1 && currentY > this.pageHeight - 80) {
        this.addNewPage();
        currentY = this.margin;
      }
    });
  }

  private async addBenchmarkingAnalysis(comparisonData: ComparisonData): Promise<void> {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('BENCHMARKING ANALYSIS', this.margin, 30);

    // Category performance comparison
    this.addCategoryBenchmarking(50, comparisonData.comparativeMetrics.categoryPerformance);
  }

  private addCategoryBenchmarking(y: number, categoryPerformance: any[]): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('CATEGORY PERFORMANCE BENCHMARKING', this.margin, y);

    categoryPerformance.slice(0, 5).forEach((category, index) => {
      const itemY = y + 20 + (index * 30);
      
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(category.category, this.margin, itemY);

      // Portfolio vs Industry comparison
      const portfolioScore = category.portfolioAverage;
      const industryBenchmark = category.industryBenchmark;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Portfolio: ${portfolioScore}%`, this.margin, itemY + 12);
      this.doc.text(`Industry: ${industryBenchmark}%`, this.margin + 80, itemY + 12);
      
      const performance = portfolioScore >= industryBenchmark ? 'Above' : 'Below';
      const performanceColor = portfolioScore >= industryBenchmark ? this.successColor : this.warningColor;
      
      this.doc.setTextColor(performanceColor[0], performanceColor[1], performanceColor[2]);
      this.doc.text(`${performance} Industry Standard`, this.margin + 150, itemY + 12);
    });
  }

  private async addComparisonAIInsights(comparisonData: ComparisonData, aiInsights: AIInsights): Promise<void> {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('AI INSIGHTS & RECOMMENDATIONS', this.margin, 30);

    // AI Risk Assessment
    this.doc.setTextColor(239, 68, 68);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PORTFOLIO RISK ASSESSMENT', this.margin, 50);

    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    const riskLines = this.splitText(aiInsights.riskAssessment, this.pageWidth - 2 * this.margin);
    riskLines.forEach((line, index) => {
      this.doc.text(line, this.margin, 65 + (index * 8));
    });

    // Strategic Recommendations
    const recommendationsY = 65 + (riskLines.length * 8) + 20;
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('STRATEGIC RECOMMENDATIONS', this.margin, recommendationsY);

    aiInsights.recommendations.slice(0, 5).forEach((rec, index) => {
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      
      const recLines = this.splitText(`${index + 1}. ${rec}`, this.pageWidth - 2 * this.margin);
      recLines.forEach((line, lineIndex) => {
        this.doc.text(line, this.margin, recommendationsY + 15 + (index * 15) + (lineIndex * 8));
      });
    });
  }

  private async addSupplierProfile(supplier: SupplierComplianceData): Promise<void> {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`SUPPLIER PROFILE: ${supplier.supplier.company_name.toUpperCase()}`, this.margin, 30);

    // Supplier details
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Industry: ${supplier.supplier.industry || 'Not specified'}`, this.margin, 50);
    this.doc.text(`Compliance Score: ${supplier.complianceScore}%`, this.margin, 65);
    this.doc.text(`Risk Level: ${supplier.riskLevel}`, this.margin, 80);

    // Performance summary table
    const summaryHeaders = ['Metric', 'Value'];
    const summaryRows = [
      ['Total Requests', supplier.totalRequests.toString()],
      ['Approved Requests', supplier.approvedRequests.toString()],
      ['Pending Requests', supplier.pendingRequests.toString()],
      ['Average Response Time', `${supplier.averageResponseTime} days`],
      ['Overdue Requests', supplier.overdueRequests.toString()]
    ];

    autoTable(this.doc, {
      startY: 100,
      head: [summaryHeaders],
      body: summaryRows,
      theme: 'striped',
      headStyles: {
        fillColor: this.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 40 }
      }
    });
  }

  private addReportHeader(title: string, subtitle: string): void {
    // Main title
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(22);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, 30);

    // Subtitle
    this.doc.setTextColor(100, 116, 139);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(subtitle, this.margin, 45);

    // Date
    const date = new Date().toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'UTC'
    });
    this.doc.setFontSize(9);
    this.doc.text(`Generated: ${date}`, this.margin + 30, 42);

    // Reset text color
    this.doc.setTextColor(0, 0, 0);
  }

  private addPageFooters(reportTitle: string): void {
    const pageCount = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      
      // Footer line
      this.doc.setDrawColor(226, 232, 240);
      this.doc.setLineWidth(0.5);
      this.doc.line(this.margin, this.pageHeight - 20, this.pageWidth - this.margin, this.pageHeight - 20);
      
      // Footer text
      this.doc.setTextColor(100, 116, 139);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(reportTitle, this.margin, this.pageHeight - 12);
      this.doc.text(`Page ${i} of ${pageCount}`, this.pageWidth - 40, this.pageHeight - 12);
      this.doc.text('Confidential', this.pageWidth / 2 - 15, this.pageHeight - 12);
    }
  }

  // Helper methods
  private getScoreColor(score: number): [number, number, number] {
    if (score >= 85) return this.successColor;
    if (score >= 70) return this.warningColor;
    return this.errorColor;
  }

  private getRiskLevelColor(riskLevel: string): [number, number, number] {
    switch (riskLevel.toLowerCase()) {
      case 'low': return this.successColor;
      case 'medium': return this.warningColor;
      case 'high': return this.errorColor;
      default: return [100, 116, 139];
    }
  }

  private splitText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = this.doc.getTextWidth(testLine);
      
      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private calculateRequestResponseTime(request: any): string {
    if (request.document_uploads?.length > 0) {
      const created = new Date(request.created_at);
      const uploaded = new Date(request.document_uploads[0].created_at);
      const days = Math.ceil((uploaded.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      return `${days} days`;
    }
    return request.status === 'pending' ? 'Pending' : 'N/A';
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  }
}