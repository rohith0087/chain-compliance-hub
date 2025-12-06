import { SupplierComplianceData, ComparisonData } from './ComplianceDataService';
import { AIInsights } from './AdvancedPDFExportService';

export class AIInsightsService {
  private static readonly OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

  static async generateSupplierInsights(
    data: SupplierComplianceData,
    apiKey?: string
  ): Promise<AIInsights> {
    try {
      // Try to get API key from environment or use provided key
      const openaiKey = apiKey || await this.getOpenAIKey();
      
      if (!openaiKey) {
        console.log('No OpenAI API key available, using static insights');
        return this.generateStaticInsights(data);
      }

      const prompt = this.buildSupplierAnalysisPrompt(data);
      
      const response = await fetch(this.OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert compliance analyst specializing in supplier risk assessment and performance evaluation. Provide detailed, actionable insights based on the compliance data provided.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        console.error(`OpenAI API error: ${response.status} ${response.statusText}`);
        return this.generateStaticInsights(data);
      }

      const result = await response.json();
      const aiResponse = result.choices[0]?.message?.content;
      
      const parsedInsights = this.parseAIResponse(aiResponse);
      return parsedInsights || this.generateStaticInsights(data);

    } catch (error) {
      console.error('Error generating AI insights:', error);
      return this.generateStaticInsights(data);
    }
  }

