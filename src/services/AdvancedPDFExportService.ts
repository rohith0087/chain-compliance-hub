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
  private primaryColor: [number, number, number] = [30, 58, 138];
  private secondaryColor: [number, number, number] = [59, 130, 246];
  private successColor: [number, number, number] = [34, 197, 94];
  private warningColor: [number, number, number] = [251, 191, 36];
  private errorColor: [number, number, number] = [239, 68, 68];

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 20;
  }

  async generateSingleSupplierReport(
    data: SupplierComplianceData,
    aiInsights: AIInsights,
    options: any
  ): Promise<void> {
    // Page 1: Executive Dashboard
    await this.addExecutiveDashboard(data, aiInsights);

    // Page 2: Detailed Analytics
    this.doc.addPage();
    await this.addDetailedAnalytics(data);

    // Page 3: AI Risk Assessment
    if (options.includeRiskAssessment) {
      this.doc.addPage();
      await this.addAIRiskAssessment(data, aiInsights);
    }

    // Page 4: Performance Timeline
    if (options.includeDocumentHistory) {
      this.doc.addPage();
      await this.addPerformanceTimeline(data);
    }

    // Page 5: AI Recommendations
    if (options.includeRecommendations) {
      this.doc.addPage();
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
    // Page 1: Executive Summary
    await this.addComparisonExecutiveSummary(comparisonData);

    // Page 2: Comparative Analytics
    this.doc.addPage();
    await this.addComparativeAnalytics(comparisonData);

    // Page 3: Benchmarking Analysis
    this.doc.addPage();
    await this.addBenchmarkingAnalysis(comparisonData);

    // Page 4: AI Insights & Recommendations
    if (options.includeRiskAssessment || options.includeRecommendations) {
      this.doc.addPage();
      await this.addComparisonAIInsights(comparisonData, aiInsights);
    }

    // Page 5: Detailed Supplier Profiles
    for (const supplier of comparisonData.suppliers) {
      this.doc.addPage();
      await this.addSupplierProfile(supplier);
    }

    // Add footer to all pages
    this.addPageFooters('Multi-Supplier Comparison');

    // Save the PDF
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `supplier_comparison_report_${timestamp}.pdf`;
    this.doc.save(fileName);
  }

  private async addExecutiveDashboard(data: SupplierComplianceData, aiInsights: AIInsights): Promise<void> {
    // Professional header
    this.addReportHeader('SUPPLIER COMPLIANCE DASHBOARD', data.supplier.company_name);

    // Key metrics cards layout
    const metricsY = 60;
    const cardWidth = (this.pageWidth - 3 * this.margin) / 2;
    const cardHeight = 40;

    // Compliance Score Card
    this.addMetricCard(
      this.margin,
      metricsY,
      cardWidth,
      cardHeight,
      'COMPLIANCE SCORE',
      `${data.complianceScore}%`,
      this.getScoreColor(data.complianceScore),
      `Target: 85%`
    );

    // Risk Level Card
    this.addMetricCard(
      this.margin + cardWidth + 10,
      metricsY,
      cardWidth,
      cardHeight,
      'RISK LEVEL',
      data.riskLevel.toUpperCase(),
      this.getRiskLevelColor(data.riskLevel),
      `${data.overdueRequests} overdue`
    );

    // Performance metrics row
    const secondRowY = metricsY + cardHeight + 15;
    const smallCardWidth = (this.pageWidth - 4 * this.margin) / 3;

    this.addMetricCard(
      this.margin,
      secondRowY,
      smallCardWidth,
      cardHeight,
      'TOTAL REQUESTS',
      data.totalRequests.toString(),
      this.primaryColor,
      `${data.approvedRequests} approved`
    );

    this.addMetricCard(
      this.margin + smallCardWidth + 10,
      secondRowY,
      smallCardWidth,
      cardHeight,
      'AVG RESPONSE',
      `${data.averageResponseTime} days`,
      data.averageResponseTime <= 5 ? this.successColor : this.warningColor,
      'Target: ≤5 days'
    );

    this.addMetricCard(
      this.margin + 2 * (smallCardWidth + 10),
      secondRowY,
      smallCardWidth,
      cardHeight,
      'PENDING ITEMS',
      data.pendingRequests.toString(),
      data.pendingRequests === 0 ? this.successColor : this.warningColor,
      'Needs attention'
    );

    // AI Quick Insights Box
    const insightsY = secondRowY + cardHeight + 20;
    this.addAIInsightsBox(insightsY, aiInsights);

    // Category Performance Chart
    const chartY = insightsY + 80;
    this.addCategoryPerformanceChart(chartY, data.categoryStats);
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
    // Card background
    this.doc.setFillColor(248, 250, 252);
    this.doc.roundedRect(x, y, width, height, 4, 4, 'F');

    // Card border
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(0.5);
    this.doc.roundedRect(x, y, width, height, 4, 4, 'S');

    // Title
    this.doc.setTextColor(100, 116, 139);
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(title, x + 8, y + 12);

    // Value
    this.doc.setTextColor(color[0], color[1], color[2]);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(value, x + 8, y + 26);

    // Subtitle
    this.doc.setTextColor(100, 116, 139);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(subtitle, x + 8, y + 35);
  }

  private addAIInsightsBox(y: number, aiInsights: AIInsights): void {
    const boxHeight = 70;
    
    // Background
    this.doc.setFillColor(239, 246, 255);
    this.doc.roundedRect(this.margin, y, this.pageWidth - 2 * this.margin, boxHeight, 6, 6, 'F');
    
    // Border
    this.doc.setDrawColor(59, 130, 246);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(this.margin, y, this.pageWidth - 2 * this.margin, boxHeight, 6, 6, 'S');

    // AI Icon and Title
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('🤖 AI RISK ASSESSMENT', this.margin + 10, y + 15);

    // Assessment text
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    
    const assessmentLines = this.splitText(aiInsights.riskAssessment, this.pageWidth - 2 * this.margin - 20);
    assessmentLines.slice(0, 4).forEach((line, index) => {
      this.doc.text(line, this.margin + 10, y + 30 + (index * 8));
    });
  }

  private addCategoryPerformanceChart(y: number, categoryStats: any[]): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('CATEGORY PERFORMANCE ANALYSIS', this.margin, y);

    const chartY = y + 20;
    const barHeight = 12;
    const maxBarWidth = 120;

    categoryStats.slice(0, 6).forEach((category, index) => {
      const barY = chartY + (index * (barHeight + 8));
      const percentage = category.total > 0 ? Math.round((category.approved / category.total) * 100) : 0;
      const barWidth = (percentage / 100) * maxBarWidth;

      // Category label
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(category.category, this.margin, barY + 8);

      // Background bar
      this.doc.setFillColor(226, 232, 240);
      this.doc.roundedRect(this.margin + 80, barY, maxBarWidth, barHeight, 2, 2, 'F');

      // Progress bar
      const color = this.getScoreColor(percentage);
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.roundedRect(this.margin + 80, barY, barWidth, barHeight, 2, 2, 'F');

      // Percentage label
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${percentage}%`, this.margin + 80 + maxBarWidth + 10, barY + 8);

      // Request count
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`(${category.approved}/${category.total})`, this.margin + 80 + maxBarWidth + 35, barY + 8);
    });
  }

  private async addDetailedAnalytics(data: SupplierComplianceData): Promise<void> {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('DETAILED ANALYTICS & TRENDS', this.margin, 30);

    // Performance metrics table
    this.addPerformanceMetricsTable(50, data.performanceMetrics);

    // Response time distribution
    this.addResponseTimeDistribution(120, data.responseTimeDistribution);

    // Monthly trends
    this.addMonthlyTrendsChart(180, data.monthlyTrends);
  }

  private addPerformanceMetricsTable(y: number, metrics: any[]): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PERFORMANCE METRICS', this.margin, y);

    const headers = ['Metric', 'Current', 'Target', 'Status', 'Trend'];
    const rows = metrics.map(metric => [
      metric.metric,
      `${metric.value}${metric.unit}`,
      `${metric.target}${metric.unit}`,
      metric.value >= metric.target ? '✓ On Target' : '⚠ Below Target',
      metric.trend === 'up' ? '↗ Improving' : metric.trend === 'down' ? '↘ Declining' : '→ Stable'
    ]);

    autoTable(this.doc, {
      startY: y + 10,
      head: [headers],
      body: rows,
      theme: 'grid',
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
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
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
    this.doc.text('MONTHLY TRENDS', this.margin, y);

    // Simple line chart representation
    const chartY = y + 20;
    const chartHeight = 40;
    const chartWidth = this.pageWidth - 2 * this.margin;
    const maxRequests = Math.max(...trends.map(t => t.requests));

    trends.forEach((trend, index) => {
      const x = this.margin + (index * (chartWidth / trends.length));
      const height = (trend.requests / maxRequests) * chartHeight;
      
      // Bar
      this.doc.setFillColor(59, 130, 246);
      this.doc.rect(x, chartY + chartHeight - height, 15, height, 'F');
      
      // Month label
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(trend.month, x, chartY + chartHeight + 10);
      
      // Value label
      this.doc.text(trend.requests.toString(), x + 2, chartY + chartHeight - height - 2);
    });
  }

  private async addAIRiskAssessment(data: SupplierComplianceData, aiInsights: AIInsights): Promise<void> {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('AI-POWERED RISK ASSESSMENT', this.margin, 30);

    // Risk factors section
    this.addRiskFactorsSection(50, data.riskFactors);

    // AI strengths and concerns
    this.addStrengthsAndConcerns(140, aiInsights);

    // Industry comparison
    this.addIndustryComparison(200, aiInsights);
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
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('COMPARATIVE ANALYTICS', this.margin, 30);

    // Compliance scores comparison
    this.addComplianceScoresChart(50, comparisonData);

    // Response times comparison  
    this.addResponseTimesChart(120, comparisonData);

    // Risk distribution
    this.addRiskDistribution(190, comparisonData);
  }

  private addComplianceScoresChart(y: number, comparisonData: ComparisonData): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('COMPLIANCE SCORES COMPARISON', this.margin, y);

    const chartY = y + 15;
    const barHeight = 12;
    const maxBarWidth = 120;

    comparisonData.suppliers.forEach((supplier, index) => {
      const barY = chartY + (index * (barHeight + 8));
      const barWidth = (supplier.complianceScore / 100) * maxBarWidth;

      // Supplier name
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      const supplierName = supplier.supplier.company_name.length > 20 
        ? supplier.supplier.company_name.substring(0, 17) + '...'
        : supplier.supplier.company_name;
      this.doc.text(supplierName, this.margin, barY + 8);

      // Background bar
      this.doc.setFillColor(226, 232, 240);
      this.doc.roundedRect(this.margin + 80, barY, maxBarWidth, barHeight, 2, 2, 'F');

      // Progress bar
      const color = this.getScoreColor(supplier.complianceScore);
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.roundedRect(this.margin + 80, barY, barWidth, barHeight, 2, 2, 'F');

      // Score label
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${supplier.complianceScore}%`, this.margin + 80 + maxBarWidth + 10, barY + 8);
    });
  }

  private addResponseTimesChart(y: number, comparisonData: ComparisonData): void {
    this.doc.setTextColor(30, 58, 138);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('RESPONSE TIMES COMPARISON', this.margin, y);

    const chartY = y + 15;
    const maxResponseTime = Math.max(...comparisonData.comparativeMetrics.responseTimes);

    comparisonData.suppliers.forEach((supplier, index) => {
      const barY = chartY + (index * 20);
      const responseTime = supplier.averageResponseTime;
      const barWidth = maxResponseTime > 0 ? (responseTime / maxResponseTime) * 100 : 0;

      // Supplier name
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      const supplierName = supplier.supplier.company_name.length > 20 
        ? supplier.supplier.company_name.substring(0, 17) + '...'
        : supplier.supplier.company_name;
      this.doc.text(supplierName, this.margin, barY + 8);

      // Response time bar
      const color = responseTime <= 5 ? this.successColor : responseTime <= 10 ? this.warningColor : this.errorColor;
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.rect(this.margin + 80, barY, barWidth, 10, 'F');

      // Response time label
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${responseTime} days`, this.margin + 80 + 105, barY + 8);
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
    // Gradient header background
    this.doc.setFillColor(30, 58, 138);
    this.doc.rect(0, 0, this.pageWidth, 45, 'F');

    // Title
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(22);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, 20);

    // Subtitle
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(subtitle, this.margin, 30);

    // Date
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    this.doc.text(`Generated: ${date}`, this.margin, 38);

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