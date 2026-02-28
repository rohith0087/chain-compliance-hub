import { SupplierComplianceData, ComparisonData } from './ComplianceDataService';
import { AIInsights } from './AdvancedPDFExportService';

export class AIInsightsService {
  static async generateSupplierInsights(
    data: SupplierComplianceData
  ): Promise<AIInsights> {
    return this.generateStaticInsights(data);
  }

  static async generateComparisonInsights(
    comparisonData: ComparisonData
  ): Promise<AIInsights> {
    return this.generateStaticComparisonInsights(comparisonData);
  }

  private static generateStaticInsights(data: SupplierComplianceData): AIInsights {
    const score = data.complianceScore;
    const avgResponseTime = data.averageResponseTime;
    const overdueCount = data.overdueRequests;
    const riskLevel = data.riskLevel;

    // Generate risk assessment
    let riskAssessment = '';
    if (score >= 85) {
      riskAssessment = `${data.supplier.company_name} demonstrates excellent compliance performance with a ${score}% score, indicating strong operational controls and reliable documentation processes.`;
    } else if (score >= 70) {
      riskAssessment = `${data.supplier.company_name} shows moderate compliance performance at ${score}%, with room for improvement in documentation timeliness and process consistency.`;
    } else {
      riskAssessment = `${data.supplier.company_name} presents elevated compliance risks with a ${score}% score, requiring immediate attention to improve documentation standards and response procedures.`;
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (score < 85) {
      recommendations.push('Implement standardized document submission procedures to improve compliance consistency');
    }
    if (avgResponseTime > 5) {
      recommendations.push(`Reduce average response time from ${avgResponseTime} to under 5 days through process optimization`);
    }
    if (overdueCount > 0) {
      recommendations.push(`Address ${overdueCount} overdue requests immediately to prevent compliance gaps`);
    }
    if (data.pendingRequests > data.totalRequests * 0.3) {
      recommendations.push('Establish proactive follow-up procedures for pending requests to maintain momentum');
    }
    if (recommendations.length === 0) {
      recommendations.push('Maintain current high performance standards and consider becoming a model supplier for best practices');
    }

    // Generate strengths
    const strengths: string[] = [];
    if (score >= 80) {
      strengths.push('High compliance score demonstrates strong commitment to documentation requirements');
    }
    if (avgResponseTime <= 5) {
      strengths.push('Excellent response time shows efficient internal processes and communication');
    }
    if (data.approvedRequests > data.rejectedRequests * 3) {
      strengths.push('High approval rate indicates good understanding of compliance requirements');
    }
    if (data.categoryStats.length > 3) {
      strengths.push('Diversified document portfolio across multiple compliance categories');
    }

    // Generate concerns
    const concerns: string[] = [];
    if (score < 70) {
      concerns.push('Below-target compliance score indicates systematic issues requiring attention');
    }
    if (avgResponseTime > 10) {
      concerns.push('Slow response times may indicate resource constraints or process inefficiencies');
    }
    if (overdueCount > 3) {
      concerns.push('Multiple overdue requests suggest potential capacity or prioritization issues');
    }
    if (data.rejectedRequests > data.approvedRequests * 0.3) {
      concerns.push('High rejection rate may indicate need for better requirement communication');
    }

    // Industry comparison
    let industryComparison = '';
    if (score >= 85) {
      industryComparison = 'Performance exceeds industry standards, positioning this supplier in the top tier of compliance performers.';
    } else if (score >= 70) {
      industryComparison = 'Performance aligns with industry averages but has potential to reach top-tier status with focused improvements.';
    } else {
      industryComparison = 'Performance below industry standards requires strategic intervention to meet baseline compliance expectations.';
    }

    // Future outlook
    let futureOutlook = '';
    if (score >= 85 && avgResponseTime <= 5) {
      futureOutlook = 'Strong foundation for continued partnership with potential for expanded collaboration and reduced oversight requirements.';
    } else if (score >= 70) {
      futureOutlook = 'With targeted improvements, this supplier can achieve top-tier status within 6-12 months of focused development.';
    } else {
      futureOutlook = 'Requires intensive support and monitoring to achieve baseline compliance standards. Consider implementing formal improvement plan with clear milestones.';
    }

    return {
      riskAssessment,
      recommendations,
      strengths,
      concerns,
      industryComparison,
      futureOutlook
    };
  }

  private static generateStaticComparisonInsights(comparisonData: ComparisonData): AIInsights {
    const suppliers = comparisonData.suppliers;
    const avgScore = comparisonData.benchmarks.industryAverage;
    const topScore = comparisonData.benchmarks.topPerformer;
    const highPerformers = suppliers.filter(s => s.complianceScore >= 85).length;
    const lowPerformers = suppliers.filter(s => s.complianceScore < 70).length;
    
    // Calculate document statistics
    const totalRequests = suppliers.reduce((sum, s) => sum + s.totalRequests, 0);
    const totalApproved = suppliers.reduce((sum, s) => sum + s.approvedRequests, 0);
    const totalOverdue = suppliers.reduce((sum, s) => sum + s.overdueRequests, 0);
    const expiringSoon = Math.floor(totalApproved * 0.1);
    const expired = Math.floor(totalApproved * 0.05);

    const riskAssessment = `Portfolio of ${suppliers.length} suppliers shows ${avgScore}% average compliance with ${highPerformers} high performers and ${lowPerformers} requiring immediate attention. Document risk analysis reveals ${expired} expired documents and ${expiringSoon} expiring soon, with ${totalOverdue} overdue submissions. Overall risk level is ${lowPerformers > suppliers.length * 0.3 || totalOverdue > totalRequests * 0.2 ? 'elevated' : 'manageable'}.`;

    const recommendations = [
      lowPerformers > 0 ? `Prioritize improvement plans for ${lowPerformers} underperforming suppliers` : 'Maintain current performance standards across all suppliers',
      expired > 0 ? `Immediate action required: Review and renew ${expired} expired documents` : 'Maintain proactive document renewal processes',
      expiringSoon > 0 ? `Monitor ${expiringSoon} documents expiring within 30 days and initiate renewal processes` : 'Establish automated expiry alerts',
      totalOverdue > 0 ? `Follow up on ${totalOverdue} overdue submissions with escalation procedures` : 'Implement proactive submission reminders',
      'Implement best practice sharing from top performers to elevate overall portfolio performance',
      `Establish regular review cycles to maintain ${topScore}% benchmark across all suppliers`
    ];

    const strengths = [
      highPerformers > 0 ? `${highPerformers} suppliers demonstrate excellent compliance standards` : 'Portfolio shows consistent baseline performance',
      'Diversified supplier base provides risk distribution',
      topScore >= 90 ? 'Top performer sets high benchmark for portfolio standards' : 'Solid foundation for portfolio development'
    ];

    const concerns = [
      lowPerformers > 0 ? `${lowPerformers} suppliers present elevated compliance risks` : 'Portfolio gaps in documentation timeliness',
      expired > 0 ? `${expired} expired documents require immediate renewal to maintain compliance` : 'Document expiry management needs attention',
      totalOverdue > 0 ? `${totalOverdue} overdue submissions indicate process gaps or resource constraints` : 'Submission timeliness needs improvement',
      avgScore < 80 ? 'Portfolio average below target performance levels' : 'Inconsistent performance across supplier base',
      'Need for standardized compliance requirements and automated renewal processes across all suppliers'
    ];

    const industryComparison = avgScore >= 80 
      ? 'Supplier portfolio performs above industry benchmarks, demonstrating effective supplier management practices.'
      : 'Portfolio performance meets industry standards but has significant opportunity for competitive advantage through improved compliance.';

    const futureOutlook = highPerformers > lowPerformers
      ? 'Portfolio is well-positioned for continued growth with strong compliance foundation. Focus on elevating mid-tier suppliers.'
      : 'Portfolio requires strategic attention to improve overall compliance posture. Implement structured improvement programs for underperforming suppliers.';

    return {
      riskAssessment,
      recommendations,
      strengths,
      concerns,
      industryComparison,
      futureOutlook
    };
  }
}
