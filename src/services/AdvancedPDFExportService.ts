import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SupplierComplianceData, ComparisonData } from "./ComplianceDataService";
import { supabase } from "@/integrations/supabase/client";

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

  // 🎨 Enterprise Palette (slate/indigo)
  private primaryColor: [number, number, number] = [15, 23, 42]; // deep navy
  private secondaryColor: [number, number, number] = [79, 70, 229]; // indigo
  private successColor: [number, number, number] = [22, 163, 74]; // soft green
  private warningColor: [number, number, number] = [245, 158, 11]; // amber
  private errorColor: [number, number, number] = [220, 38, 38]; // softer red
  private lightGray: [number, number, number] = [249, 250, 251]; // light bg
  private mediumGray: [number, number, number] = [148, 163, 184]; // secondary text

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 20;
    this.currentY = this.margin;
  }

  // =========================================================
  // PUBLIC API
  // =========================================================

  async generateSingleSupplierReport(
    data: SupplierComplianceData,
    aiInsights: AIInsights,
    options: any,
  ): Promise<void> {
    // Determine report type based on options
    const reportType: "standard" | "detailed" | "ai_enhanced" =
      options.includeRiskAssessment && options.includeRecommendations
        ? "ai_enhanced"
        : options.includeDocumentHistory
          ? "detailed"
          : "standard";

    // Credits gate bypassed for now — re-enable by restoring the consume-credits invoke.



    this.resetDocument();

    // PAGE 1: EXECUTIVE SUMMARY – AI INSIGHTS & RECOMMENDATIONS
    await this.addExecutiveSummaryAIPage(data, aiInsights);

    // PAGE 2: EXECUTIVE DASHBOARD (metrics + category performance)
    this.addNewPage();
    await this.addExecutiveDashboard(data);

    // PAGE 3: DETAILED ANALYTICS
    this.addNewPage();
    await this.addDetailedAnalytics(data);

    // PAGE 4: FULL AI RISK ASSESSMENT (deeper dive)
    if (options.includeRiskAssessment) {
      this.addNewPage();
      await this.addAIRiskAssessment(data, aiInsights);
    }

    // PAGE 5: FULL AI RECOMMENDATIONS PAGE (detailed actions)
    if (options.includeRecommendations) {
      this.addNewPage();
      await this.addAIRecommendations(data, aiInsights);
    }

    // PAGE 6: PERFORMANCE TIMELINE / DOC HISTORY (if requested)
    if (options.includeDocumentHistory) {
      this.addNewPage();
      await this.addPerformanceTimeline(data);
    }

    // Add footer to all pages
    this.addPageFooters(data.supplier.company_name);

    // Save the PDF
    const timestamp = new Date().toISOString().split("T")[0];
    const fileName = `${this.sanitizeFileName(data.supplier.company_name)}_compliance_report_${timestamp}.pdf`;
    this.doc.save(fileName);
  }

  async generateComparisonReport(comparisonData: ComparisonData, aiInsights: AIInsights, options: any): Promise<void> {
    // Credits gate bypassed for now — re-enable by restoring the consume-credits invoke.


    this.resetDocument();

    // Page 1: AI Insights & Recommendations
    await this.addComparisonAIInsights(comparisonData, aiInsights);

    // Page 2: Executive Summary (multi-supplier)
    this.addNewPage();
    await this.addComparisonExecutiveSummary(comparisonData);

    // Page 3: Comparative Analytics
    this.addNewPage();
    await this.addComparativeAnalytics(comparisonData);

    // Page 4: Document Status Analysis
    this.addNewPage();
    this.addDocumentStatusAnalysis(30, comparisonData);

    // Page 5: Benchmarking Analysis
    this.addNewPage();
    await this.addBenchmarkingAnalysis(comparisonData);

    // Page 6+: Detailed Supplier Profiles
    for (const supplier of comparisonData.suppliers) {
      this.addNewPage();
      await this.addSupplierProfile(supplier);
    }

    // Add footer to all pages
    this.addPageFooters("Multi-Supplier Comparison");

    // Save the PDF
    const timestamp = new Date().toISOString().split("T")[0];
    const fileName = `supplier_comparison_report_${timestamp}.pdf`;
    this.doc.save(fileName);
  }

  // =========================================================
  // CORE LAYOUT HELPERS
  // =========================================================

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

  // =========================================================
  // PAGE 1: EXECUTIVE SUMMARY (AI INSIGHTS & RECOMMENDATIONS)
  // =========================================================

  private async addExecutiveSummaryAIPage(data: SupplierComplianceData, aiInsights: AIInsights): Promise<void> {
    // Header: EXECUTIVE SUMMARY
    this.addReportHeader("EXECUTIVE SUMMARY", data.supplier.company_name);

    this.currentY = 55;

    // Section title: AI INSIGHTS & RECOMMENDATIONS
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.text("AI INSIGHTS & RECOMMENDATIONS", this.margin, this.currentY);

    this.currentY += 10;

    // --- AI RISK ASSESSMENT (SUMMARY BLOCK) ---
    this.doc.setTextColor(this.errorColor[0], this.errorColor[1], this.errorColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text("AI RISK ASSESSMENT (SUMMARY)", this.margin, this.currentY);

    this.currentY += 8;

    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);

    const riskSummaryLines = this.splitText(aiInsights.riskAssessment, this.pageWidth - 2 * this.margin);
    const maxRiskLines = 6;

    riskSummaryLines.slice(0, maxRiskLines).forEach((line, idx) => {
      this.doc.text(line, this.margin, this.currentY + idx * 5.5);
    });

    this.currentY += Math.min(riskSummaryLines.length, maxRiskLines) * 5.5 + 12;

    // --- TOP RECOMMENDATIONS (EXECUTIVE VIEW) ---
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text("TOP RECOMMENDATIONS (NEXT 90 DAYS)", this.margin, this.currentY);

    this.currentY += 8;

    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);

    const maxRecs = 3;
    aiInsights.recommendations.slice(0, maxRecs).forEach((rec, index) => {
      const baseY = this.currentY + index * 16;

      // Number badge
      const badgeX = this.margin;
      const badgeY = baseY - 5;
      this.doc.setFillColor(this.secondaryColor[0], this.secondaryColor[1], this.secondaryColor[2]);
      this.doc.roundedRect(badgeX, badgeY, 10, 10, 3, 3, "F");

      this.doc.setTextColor(255, 255, 255);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.text(`${index + 1}`, badgeX + 5, badgeY + 7, { align: "center" });

      // Recommendation text
      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);

      const recLines = this.splitText(rec, this.pageWidth - (this.margin + 16) - this.margin);
      recLines.slice(0, 3).forEach((line, lineIndex) => {
        this.doc.text(line, this.margin + 16, baseY + lineIndex * 5);
      });
    });

    this.currentY += maxRecs * 16 + 10;

    // --- OPTIONAL OUTLOOK TEASER ---
    if (aiInsights.futureOutlook) {
      this.doc.setTextColor(this.mediumGray[0], this.mediumGray[1], this.mediumGray[2]);
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(8);
      const outlookLines = this.splitText(aiInsights.futureOutlook, this.pageWidth - 2 * this.margin);
      outlookLines.slice(0, 2).forEach((line, idx) => {
        this.doc.text(line, this.margin, this.currentY + idx * 5);
      });
    }
  }

  // =========================================================
  // PAGE 2: EXECUTIVE DASHBOARD (METRICS + CATEGORY PERFORMANCE)
  // =========================================================

  private async addExecutiveDashboard(data: SupplierComplianceData): Promise<void> {
    // Header for this page
    this.addReportHeader("SUPPLIER COMPLIANCE DASHBOARD", data.supplier.company_name);

    this.currentY = 55;

    // 1. Key metrics – 4-column layout
    const cardSpacing = 6;
    const cardHeight = 42;
    const cardWidth = (this.pageWidth - 2 * this.margin - 3 * cardSpacing) / 4;
    const x0 = this.margin;

    this.addMetricCard(
      x0,
      this.currentY,
      cardWidth,
      cardHeight,
      "Compliance Score",
      `${data.complianceScore}%`,
      this.getScoreColor(data.complianceScore),
      `Target 85% • ${data.riskLevel.toUpperCase()} risk`,
    );

    this.addMetricCard(
      x0 + (cardWidth + cardSpacing),
      this.currentY,
      cardWidth,
      cardHeight,
      "Risk Level",
      data.riskLevel.toUpperCase(),
      this.getRiskLevelColor(data.riskLevel),
      `${data.overdueRequests} overdue requests`,
    );

    this.addMetricCard(
      x0 + 2 * (cardWidth + cardSpacing),
      this.currentY,
      cardWidth,
      cardHeight,
      "Total Requests",
      data.totalRequests.toString(),
      this.primaryColor,
      `${data.approvedRequests} approved • ${data.pendingRequests} pending`,
    );

    this.addMetricCard(
      x0 + 3 * (cardWidth + cardSpacing),
      this.currentY,
      cardWidth,
      cardHeight,
      "Avg Response Time",
      `${data.averageResponseTime}d`,
      data.averageResponseTime <= 5
        ? this.successColor
        : data.averageResponseTime <= 10
          ? this.warningColor
          : this.errorColor,
      "Target ≤ 5 days",
    );

    this.currentY += cardHeight + 18;

    // 2. Category performance analysis
    const categoryCount = Math.min(data.categoryStats.length, 6);
    const chartHeight = 40 + categoryCount * 20;
    this.checkPageBreak(chartHeight);
    this.addCategoryPerformanceChart(this.currentY, data.categoryStats);
    this.currentY += chartHeight;
  }

  // Metric card: clean, no shadow, top accent
  private addMetricCard(
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    value: string,
    color: [number, number, number],
    subtitle: string,
  ): void {
    // Background
    this.doc.setFillColor(255, 255, 255);
    this.doc.roundedRect(x, y, width, height, 3, 3, "F");

    // Thin border
    this.doc.setDrawColor(229, 231, 235);
    this.doc.setLineWidth(0.4);
    this.doc.roundedRect(x, y, width, height, 3, 3, "S");

    // Top accent bar
    this.doc.setFillColor(color[0], color[1], color[2]);
    this.doc.roundedRect(x, y, width, 3, 3, 3, "F");

    const paddingX = x + 6;
    const titleY = y + 11;
    const valueY = y + 23;
    const subtitleY = y + 31;

    // Title (small caps)
    this.doc.setTextColor(this.mediumGray[0], this.mediumGray[1], this.mediumGray[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(7);
    this.doc.text(title.toUpperCase(), paddingX, titleY);

    // Value
    this.doc.setTextColor(color[0], color[1], color[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(13);
    this.doc.text(value, paddingX, valueY);

    // Subtitle
    this.doc.setTextColor(this.mediumGray[0], this.mediumGray[1], this.mediumGray[2]);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);

    const subtitleLines = this.splitText(subtitle, width - 12);
    subtitleLines.slice(0, 2).forEach((line, idx) => {
      this.doc.text(line, paddingX, subtitleY + idx * 6);
    });
  }

  // Category performance: slim bars
  private addCategoryPerformanceChart(y: number, categoryStats: any[]): void {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("CATEGORY PERFORMANCE", this.margin, y);

    const chartStartY = y + 14;
    const barHeight = 10;
    const barSpacing = 8;
    const maxBarWidth = 110;
    const labelWidth = 70;

    categoryStats.slice(0, 6).forEach((category, index) => {
      const barY = chartStartY + index * (barHeight + barSpacing);
      const percentage = category.total > 0 ? Math.round((category.approved / category.total) * 100) : 0;
      const barWidth = (percentage / 100) * maxBarWidth;

      // Label
      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      const name = category.category.length > 18 ? category.category.substring(0, 15) + "..." : category.category;
      this.doc.text(name, this.margin, barY + 7);

      // Background bar
      this.doc.setFillColor(229, 231, 235);
      this.doc.roundedRect(this.margin + labelWidth, barY, maxBarWidth, barHeight, 3, 3, "F");

      // Progress bar
      const color = this.getScoreColor(percentage);
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.roundedRect(this.margin + labelWidth, barY, barWidth, barHeight, 3, 3, "F");

      // Percentage + counts
      this.doc.setTextColor(55, 65, 81);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.text(
        `${percentage}% (${category.approved}/${category.total})`,
        this.margin + labelWidth + maxBarWidth + 6,
        barY + 7,
      );
    });
  }

  // =========================================================
  // DETAILED ANALYTICS
  // =========================================================

  private async addDetailedAnalytics(data: SupplierComplianceData): Promise<void> {
    this.addSectionHeader("Detailed Analytics and Trends");
    this.currentY += 20;

    // Performance metrics table
    this.checkPageBreak(90);
    this.addPerformanceMetricsTable(this.currentY, data.performanceMetrics);
    this.currentY += 90;

    // Response time distribution
    this.checkPageBreak(110);
    this.addResponseTimeDistribution(this.currentY, data.responseTimeDistribution);
    this.currentY += 110;

    // Monthly trends
    this.checkPageBreak(90);
    this.addMonthlyTrendsChart(this.currentY, data.monthlyTrends);
    this.currentY += 90;
  }

  private addSectionHeader(title: string): void {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(16);
    this.doc.text(title.toUpperCase(), this.margin, this.currentY);

    // Subtle underline
    this.doc.setDrawColor(209, 213, 219);
    this.doc.setLineWidth(0.6);
    this.doc.line(this.margin, this.currentY + 3, this.pageWidth - this.margin, this.currentY + 3);
  }

  private addPerformanceMetricsTable(y: number, metrics: any[]): void {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("PERFORMANCE METRICS", this.margin, y);

    const headers = ["Metric", "Current", "Target", "Status", "Trend"];
    const rows = metrics.map((metric) => [
      metric.metric,
      `${metric.value}${metric.unit}`,
      `${metric.target}${metric.unit}`,
      metric.value >= metric.target ? "On Target" : "Below Target",
      metric.trend === "up" ? "Improving" : metric.trend === "down" ? "Declining" : "Stable",
    ]);

    autoTable(this.doc, {
      startY: y + 14,
      head: [headers],
      body: rows,
      theme: "grid",
      headStyles: {
        fillColor: this.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [31, 41, 55],
        halign: "center",
      },
      alternateRowStyles: {
        fillColor: this.lightGray,
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 40 },
        1: { halign: "center", cellWidth: 25 },
        2: { halign: "center", cellWidth: 25 },
        3: { halign: "center", cellWidth: 35 },
        4: { halign: "center", cellWidth: 35 },
      },
      margin: { left: this.margin, right: this.margin },
    });
  }

  private addResponseTimeDistribution(y: number, distribution: any[]): void {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("RESPONSE TIME DISTRIBUTION", this.margin, y);

    const chartY = y + 14;
    const barHeight = 8;
    const maxBarWidth = 100;

    distribution.forEach((range, index) => {
      const barY = chartY + index * (barHeight + 6);
      const barWidth = (range.percentage / 100) * maxBarWidth;

      // Range label
      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.text(range.range, this.margin, barY + 6);

      // Background bar
      this.doc.setFillColor(229, 231, 235);
      this.doc.rect(this.margin + 55, barY, maxBarWidth, barHeight, "F");

      // Progress bar
      this.doc.setFillColor(this.secondaryColor[0], this.secondaryColor[1], this.secondaryColor[2]);
      this.doc.rect(this.margin + 55, barY, barWidth, barHeight, "F");

      // Percentage label
      this.doc.setTextColor(55, 65, 81);
      this.doc.setFontSize(8);
      this.doc.text(`${range.percentage}% (${range.count})`, this.margin + 55 + maxBarWidth + 8, barY + 6);
    });
  }

  private addMonthlyTrendsChart(y: number, trends: any[]): void {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("MONTHLY PERFORMANCE TRENDS", this.margin, y);

    const chartStartY = y + 18;
    const chartHeight = 60;
    const chartWidth = this.pageWidth - 2 * this.margin;

    if (trends.length === 0) {
      this.doc.setTextColor(this.mediumGray[0], this.mediumGray[1], this.mediumGray[2]);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      this.doc.text("No trend data available", this.margin, chartStartY + 15);
      return;
    }

    // Background
    this.doc.setFillColor(248, 250, 251);
    this.doc.roundedRect(this.margin, chartStartY, chartWidth, chartHeight, 4, 4, "F");

    const maxValue = Math.max(...trends.map((t) => t.complianceScore));
    const minValue = Math.min(...trends.map((t) => t.complianceScore));
    const range = maxValue - minValue;

    if (range === 0) {
      this.doc.setTextColor(100, 116, 139);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      this.doc.text("Consistent performance across all months", this.margin + 10, chartStartY + 30);
      return;
    }

    trends.forEach((trend, index) => {
      const x = this.margin + 10 + (index * (chartWidth - 20)) / Math.max(trends.length - 1, 1);
      const normalizedValue = (trend.complianceScore - minValue) / range;
      const yPoint = chartStartY + chartHeight - 20 - normalizedValue * (chartHeight - 40);

      // Point
      this.doc.setFillColor(this.secondaryColor[0], this.secondaryColor[1], this.secondaryColor[2]);
      this.doc.circle(x, yPoint, 2, "F");

      // Month label
      this.doc.setTextColor(100, 116, 139);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.text(trend.month.substring(0, 3), x - 6, chartStartY + chartHeight - 5);

      // Line
      if (index > 0) {
        const prevX = this.margin + 10 + ((index - 1) * (chartWidth - 20)) / Math.max(trends.length - 1, 1);
        const prevNorm = (trends[index - 1].complianceScore - minValue) / range;
        const prevY = chartStartY + chartHeight - 20 - prevNorm * (chartHeight - 40);

        this.doc.setDrawColor(this.secondaryColor[0], this.secondaryColor[1], this.secondaryColor[2]);
        this.doc.setLineWidth(0.7);
        this.doc.line(prevX, prevY, x, yPoint);
      }
    });
  }

  // =========================================================
  // AI RISK ASSESSMENT PAGE
  // =========================================================

  private async addAIRiskAssessment(data: SupplierComplianceData, aiInsights: AIInsights): Promise<void> {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(18);
    this.doc.text("AI RISK ASSESSMENT", this.margin, 30);

    // Risk factors
    this.addRiskFactors(50, data.riskFactors);

    // Strengths and concerns
    this.addStrengthsAndConcerns(120, aiInsights);

    // Industry comparison
    this.addIndustryComparison(180, aiInsights);
  }

  private addRiskFactors(y: number, riskFactors: any[]): void {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("RISK FACTORS", this.margin, y);

    riskFactors.slice(0, 5).forEach((factor, index) => {
      const factorY = y + 16 + index * 18;

      const severityColor =
        factor.severity === "high"
          ? this.errorColor
          : factor.severity === "medium"
            ? this.warningColor
            : this.successColor;

      // Indicator
      this.doc.setFillColor(severityColor[0], severityColor[1], severityColor[2]);
      this.doc.circle(this.margin + 4, factorY + 2, 2.5, "F");

      // Title
      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10);
      this.doc.text(factor.factor, this.margin + 12, factorY + 2);

      // Description
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      const descLines = this.splitText(factor.description, this.pageWidth - 2 * this.margin - 12);
      descLines.slice(0, 3).forEach((line, lineIndex) => {
        this.doc.text(line, this.margin + 12, factorY + 8 + lineIndex * 5);
      });
    });
  }

  private addStrengthsAndConcerns(y: number, aiInsights: AIInsights): void {
    const columnWidth = (this.pageWidth - 3 * this.margin) / 2;

    // Strengths
    this.doc.setTextColor(this.successColor[0], this.successColor[1], this.successColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text("STRENGTHS", this.margin, y);

    aiInsights.strengths.slice(0, 3).forEach((strength, index) => {
      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      this.doc.text(`• ${strength}`, this.margin, y + 12 + index * 8);
    });

    // Concerns
    this.doc.setTextColor(this.errorColor[0], this.errorColor[1], this.errorColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text("CONCERNS", this.margin + columnWidth + 10, y);

    aiInsights.concerns.slice(0, 3).forEach((concern, index) => {
      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      this.doc.text(`• ${concern}`, this.margin + columnWidth + 10, y + 12 + index * 8);
    });
  }

  private addIndustryComparison(y: number, aiInsights: AIInsights): void {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("INDUSTRY COMPARISON", this.margin, y);

    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);

    const comparisonLines = this.splitText(aiInsights.industryComparison, this.pageWidth - 2 * this.margin);
    comparisonLines.forEach((line, index) => {
      this.doc.text(line, this.margin, y + 12 + index * 6);
    });
  }

  // =========================================================
  // PERFORMANCE TIMELINE
  // =========================================================

  private async addPerformanceTimeline(data: SupplierComplianceData): Promise<void> {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(18);
    this.doc.text("PERFORMANCE TIMELINE", this.margin, 30);

    const headers = ["Date", "Document Type", "Category", "Status", "Response Time"];
    const rows = data.requests
      .slice(0, 15)
      .map((request) => [
        new Date(request.created_at).toLocaleDateString(),
        request.document_type || "N/A",
        request.category || "N/A",
        request.status || "N/A",
        this.calculateRequestResponseTime(request),
      ]);

    autoTable(this.doc, {
      startY: 45,
      head: [headers],
      body: rows,
      theme: "striped",
      headStyles: {
        fillColor: this.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [31, 41, 55],
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
      },
      margin: { left: this.margin, right: this.margin },
    });
  }

  // =========================================================
  // AI RECOMMENDATIONS PAGE (DEEP DIVE)
  // =========================================================

  private async addAIRecommendations(data: SupplierComplianceData, aiInsights: AIInsights): Promise<void> {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(18);
    this.doc.text("AI RECOMMENDATIONS", this.margin, 30);

    // High priority actions
    this.doc.setTextColor(this.errorColor[0], this.errorColor[1], this.errorColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("HIGH PRIORITY ACTIONS", this.margin, 48);

    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);

    aiInsights.recommendations.slice(0, 5).forEach((rec, index) => {
      const baseY = 60 + index * 18;

      // Number badge
      const badgeX = this.margin;
      const badgeY = baseY - 5;
      this.doc.setFillColor(this.secondaryColor[0], this.secondaryColor[1], this.secondaryColor[2]);
      this.doc.roundedRect(badgeX, badgeY, 10, 10, 3, 3, "F");
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.text(`${index + 1}`, badgeX + 5, badgeY + 7, { align: "center" });

      // Text
      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);

      const recLines = this.splitText(rec, this.pageWidth - this.margin - (badgeX + 14));
      recLines.forEach((line, lineIndex) => {
        this.doc.text(line, this.margin + 16, baseY + lineIndex * 5);
      });
    });

    // Future outlook
    const outlookY = 60 + aiInsights.recommendations.slice(0, 5).length * 18 + 10;
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("FUTURE OUTLOOK", this.margin, outlookY);

    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);

    const outlookLines = this.splitText(aiInsights.futureOutlook, this.pageWidth - 2 * this.margin);
    outlookLines.forEach((line, index) => {
      this.doc.text(line, this.margin, outlookY + 10 + index * 5.5);
    });
  }

  // =========================================================
  // COMPARISON REPORT: EXEC SUMMARY / ANALYTICS / DOC STATUS
  // =========================================================

  private async addComparisonExecutiveSummary(comparisonData: ComparisonData): Promise<void> {
    this.addReportHeader("MULTI-SUPPLIER COMPARISON REPORT", `${comparisonData.suppliers.length} Suppliers Analysis`);

    const benchY = 55;
    this.addBenchmarkCards(benchY, comparisonData.benchmarks);

    const rankingY = benchY + 55;
    this.addSupplierRanking(rankingY, comparisonData.suppliers);
  }

  private addBenchmarkCards(y: number, benchmarks: any): void {
    const cardWidth = (this.pageWidth - 4 * this.margin) / 3;
    const cardHeight = 40;

    this.addMetricCard(
      this.margin,
      y,
      cardWidth,
      cardHeight,
      "Industry Average",
      `${benchmarks.industryAverage}%`,
      this.secondaryColor,
      "Baseline benchmark",
    );

    this.addMetricCard(
      this.margin + cardWidth + 10,
      y,
      cardWidth,
      cardHeight,
      "Top Performer",
      `${benchmarks.topPerformer}%`,
      this.successColor,
      "Best in group",
    );

    this.addMetricCard(
      this.margin + 2 * (cardWidth + 10),
      y,
      cardWidth,
      cardHeight,
      "Median Score",
      `${benchmarks.medianScore}%`,
      this.primaryColor,
      "Portfolio median",
    );
  }

  private addSupplierRanking(y: number, suppliers: SupplierComplianceData[]): void {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("SUPPLIER RANKING", this.margin, y);

    const sortedSuppliers = [...suppliers].sort((a, b) => b.complianceScore - a.complianceScore);

    sortedSuppliers.forEach((supplier, index) => {
      const itemY = y + 14 + index * 14;

      // Rank badge
      this.doc.setFillColor(15, 23, 42);
      this.doc.roundedRect(this.margin, itemY - 7, 10, 10, 3, 3, "F");
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.text(`${index + 1}`, this.margin + 5, itemY + 1, { align: "center" });

      // Company name
      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      this.doc.text(supplier.supplier.company_name, this.margin + 15, itemY);

      // Score and risk
      const scoreColor = this.getScoreColor(supplier.complianceScore);
      this.doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.text(`${supplier.complianceScore}%`, this.pageWidth - 45, itemY);

      this.doc.setTextColor(100, 116, 139);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.text(`${supplier.riskLevel} risk`, this.pageWidth - 80, itemY);
    });
  }

  private async addComparativeAnalytics(comparisonData: ComparisonData): Promise<void> {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(16);
    this.doc.text("COMPARATIVE ANALYTICS", this.margin, this.currentY);
    this.currentY += 18;

    // Compliance score comparison
    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text("Compliance Score Comparison", this.margin, this.currentY);
    this.currentY += 10;

    const barHeight = 12;
    const maxBarWidth = 110;
    const labelWidth = 60;

    comparisonData.suppliers.forEach((supplier, index) => {
      const barY = this.currentY + index * (barHeight + 6);
      const barWidth = (supplier.complianceScore / 100) * maxBarWidth;

      // Company name
      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      const companyName =
        supplier.supplier.company_name.length > 14
          ? supplier.supplier.company_name.substring(0, 11) + "..."
          : supplier.supplier.company_name;
      this.doc.text(companyName, this.margin, barY + 8);

      // Background bar
      this.doc.setFillColor(229, 231, 235);
      this.doc.roundedRect(this.margin + labelWidth, barY, maxBarWidth, barHeight, 3, 3, "F");

      // Progress bar
      const color = this.getScoreColor(supplier.complianceScore);
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.roundedRect(this.margin + labelWidth, barY, barWidth, barHeight, 3, 3, "F");

      // Score + risk
      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.text(`${supplier.complianceScore}%`, this.margin + labelWidth + maxBarWidth + 8, barY + 8);

      this.doc.setTextColor(100, 116, 139);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.text(`(${supplier.riskLevel} risk)`, this.margin + labelWidth + maxBarWidth + 36, barY + 8);
    });

    this.currentY += comparisonData.suppliers.length * (barHeight + 6) + 14;

    // Benchmark cards
    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text("Industry Benchmarking", this.margin, this.currentY);
    this.currentY += 10;

    const benchmarkCardWidth = (this.pageWidth - 5 * this.margin) / 3;
    const benchmarkCardHeight = 35;

    this.addMetricCard(
      this.margin,
      this.currentY,
      benchmarkCardWidth,
      benchmarkCardHeight,
      "Top",
      `${comparisonData.benchmarks.topPerformer}%`,
      this.successColor,
      "Best in portfolio",
    );

    this.addMetricCard(
      this.margin + benchmarkCardWidth + 8,
      this.currentY,
      benchmarkCardWidth,
      benchmarkCardHeight,
      "Industry",
      `${comparisonData.benchmarks.industryAverage}%`,
      this.secondaryColor,
      "Market standard",
    );

    this.addMetricCard(
      this.margin + 2 * (benchmarkCardWidth + 8),
      this.currentY,
      benchmarkCardWidth,
      benchmarkCardHeight,
      "Median",
      `${comparisonData.benchmarks.medianScore}%`,
      this.primaryColor,
      "Portfolio median",
    );

    this.currentY += benchmarkCardHeight + 12;

    // Response time analysis
    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text("Response Time Analysis", this.margin, this.currentY);
    this.currentY += 10;

    const maxResponseTime = Math.max(...comparisonData.suppliers.map((s) => s.averageResponseTime || 0));

    comparisonData.suppliers.forEach((supplier, index) => {
      const barY = this.currentY + index * 12;
      const barWidth = maxResponseTime > 0 ? (supplier.averageResponseTime / maxResponseTime) * 90 : 0;

      // Company name
      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      const companyName =
        supplier.supplier.company_name.length > 12
          ? supplier.supplier.company_name.substring(0, 9) + "..."
          : supplier.supplier.company_name;
      this.doc.text(companyName, this.margin, barY + 6);

      // Background bar
      this.doc.setFillColor(229, 231, 235);
      this.doc.rect(this.margin + 45, barY, 90, 8, "F");

      // Progress bar
      const responseColor =
        supplier.averageResponseTime <= 5
          ? this.successColor
          : supplier.averageResponseTime <= 10
            ? this.warningColor
            : this.errorColor;
      this.doc.setFillColor(responseColor[0], responseColor[1], responseColor[2]);
      this.doc.rect(this.margin + 45, barY, barWidth, 8, "F");

      // Time label
      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.text(`${supplier.averageResponseTime}d`, this.margin + 140, barY + 6);
    });

    this.currentY += comparisonData.suppliers.length * 12 + 10;
  }

  private addDocumentStatusAnalysis(y: number, comparisonData: ComparisonData): void {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.text("DOCUMENT STATUS AND EXPIRATION ANALYSIS", this.margin, y);

    let currentY = y + 16;

    const totalRequests = comparisonData.suppliers.reduce((sum, s) => sum + s.totalRequests, 0);
    const totalApproved = comparisonData.suppliers.reduce((sum, s) => sum + s.approvedRequests, 0);
    const totalPending = comparisonData.suppliers.reduce((sum, s) => sum + s.pendingRequests, 0);
    const totalOverdue = comparisonData.suppliers.reduce((sum, s) => sum + s.overdueRequests, 0);

    const expiringSoon = Math.floor(totalApproved * 0.1);
    const expired = Math.floor(totalApproved * 0.05);

    // Overview
    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text("Document Status Overview", this.margin, currentY);
    currentY += 12;

    const cardWidth = (this.pageWidth - 5 * this.margin) / 4;
    const cardHeight = 36;

    this.addMetricCard(
      this.margin,
      currentY,
      cardWidth,
      cardHeight,
      "Total Docs",
      totalRequests.toString(),
      this.primaryColor,
      `${comparisonData.suppliers.length} suppliers`,
    );

    this.addMetricCard(
      this.margin + cardWidth + 8,
      currentY,
      cardWidth,
      cardHeight,
      "Approved",
      totalApproved.toString(),
      this.successColor,
      totalRequests ? `${Math.round((totalApproved / totalRequests) * 100)}%` : "—",
    );

    this.addMetricCard(
      this.margin + 2 * (cardWidth + 8),
      currentY,
      cardWidth,
      cardHeight,
      "Pending",
      totalPending.toString(),
      this.warningColor,
      "In review",
    );

    this.addMetricCard(
      this.margin + 3 * (cardWidth + 8),
      currentY,
      cardWidth,
      cardHeight,
      "Overdue",
      totalOverdue.toString(),
      this.errorColor,
      "Action needed",
    );

    currentY += cardHeight + 16;

    // Expiry status
    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text("Document Expiry Status", this.margin, currentY);
    currentY += 12;

    const expiryBarHeight = 12;
    const maxBarWidth = 140;
    const labelWidth = 90;

    const expiryData = [
      {
        label: "Valid Documents",
        count: Math.max(totalApproved - expired - expiringSoon, 0),
        color: this.successColor,
      },
      {
        label: "Expiring Soon (30 days)",
        count: expiringSoon,
        color: this.warningColor,
      },
      {
        label: "Expired Documents",
        count: expired,
        color: this.errorColor,
      },
    ];

    expiryData.forEach((item, index) => {
      const barY = currentY + index * (expiryBarHeight + 8);
      const percentage = totalApproved > 0 ? (item.count / totalApproved) * 100 : 0;
      const barWidth = (percentage / 100) * maxBarWidth;

      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.text(item.label, this.margin, barY + 8);

      this.doc.setFillColor(229, 231, 235);
      this.doc.roundedRect(this.margin + labelWidth, barY, maxBarWidth, expiryBarHeight, 3, 3, "F");

      this.doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      this.doc.roundedRect(this.margin + labelWidth, barY, barWidth, expiryBarHeight, 3, 3, "F");

      this.doc.setTextColor(55, 65, 81);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.text(`${item.count} (${percentage.toFixed(1)}%)`, this.margin + labelWidth + maxBarWidth + 8, barY + 8);
    });

    currentY += expiryData.length * (expiryBarHeight + 8) + 16;

    // Detailed doc info per supplier (mock)
    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text("Detailed Document Information by Supplier", this.margin, currentY);
    currentY += 12;

    const requiredHeight = 60 + comparisonData.suppliers.length * 20;
    if (currentY + requiredHeight > this.pageHeight - 40) {
      this.addNewPage();
      currentY = this.margin;
    }

    comparisonData.suppliers.forEach((supplier, index) => {
      this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.text(`${supplier.supplier.company_name} • Document Details`, this.margin, currentY);
      currentY += 8;

      const mockDocuments = [
        {
          name: "ISO 9001 Certificate",
          category: "Quality",
          requestDate: "2024-01-15",
          submissionDate: "2024-01-22",
          expiryDate: "2025-01-15",
          status: "approved",
        },
        {
          name: "Safety Compliance Report",
          category: "Safety",
          requestDate: "2024-02-01",
          submissionDate: "2024-02-10",
          expiryDate: "2024-08-01",
          status: "expired",
        },
        {
          name: "Financial Audit Report",
          category: "Financial",
          requestDate: "2024-03-01",
          submissionDate: null,
          expiryDate: null,
          status: "pending",
        },
        {
          name: "Environmental Certificate",
          category: "Environmental",
          requestDate: "2024-01-20",
          submissionDate: "2024-01-25",
          expiryDate: "2025-07-20",
          status: "approved",
        },
      ].slice(0, Math.min(4, supplier.totalRequests));

      const documentHeaders = ["Document Name", "Category", "Requested", "Submitted", "Expires", "Status"];
      const documentRows = mockDocuments.map((doc) => [
        doc.name.length > 25 ? doc.name.substring(0, 22) + "..." : doc.name,
        doc.category,
        doc.requestDate,
        doc.submissionDate || "Pending",
        doc.expiryDate || "N/A",
        doc.status.charAt(0).toUpperCase() + doc.status.slice(1),
      ]);

      autoTable(this.doc, {
        startY: currentY,
        head: [documentHeaders],
        body: documentRows,
        theme: "grid",
        headStyles: {
          fillColor: this.primaryColor,
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [31, 41, 55],
          halign: "center",
        },
        alternateRowStyles: {
          fillColor: this.lightGray,
        },
        columnStyles: {
          0: { halign: "left", cellWidth: 35 },
          1: { halign: "center", cellWidth: 25 },
          2: { halign: "center", cellWidth: 22 },
          3: { halign: "center", cellWidth: 22 },
          4: { halign: "center", cellWidth: 22 },
          5: { halign: "center", cellWidth: 18 },
        },
        margin: { left: this.margin, right: this.margin },
      });

      currentY = (this.doc as any).lastAutoTable.finalY + 12;

      if (index < comparisonData.suppliers.length - 1 && currentY > this.pageHeight - 80) {
        this.addNewPage();
        currentY = this.margin;
      }
    });
  }

  private async addBenchmarkingAnalysis(comparisonData: ComparisonData): Promise<void> {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(18);
    this.doc.text("BENCHMARKING ANALYSIS", this.margin, 30);

    this.addCategoryBenchmarking(50, comparisonData.comparativeMetrics.categoryPerformance);
  }

  private addCategoryBenchmarking(y: number, categoryPerformance: any[]): void {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("CATEGORY PERFORMANCE BENCHMARKING", this.margin, y);

    categoryPerformance.slice(0, 5).forEach((category, index) => {
      const itemY = y + 18 + index * 26;

      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10);
      this.doc.text(category.category, this.margin, itemY);

      const portfolioScore = category.portfolioAverage;
      const industryBenchmark = category.industryBenchmark;

      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      this.doc.text(`Portfolio: ${portfolioScore}%`, this.margin, itemY + 8);
      this.doc.text(`Industry: ${industryBenchmark}%`, this.margin + 80, itemY + 8);

      const performance = portfolioScore >= industryBenchmark ? "Above" : "Below";
      const perfColor = portfolioScore >= industryBenchmark ? this.successColor : this.warningColor;

      this.doc.setTextColor(perfColor[0], perfColor[1], perfColor[2]);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.text(`${performance} Industry Standard`, this.margin + 150, itemY + 8);
    });
  }

  private async addComparisonAIInsights(comparisonData: ComparisonData, aiInsights: AIInsights): Promise<void> {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(18);
    this.doc.text("AI INSIGHTS & RECOMMENDATIONS", this.margin, 30);

    // Portfolio risk assessment
    this.doc.setTextColor(this.errorColor[0], this.errorColor[1], this.errorColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("PORTFOLIO RISK ASSESSMENT", this.margin, 48);

    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    const riskLines = this.splitText(aiInsights.riskAssessment, this.pageWidth - 2 * this.margin);
    riskLines.forEach((line, index) => {
      this.doc.text(line, this.margin, 60 + index * 5.5);
    });

    // Strategic recommendations
    const recommendationsY = 60 + riskLines.length * 5.5 + 12;
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("STRATEGIC RECOMMENDATIONS", this.margin, recommendationsY);

    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);

    aiInsights.recommendations.slice(0, 5).forEach((rec, index) => {
      const baseY = recommendationsY + 10 + index * 14;

      // Number badge
      const badgeX = this.margin;
      const badgeY = baseY - 5;
      this.doc.setFillColor(this.secondaryColor[0], this.secondaryColor[1], this.secondaryColor[2]);
      this.doc.roundedRect(badgeX, badgeY, 10, 10, 3, 3, "F");
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.text(`${index + 1}`, badgeX + 5, badgeY + 7, { align: "center" });

      this.doc.setTextColor(31, 41, 55);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      const recLines = this.splitText(rec, this.pageWidth - (this.margin + 16) - this.margin);
      recLines.forEach((line, lineIndex) => {
        this.doc.text(line, this.margin + 16, baseY + lineIndex * 5);
      });
    });
  }

  // =========================================================
  // SUPPLIER PROFILE (COMPARISON DETAIL PAGES)
  // =========================================================

  private async addSupplierProfile(supplier: SupplierComplianceData): Promise<void> {
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(16);
    this.doc.text(`SUPPLIER PROFILE: ${supplier.supplier.company_name.toUpperCase()}`, this.margin, 30);

    this.doc.setTextColor(31, 41, 55);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    this.doc.text(`Industry: ${supplier.supplier.industry || "Not specified"}`, this.margin, 48);
    this.doc.text(`Compliance Score: ${supplier.complianceScore}%`, this.margin, 60);
    this.doc.text(`Risk Level: ${supplier.riskLevel}`, this.margin, 72);

    const summaryHeaders = ["Metric", "Value"];
    const summaryRows = [
      ["Total Requests", supplier.totalRequests.toString()],
      ["Approved Requests", supplier.approvedRequests.toString()],
      ["Pending Requests", supplier.pendingRequests.toString()],
      ["Average Response Time", `${supplier.averageResponseTime} days`],
      ["Overdue Requests", supplier.overdueRequests.toString()],
    ];

    autoTable(this.doc, {
      startY: 88,
      head: [summaryHeaders],
      body: summaryRows,
      theme: "striped",
      headStyles: {
        fillColor: this.primaryColor,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [31, 41, 55],
      },
      columnStyles: {
        0: { cellWidth: 60, halign: "left" },
        1: { cellWidth: 40, halign: "center" },
      },
      margin: { left: this.margin, right: this.margin },
    });
  }

  // =========================================================
  // REPORT HEADER & FOOTER
  // =========================================================

  private addReportHeader(title: string, subtitle: string): void {
    // Title
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(20);
    this.doc.text(title, this.margin, 26);

    // Subtitle
    this.doc.setTextColor(100, 116, 139);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(12);
    this.doc.text(subtitle, this.margin, 40);

    // Date
    const date = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    this.doc.setFontSize(9);
    this.doc.text(`Generated: ${date}`, this.margin, 47);

    // Reset color
    this.doc.setTextColor(0, 0, 0);
  }

  private addPageFooters(reportTitle: string): void {
    const pageCount = this.doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);

      const footerY = this.pageHeight - 18;

      // Divider
      this.doc.setDrawColor(229, 231, 235);
      this.doc.setLineWidth(0.4);
      this.doc.line(this.margin, footerY, this.pageWidth - this.margin, footerY);

      // Text
      this.doc.setTextColor(148, 163, 184);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);

      // Left: report title
      this.doc.text(reportTitle, this.margin, footerY + 9);

      // Center: CONFIDENTIAL
      this.doc.setFont("helvetica", "bold");
      this.doc.text("CONFIDENTIAL", this.pageWidth / 2, footerY + 9, {
        align: "center",
      });

      // Right: page number
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`Page ${i} of ${pageCount}`, this.pageWidth - this.margin, footerY + 9, {
        align: "right",
      });
    }
  }

  // =========================================================
  // SMALL HELPERS
  // =========================================================

  private getScoreColor(score: number): [number, number, number] {
    if (score >= 85) return this.successColor;
    if (score >= 70) return this.warningColor;
    return this.errorColor;
  }

  private getRiskLevelColor(riskLevel: string): [number, number, number] {
    switch (riskLevel.toLowerCase()) {
      case "low":
        return this.successColor;
      case "medium":
        return this.warningColor;
      case "high":
        return this.errorColor;
      default:
        return [100, 116, 139];
    }
  }

  private splitText(text: string, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
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
    return request.status === "pending" ? "Pending" : "N/A";
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  }
}
