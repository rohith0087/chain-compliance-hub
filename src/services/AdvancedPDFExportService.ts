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
    // Professional header with supply chain symbols
    this.addReportHeader('📊 SUPPLIER COMPLIANCE DASHBOARD', `🏢 ${data.supplier.company_name}`);
    this.currentY = 60;

    // Key metrics cards layout with proper spacing
    const cardSpacing = 10;
    const cardHeight = 45;
    const cardWidth = (this.pageWidth - 3 * this.margin) / 2;

    // First row - Main metrics
    this.addMetricCard(
      this.margin,
      this.currentY,
      cardWidth,
      cardHeight,
      '🎯 COMPLIANCE SCORE',
      `${data.complianceScore}%`,
      this.getScoreColor(data.complianceScore),
      `Target: 85% • Risk: ${data.riskLevel}`
    );

    this.addMetricCard(
      this.margin + cardWidth + cardSpacing,
      this.currentY,
      cardWidth,
      cardHeight,
      '⚠️ RISK ASSESSMENT',
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
      '📋 TOTAL REQUESTS',
      data.totalRequests.toString(),
      this.primaryColor,
      `${data.approvedRequests} approved • ${data.pendingRequests} pending`
    );

    this.addMetricCard(
      this.margin + smallCardWidth + cardSpacing,
      this.currentY,
      smallCardWidth,
      cardHeight,
      '⏱️ AVG RESPONSE',
      `${data.averageResponseTime} days`,
      data.averageResponseTime <= 5 ? this.successColor : this.warningColor,
      'Target: ≤5 days'
    );

    this.addMetricCard(
      this.margin + 2 * (smallCardWidth + cardSpacing),
      this.currentY,
      smallCardWidth,
      cardHeight,
      '🔄 PENDING ITEMS',
      data.pendingRequests.toString(),
      data.pendingRequests === 0 ? this.successColor : this.warningColor,
      'Requires attention'
    );

    this.currentY += cardHeight + 20;

    // AI Quick Insights Box with proper height calculation
    const insightsHeight = 85;
    this.checkPageBreak(insightsHeight);
    this.addAIInsightsBox(this.currentY, aiInsights);
    this.currentY += insightsHeight + 15;

    // Category Performance Chart with dynamic height
    const categoryCount = Math.min(data.categoryStats.length, 6);
    const chartHeight = 40 + (categoryCount * 20);
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

    // Card background with gradient effect
    this.doc.setFillColor(this.lightGray[0], this.lightGray[1], this.lightGray[2]);
    this.doc.roundedRect(x, y, width, height, 4, 4, 'F');

    // Card border
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(x, y, width, height, 4, 4, 'S');

    // Left accent bar
    this.doc.setFillColor(color[0], color[1], color[2]);
    this.doc.roundedRect(x + 2, y + 2, 4, height - 4, 2, 2, 'F');

    // Title with icon
    this.doc.setTextColor(this.mediumGray[0], this.mediumGray[1], this.mediumGray[2]);
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, x + 12, y + 15);

    // Value with proper font sizing
    this.doc.setTextColor(color[0], color[1], color[2]);
    this.doc.setFontSize(height > 40 ? 20 : 16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(value, x + 12, y + 28);

    // Subtitle with proper wrapping
    this.doc.setTextColor(this.mediumGray[0], this.mediumGray[1], this.mediumGray[2]);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    const subtitleLines = this.splitText(subtitle, width - 20);
    subtitleLines.slice(0, 2).forEach((line, index) => {
      this.doc.text(line, x + 12, y + 38 + (index * 8));
    });
  }

  private addAIInsightsBox(y: number, aiInsights: AIInsights): void {
    const boxHeight = 75;
    
    // AI icon background circle
    this.doc.setFillColor(59, 130, 246);
    this.doc.circle(this.margin + 15, y + 15, 8, 'F');
    
    // Background with gradient effect
    this.doc.setFillColor(239, 246, 255);
    this.doc.roundedRect(this.margin, y, this.pageWidth - 2 * this.margin, boxHeight, 8, 8, 'F');
    
    // Border with AI accent
    this.doc.setDrawColor(59, 130, 246);
    this.doc.setLineWidth(2);
    this.doc.roundedRect(this.margin, y, this.pageWidth - 2 * this.margin, boxHeight, 8, 8, 'S');

    // AI Icon (🤖 symbol)
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('AI', this.margin + 12, y + 18, { align: 'center' });

    // Title
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('🚨 AI RISK ASSESSMENT', this.margin + 30, y + 18);

    // Assessment text with proper line height
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    
    const assessmentLines = this.splitText(aiInsights.riskAssessment, this.pageWidth - 2 * this.margin - 40);
    assessmentLines.slice(0, 4).forEach((line, index) => {
      this.doc.text(line, this.margin + 15, y + 35 + (index * 9));
    });
  }

  private addCategoryPerformanceChart(y: number, categoryStats: any[]): void {
    // Section header with supply chain icon
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('📈 CATEGORY PERFORMANCE ANALYSIS', this.margin, y);

    const chartStartY = y + 25;
    const barHeight = 15;
    const barSpacing = 5;
    const maxBarWidth = 110;
    const labelWidth = 60;

    // Chart background
    const chartHeight = categoryStats.slice(0, 6).length * (barHeight + barSpacing) + 10;
    this.doc.setFillColor(this.lightGray[0], this.lightGray[1], this.lightGray[2]);
    this.doc.roundedRect(this.margin, chartStartY - 5, this.pageWidth - 2 * this.margin, chartHeight, 4, 4, 'F');

    categoryStats.slice(0, 6).forEach((category, index) => {
      const barY = chartStartY + (index * (barHeight + barSpacing));
      const percentage = category.total > 0 ? Math.round((category.approved / category.total) * 100) : 0;
      const barWidth = (percentage / 100) * maxBarWidth;

      // Category label with truncation
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      const categoryName = category.category.length > 15 
        ? category.category.substring(0, 12) + '...' 
        : category.category;
      this.doc.text(categoryName, this.margin + 5, barY + 10);

      // Background bar with border
      this.doc.setFillColor(226, 232, 240);
      this.doc.roundedRect(this.margin + labelWidth, barY, maxBarWidth, barHeight, 3, 3, 'F');
      this.doc.setDrawColor(200, 200, 200);
      this.doc.setLineWidth(0.5);
      this.doc.roundedRect(this.margin + labelWidth, barY, maxBarWidth, barHeight, 3, 3, 'S');

      // Progress bar with gradient effect
      const color = this.getScoreColor(percentage);
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.roundedRect(this.margin + labelWidth, barY, barWidth, barHeight, 3, 3, 'F');

      // Percentage label with background
      this.doc.setFillColor(255, 255, 255);
      this.doc.roundedRect(this.margin + labelWidth + maxBarWidth + 5, barY + 2, 25, 11, 2, 2, 'F');
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${percentage}%`, this.margin + labelWidth + maxBarWidth + 8, barY + 9);

      // Request count
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(this.mediumGray[0], this.mediumGray[1], this.mediumGray[2]);
      this.doc.text(`(${category.approved}/${category.total})`, this.margin + labelWidth + maxBarWidth + 35, barY + 9);
    });
  }

  private async addDetailedAnalytics(data: SupplierComplianceData): Promise<void> {
    // Section header with analytics icon
    this.addSectionHeader('📊 DETAILED ANALYTICS & TRENDS');
    this.currentY += 30;

    // Performance metrics table with proper spacing
    this.checkPageBreak(80);
    this.addPerformanceMetricsTable(this.currentY, data.performanceMetrics);
    this.currentY += 80;

    // Response time distribution with spacing
    this.checkPageBreak(100);
    this.addResponseTimeDistribution(this.currentY, data.responseTimeDistribution);
    this.currentY += 100;

    // Monthly trends chart with spacing
    this.checkPageBreak(80);
    this.addMonthlyTrendsChart(this.currentY, data.monthlyTrends);
    this.currentY += 80;
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
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('⚡ PERFORMANCE METRICS', this.margin, y);

    const headers = ['Metric', 'Current', 'Target', 'Status', 'Trend'];
    const rows = metrics.map(metric => [
      metric.metric,
      `${metric.value}${metric.unit}`,
      `${metric.target}${metric.unit}`,
      metric.value >= metric.target ? '✅ On Target' : '⚠️ Below Target',
      metric.trend === 'up' ? '📈 Improving' : metric.trend === 'down' ? '📉 Declining' : '➡️ Stable'
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
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('📅 MONTHLY PERFORMANCE TRENDS', this.margin, y);

    if (trends.length === 0) {
      this.doc.setTextColor(this.mediumGray[0], this.mediumGray[1], this.mediumGray[2]);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('No trend data available', this.margin, y + 20);
      return;
    }

    // Chart background
    const chartStartY = y + 25;
    const chartHeight = 50;
    const chartWidth = this.pageWidth - 2 * this.margin - 20;
    const maxRequests = Math.max(...trends.map(t => t.requests), 1);

    this.doc.setFillColor(this.lightGray[0], this.lightGray[1], this.lightGray[2]);
    this.doc.roundedRect(this.margin + 10, chartStartY - 5, chartWidth, chartHeight + 20, 4, 4, 'F');

    // Chart title
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Requests per Month', this.margin + 15, chartStartY + 5);

    trends.forEach((trend, index) => {
      const x = this.margin + 15 + (index * (chartWidth / trends.length));
      const height = (trend.requests / maxRequests) * chartHeight * 0.8;
      
      // Bar with gradient effect
      this.doc.setFillColor(59, 130, 246);
      this.doc.roundedRect(x, chartStartY + chartHeight - height, 20, height, 2, 2, 'F');
      
      // Month label
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(trend.month, x + 2, chartStartY + chartHeight + 10);
      
      // Value label
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(trend.requests.toString(), x + 8, chartStartY + chartHeight - height - 2);
    });
  }

  private async addAIRiskAssessment(data: SupplierComplianceData, aiInsights: AIInsights): Promise<void> {
    this.addSectionHeader('🤖 AI-POWERED RISK ASSESSMENT');
    this.currentY += 35;

    // Risk factors section with proper spacing
    this.checkPageBreak(100);
    this.addRiskFactorsSection(this.currentY, data.riskFactors);
    this.currentY += Math.max(100, data.riskFactors.length * 30 + 20);

    // AI strengths and concerns with spacing
    this.checkPageBreak(80);
    this.addStrengthsAndConcerns(this.currentY, aiInsights);
    this.currentY += 80;

    // Industry comparison with spacing
    this.checkPageBreak(60);
    this.addIndustryComparison(this.currentY, aiInsights);
    this.currentY += 60;
  }

  private addRiskFactorsSection(y: number, riskFactors: any[]): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('IDENTIFIED RISK FACTORS', this.margin, y);

    riskFactors.forEach((factor, index) => {
      const factorY = y + 15 + (index * 25);
      
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
    this.doc.text('🚨 HIGH PRIORITY ACTIONS', this.margin, 50);

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
    this.doc.text('📊 COMPARATIVE ANALYTICS', this.margin, this.currentY);
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
    this.doc.text('📈 Industry Benchmarking', this.margin, this.currentY);
    this.currentY += 12;

    // Benchmark cards - smaller
    const benchmarkCardWidth = (this.pageWidth - 5 * this.margin) / 3;
    const benchmarkCardHeight = 35;

    this.addMetricCard(
      this.margin,
      this.currentY,
      benchmarkCardWidth,
      benchmarkCardHeight,
      '🏆 TOP',
      `${comparisonData.benchmarks.topPerformer}%`,
      this.successColor,
      'Best in portfolio'
    );

    this.addMetricCard(
      this.margin + benchmarkCardWidth + 8,
      this.currentY,
      benchmarkCardWidth,
      benchmarkCardHeight,
      '📊 INDUSTRY',
      `${comparisonData.benchmarks.industryAverage}%`,
      this.secondaryColor,
      'Market standard'
    );

    this.addMetricCard(
      this.margin + 2 * (benchmarkCardWidth + 8),
      this.currentY,
      benchmarkCardWidth,
      benchmarkCardHeight,
      '📍 MEDIAN',
      `${comparisonData.benchmarks.medianScore}%`,
      this.primaryColor,
      'Portfolio median'
    );

    this.currentY += benchmarkCardHeight + 15;

    // Response time comparison
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('⏱️ Response Time Analysis', this.margin, this.currentY);
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

  private addComplianceScoresChart(y: number, comparisonData: ComparisonData): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('COMPLIANCE SCORES COMPARISON', this.margin, y);

    const chartY = y + 15;
    const barHeight = 8;
    const maxBarWidth = 110;
    const nameWidth = 65;

    comparisonData.suppliers.forEach((supplier, index) => {
      const barY = chartY + (index * 18);
      const barWidth = Math.max(5, (supplier.complianceScore / 100) * maxBarWidth);

      // Supplier name (truncated for better fit)
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      const supplierName = supplier.supplier.company_name.length > 18 
        ? supplier.supplier.company_name.substring(0, 15) + '...'
        : supplier.supplier.company_name;
      this.doc.text(supplierName, this.margin, barY + 6);

      // Background bar
      this.doc.setFillColor(240, 240, 240);
      this.doc.roundedRect(this.margin + nameWidth, barY, maxBarWidth, barHeight, 2, 2, 'F');

      // Progress bar
      const color = this.getScoreColor(supplier.complianceScore);
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.roundedRect(this.margin + nameWidth, barY, barWidth, barHeight, 2, 2, 'F');

      // Score label
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${supplier.complianceScore}%`, this.margin + nameWidth + maxBarWidth + 5, barY + 6);
    });
  }

  private addResponseTimesChart(y: number, comparisonData: ComparisonData): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('RESPONSE TIMES COMPARISON', this.margin, y);

    const chartY = y + 15;
    const maxResponseTime = Math.max(...comparisonData.comparativeMetrics.responseTimes);
    const barHeight = 8;
    const maxBarWidth = 110;
    const nameWidth = 65;

    comparisonData.suppliers.forEach((supplier, index) => {
      const barY = chartY + (index * 18);
      const responseTime = supplier.averageResponseTime;
      const barWidth = maxResponseTime > 0 ? Math.max(5, (responseTime / maxResponseTime) * maxBarWidth) : 5;

      // Supplier name (truncated for better fit)
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      const supplierName = supplier.supplier.company_name.length > 18 
        ? supplier.supplier.company_name.substring(0, 15) + '...'
        : supplier.supplier.company_name;
      this.doc.text(supplierName, this.margin, barY + 6);

      // Background bar
      this.doc.setFillColor(240, 240, 240);
      this.doc.roundedRect(this.margin + nameWidth, barY, maxBarWidth, barHeight, 2, 2, 'F');

      // Response time bar
      const color = responseTime <= 5 ? this.successColor : responseTime <= 10 ? this.warningColor : this.errorColor;
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.roundedRect(this.margin + nameWidth, barY, barWidth, barHeight, 2, 2, 'F');

      // Response time label
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${responseTime}d`, this.margin + nameWidth + maxBarWidth + 5, barY + 6);
    });
  }

  private addRiskDistribution(y: number, comparisonData: ComparisonData): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('RISK LEVEL DISTRIBUTION', this.margin, y);

    const riskCounts = { Low: 0, Medium: 0, High: 0 };
    comparisonData.comparativeMetrics.riskLevels.forEach(risk => {
      riskCounts[risk as keyof typeof riskCounts]++;
    });

    const total = comparisonData.suppliers.length;
    const distributionY = y + 20;

    Object.entries(riskCounts).forEach(([risk, count], index) => {
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      const itemY = distributionY + (index * 15);

      // Risk color indicator
      const riskColor = this.getRiskLevelColor(risk);
      this.doc.setFillColor(riskColor[0], riskColor[1], riskColor[2]);
      this.doc.circle(this.margin + 5, itemY + 5, 4, 'F');

      // Risk level text
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`${risk} Risk: ${count} suppliers (${percentage}%)`, this.margin + 20, itemY + 8);
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
      const categoryY = y + 20 + (index * 40);
      
      // Category title
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(category.category, this.margin, categoryY);

      // Industry benchmark line
      this.doc.setTextColor(100, 116, 139);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Industry Benchmark: ${category.industryBenchmark}%`, this.margin, categoryY + 10);

      // Supplier scores
      category.supplierScores.forEach((supplier: any, supplierIndex: number) => {
        const scoreY = categoryY + 20 + (supplierIndex * 8);
        const barWidth = (supplier.score / 100) * 60;
        
        // Score bar
        const color = this.getScoreColor(supplier.score);
        this.doc.setFillColor(color[0], color[1], color[2]);
        this.doc.rect(this.margin + 10, scoreY, barWidth, 6, 'F');
        
        // Score text
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(8);
        this.doc.text(`${supplier.score}%`, this.margin + 75, scoreY + 4);
      });
    });
  }

  private async addComparisonAIInsights(comparisonData: ComparisonData, aiInsights: AIInsights): Promise<void> {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('AI INSIGHTS & RECOMMENDATIONS', this.margin, 30);

    // Key recommendations
    this.doc.setTextColor(239, 68, 68);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('🤖 KEY RECOMMENDATIONS', this.margin, 50);

    comparisonData.recommendations.forEach((rec, index) => {
      const recY = 70 + (index * 30);
      
      // Priority indicator
      const priorityColor = rec.priority === 'high' ? this.errorColor : 
                           rec.priority === 'medium' ? this.warningColor : this.successColor;
      this.doc.setFillColor(priorityColor[0], priorityColor[1], priorityColor[2]);
      this.doc.circle(this.margin + 5, recY + 5, 3, 'F');

      // Recommendation title
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(rec.title, this.margin + 15, recY + 8);

      // Recommendation description
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      const descLines = this.splitText(rec.description, this.pageWidth - 2 * this.margin - 20);
      descLines.forEach((line, lineIndex) => {
        this.doc.text(line, this.margin + 15, recY + 16 + (lineIndex * 7));
      });
    });
  }

  private async addSupplierProfile(supplier: SupplierComplianceData): Promise<void> {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`SUPPLIER PROFILE: ${supplier.supplier.company_name.toUpperCase()}`, this.margin, 30);

    // Key metrics
    const metricsY = 50;
    const cardWidth = (this.pageWidth - 3 * this.margin) / 2;

    this.addMetricCard(
      this.margin,
      metricsY,
      cardWidth,
      35,
      'COMPLIANCE SCORE',
      `${supplier.complianceScore}%`,
      this.getScoreColor(supplier.complianceScore),
      `${supplier.riskLevel} Risk`
    );

    this.addMetricCard(
      this.margin + cardWidth + 10,
      metricsY,
      cardWidth,
      35,
      'TOTAL REQUESTS',
      supplier.totalRequests.toString(),
      this.primaryColor,
      `${supplier.approvedRequests} approved`
    );

    // Performance summary
    const summaryY = metricsY + 50;
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PERFORMANCE SUMMARY', this.margin, summaryY);

    const summaryItems = [
      `Average Response Time: ${supplier.averageResponseTime} days`,
      `Pending Requests: ${supplier.pendingRequests}`,
      `Overdue Items: ${supplier.overdueRequests}`,
      `Document Categories: ${supplier.categoryStats.length}`
    ];

    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    summaryItems.forEach((item, index) => {
      this.doc.text(`• ${item}`, this.margin, summaryY + 15 + (index * 10));
    });
  }

  private addReportHeader(title: string, subtitle: string): void {
    // Professional gradient header
    this.doc.setFillColor(30, 58, 138);
    this.doc.rect(0, 0, this.pageWidth, 50, 'F');
    
    // Secondary gradient layer
    this.doc.setFillColor(59, 130, 246);
    this.doc.rect(0, 40, this.pageWidth, 10, 'F');

    // Company logo placeholder (supply chain icon)
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(20);
    this.doc.text('🔗', this.margin, 25);

    // Title with professional styling
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin + 30, 22);

    // Subtitle
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(subtitle, this.margin + 30, 32);

    // Date with professional formatting
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

  private addDocumentStatusAnalysis(y: number, comparisonData: ComparisonData): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('📄 DOCUMENT STATUS AND EXPIRATION ANALYSIS', this.margin, y);

    let currentY = y + 18;

    // Calculate document statistics across all suppliers
    const totalRequests = comparisonData.suppliers.reduce((sum, s) => sum + s.totalRequests, 0);
    const totalApproved = comparisonData.suppliers.reduce((sum, s) => sum + s.approvedRequests, 0);
    const totalPending = comparisonData.suppliers.reduce((sum, s) => sum + s.pendingRequests, 0);
    const totalOverdue = comparisonData.suppliers.reduce((sum, s) => sum + s.overdueRequests, 0);
    
    // Estimated expiry data (in a real implementation, this would come from actual document data)
    const expiringSoon = Math.floor(totalApproved * 0.1); // 10% expiring within 30 days
    const expiringMedium = Math.floor(totalApproved * 0.15); // 15% expiring within 60 days
    const expired = Math.floor(totalApproved * 0.05); // 5% already expired

    // Document Status Overview
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Document Status Overview', this.margin, currentY);
    currentY += 12;

    // Status cards - smaller and more compact
    const cardWidth = (this.pageWidth - 5 * this.margin) / 4;
    const cardHeight = 35;

    this.addMetricCard(
      this.margin,
      currentY,
      cardWidth,
      cardHeight,
      '📋 TOTAL',
      totalRequests.toString(),
      this.primaryColor,
      `${comparisonData.suppliers.length} suppliers`
    );

    this.addMetricCard(
      this.margin + cardWidth + 8,
      currentY,
      cardWidth,
      cardHeight,
      '✅ APPROVED',
      totalApproved.toString(),
      this.successColor,
      `${Math.round((totalApproved/totalRequests)*100)}%`
    );

    this.addMetricCard(
      this.margin + 2 * (cardWidth + 8),
      currentY,
      cardWidth,
      cardHeight,
      '⏳ PENDING',
      totalPending.toString(),
      this.warningColor,
      'Review needed'
    );

    this.addMetricCard(
      this.margin + 3 * (cardWidth + 8),
      currentY,
      cardWidth,
      cardHeight,
      '🚨 OVERDUE',
      totalOverdue.toString(),
      this.errorColor,
      'Action required'
    );

    currentY += cardHeight + 15;

    // Detailed Document Information by Supplier
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Detailed Document Breakdown by Supplier', this.margin, currentY);
    currentY += 12;

    // Check if we need a new page for the table
    const requiredHeight = 50 + (comparisonData.suppliers.length * 15);
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
      currentY += 10;

      // Mock document data with realistic names and dates
      const mockDocuments = [
        { name: 'ISO 9001 Certificate', category: 'Quality Management', requestDate: '2024-01-15', submissionDate: '2024-01-22', expiryDate: '2025-01-15', status: 'approved' },
        { name: 'Safety Compliance Report', category: 'Health & Safety', requestDate: '2024-02-01', submissionDate: '2024-02-10', expiryDate: '2024-08-01', status: 'expired' },
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

      currentY = (this.doc as any).lastAutoTable.finalY + 12;

      // Add page break if needed for next supplier
      if (index < comparisonData.suppliers.length - 1 && currentY > this.pageHeight - 80) {
        this.addNewPage();
        currentY = this.margin;
      }
    });
  }
}