  static async generateComparisonInsights(
    comparisonData: ComparisonData,
    apiKey?: string
  ): Promise<AIInsights> {
    try {
      const openaiKey = apiKey || await this.getOpenAIKey();
      
      if (!openaiKey) {
        console.log('No OpenAI API key available, using static comparison insights');
        return this.generateStaticComparisonInsights(comparisonData);
      }

      const prompt = this.buildComparisonAnalysisPrompt(comparisonData);
      
      const response = await fetch(this.OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert compliance analyst specializing in multi-supplier comparison and benchmarking. Provide strategic insights for supplier portfolio management.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = await response.json();
      const aiResponse = result.choices[0]?.message?.content;
      
      const parsedInsights = this.parseAIResponse(aiResponse);
      return parsedInsights || this.generateStaticComparisonInsights(comparisonData);

    } catch (error) {
      console.error('Error generating AI comparison insights:', error);
      return this.generateStaticComparisonInsights(comparisonData);
    }
  }

  // OpenAI API key is now only accessed server-side via edge functions
  // Static insights are always used for client-side analysis
  private static async getOpenAIKey(): Promise<string | null> {
    // API key retrieval removed for security - use static insights instead
    return null;
  }

  private static buildSupplierAnalysisPrompt(data: SupplierComplianceData): string {
    const itemMetadata = (data as any).itemMetadata;
    
    return `
Analyze the following supplier compliance data and provide detailed insights:

SUPPLIER: ${data.supplier.company_name}
INDUSTRY: ${data.supplier.industry || 'Not specified'}

PERFORMANCE METRICS:
- Compliance Score: ${data.complianceScore}%
- Total Requests: ${data.totalRequests}
- Approved: ${data.approvedRequests}
- Pending: ${data.pendingRequests}
- Rejected: ${data.rejectedRequests}
- Average Response Time: ${data.averageResponseTime} days
- Overdue Requests: ${data.overdueRequests}
- Risk Level: ${data.riskLevel}

CATEGORY PERFORMANCE:
${data.categoryStats.map(cat => 
  `- ${cat.category}: ${cat.approved}/${cat.total} approved (${Math.round((cat.approved/cat.total)*100)}%)`
).join('\n')}

${itemMetadata ? `
ITEM PORTFOLIO:
- Total Items: ${itemMetadata.totalItems}
- Categories: ${itemMetadata.categories.join(', ')}
- Items with Documents: ${itemMetadata.itemsWithDocs}
- Items Missing Documents: ${itemMetadata.itemsMissingDocs}
- Top Items: ${itemMetadata.topItems.join(', ')}
` : ''}

RISK FACTORS:
${data.riskFactors.map(risk => 
  `- ${risk.factor} (${risk.severity}): ${risk.description}`
).join('\n')}

Please provide:
1. A comprehensive risk assessment (2-3 sentences) including item-level risks if applicable
2. 3-5 specific actionable recommendations (prioritize item-specific gaps if applicable)
3. 2-3 key strengths of this supplier
4. 2-3 primary areas of concern (highlight item compliance gaps if present)
5. Industry comparison context (how they compare to typical industry standards)
6. Future outlook and potential trajectory

Format your response as JSON with these exact keys:
{
  "riskAssessment": "...",
  "recommendations": ["...", "...", "..."],
  "strengths": ["...", "...", "..."],
  "concerns": ["...", "...", "..."],
  "industryComparison": "...",
  "futureOutlook": "..."
}
`;
  }

  private static buildComparisonAnalysisPrompt(comparisonData: ComparisonData): string {
    const suppliersInfo = comparisonData.suppliers.map(s => 
      `${s.supplier.company_name}: ${s.complianceScore}% (${s.riskLevel} risk, ${s.averageResponseTime}d avg response)`
    ).join('\n');

    // Calculate document statistics for enhanced analysis
    const totalRequests = comparisonData.suppliers.reduce((sum, s) => sum + s.totalRequests, 0);
    const totalApproved = comparisonData.suppliers.reduce((sum, s) => sum + s.approvedRequests, 0);
    const totalOverdue = comparisonData.suppliers.reduce((sum, s) => sum + s.overdueRequests, 0);
    const expiringSoon = Math.floor(totalApproved * 0.1); // Estimate 10% expiring soon
    const expired = Math.floor(totalApproved * 0.05); // Estimate 5% expired

    return `
Analyze the following multi-supplier comparison data and provide strategic insights:

SUPPLIERS COMPARED: ${comparisonData.suppliers.length}
${suppliersInfo}

BENCHMARKS:
- Industry Average: ${comparisonData.benchmarks.industryAverage}%
- Top Performer: ${comparisonData.benchmarks.topPerformer}%
- Median Score: ${comparisonData.benchmarks.medianScore}%

COMPARATIVE METRICS:
- Compliance Scores: ${comparisonData.comparativeMetrics.complianceScores.join(', ')}%
- Response Times: ${comparisonData.comparativeMetrics.responseTimes.join(', ')} days
- Risk Levels: ${comparisonData.comparativeMetrics.riskLevels.join(', ')}

DOCUMENT STATUS ANALYSIS:
- Total Documents: ${totalRequests}
- Approved Documents: ${totalApproved}
- Overdue Documents: ${totalOverdue}
- Documents Expiring Soon: ${expiringSoon}
- Expired Documents: ${expired}

CATEGORY PERFORMANCE:
${comparisonData.comparativeMetrics.categoryPerformance.map(cat =>
  `- ${cat.category}: Industry benchmark ${cat.industryBenchmark}%`
).join('\n')}

CRITICAL FOCUS AREAS:
- Document expiry management and renewal processes
- Overdue submission follow-up procedures
- Compliance score improvement strategies
- Risk mitigation for underperforming suppliers

Please provide:
1. Overall portfolio risk assessment including document expiry risks
2. Strategic recommendations for supplier portfolio optimization and document management
3. Key strengths across the supplier base
4. Critical concerns requiring immediate attention (including expiry issues)
5. How this portfolio compares to industry standards
6. Future outlook for the supplier portfolio and compliance trajectory
7. Specific action items for document expiry management

Format your response as JSON with these exact keys:
{
  "riskAssessment": "...",
  "recommendations": ["...", "...", "..."],
  "strengths": ["...", "...", "..."],
  "concerns": ["...", "...", "..."],
  "industryComparison": "...",
  "futureOutlook": "..."
}
`;
  }

  private static parseAIResponse(response: string): AIInsights | null {
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the required fields
      if (!parsed.riskAssessment || !Array.isArray(parsed.recommendations)) {
        return null;
      }

      return {
        riskAssessment: parsed.riskAssessment,
        recommendations: parsed.recommendations || [],
        strengths: parsed.strengths || [],
        concerns: parsed.concerns || [],
        industryComparison: parsed.industryComparison || '',
        futureOutlook: parsed.futureOutlook || ''
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return null;
    }
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
      ? 'Strong portfolio foundation with clear path to excellence through focused development of underperforming suppliers.'
      : 'Portfolio requires strategic restructuring and intensive supplier development to achieve competitive compliance standards.';

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