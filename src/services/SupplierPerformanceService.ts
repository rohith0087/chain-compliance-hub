import { supabase } from '@/integrations/supabase/client';

export interface SupplierPerformanceMetrics {
  supplierId: string;
  buyerId: string;
  complianceScore: number;
  responseTimeAvg: number;
  onTimeSubmissionRate: number;
  documentQualityScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: Array<{ factor: string; severity: string; description: string }>;
  trendDirection: 'improving' | 'stable' | 'declining';
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  overdueRequests: number;
  expiredDocuments: number;
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: Array<{ factor: string; severity: string; description: string }>;
}

export class SupplierPerformanceService {
  /**
   * Calculate comprehensive performance metrics for a supplier-buyer relationship
   */
  static async calculateSupplierMetrics(
    supplierId: string,
    buyerId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<SupplierPerformanceMetrics | null> {
    try {
      // Fetch document requests for the period
      const { data: requests, error: requestsError } = await supabase
        .from('document_requests')
        .select(`
          *,
          document_uploads(*)
        `)
        .eq('supplier_id', supplierId)
        .eq('buyer_id', buyerId)
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());

      if (requestsError) throw requestsError;
      if (!requests || requests.length === 0) return null;

      // Calculate metrics
      const totalRequests = requests.length;
      const approvedRequests = requests.filter((r: any) => 
        r.document_uploads?.some((u: any) => u.status === 'approved')
      ).length;
      const pendingRequests = requests.filter((r: any) => r.status === 'pending').length;
      const rejectedRequests = requests.filter((r: any) =>
        r.document_uploads?.some((u: any) => u.status === 'rejected')
      ).length;
      const overdueRequests = requests.filter((r: any) => {
        if (!r.due_date) return false;
        return new Date(r.due_date) < new Date() && r.status === 'pending';
      }).length;

      // Fetch expired documents
      const { data: expiredDocs } = await supabase
        .from('document_uploads')
        .select('id')
        .eq('request_id', requests[0]?.id)
        .lt('expiration_date', new Date().toISOString());

      const expiredDocuments = expiredDocs?.length || 0;

      // Calculate response times
      const responseTimes = requests
        .filter((r: any) => r.document_uploads && r.document_uploads.length > 0)
        .map((r: any) => {
          const requestDate = new Date(r.created_at);
          const uploadDate = new Date(r.document_uploads[0].created_at);
          return (uploadDate.getTime() - requestDate.getTime()) / (1000 * 60 * 60); // hours
        });

      const responseTimeAvg = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

      // Calculate on-time submission rate
      const onTimeSubmissions = requests.filter((r: any) => {
        if (!r.due_date || !r.document_uploads || r.document_uploads.length === 0) return false;
        const dueDate = new Date(r.due_date);
        const uploadDate = new Date(r.document_uploads[0].created_at);
        return uploadDate <= dueDate;
      }).length;

      const onTimeSubmissionRate = totalRequests > 0
        ? (onTimeSubmissions / totalRequests) * 100
        : 0;

      // Calculate document quality score (based on approval rate)
      const documentQualityScore = totalRequests > 0
        ? (approvedRequests / totalRequests) * 100
        : 0;

      // Calculate compliance score (weighted average)
      const complianceScore = (
        (documentQualityScore * 0.4) +
        (onTimeSubmissionRate * 0.4) +
        (Math.max(0, 100 - (overdueRequests / Math.max(totalRequests, 1)) * 100) * 0.2)
      );

      // Calculate risk assessment
      const riskAssessment = this.calculateRiskAssessment({
        complianceScore,
        overdueRequests,
        totalRequests,
        rejectedRequests,
        expiredDocuments,
        responseTimeAvg
      });

      // Determine trend direction
      const { data: prevMetrics } = await supabase
        .from('supplier_performance_metrics')
        .select('compliance_score')
        .eq('supplier_id', supplierId)
        .eq('buyer_id', buyerId)
        .order('metric_period_end', { ascending: false })
        .limit(1)
        .single();

      let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';
      if (prevMetrics) {
        const diff = complianceScore - Number(prevMetrics.compliance_score);
        if (diff > 5) trendDirection = 'improving';
        else if (diff < -5) trendDirection = 'declining';
      }

      return {
        supplierId,
        buyerId,
        complianceScore,
        responseTimeAvg,
        onTimeSubmissionRate,
        documentQualityScore,
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.riskScore,
        riskFactors: riskAssessment.riskFactors,
        trendDirection,
        totalRequests,
        approvedRequests,
        pendingRequests,
        rejectedRequests,
        overdueRequests,
        expiredDocuments
      };
    } catch (error) {
      console.error('Error calculating supplier metrics:', error);
      return null;
    }
  }

  /**
   * Batch calculate metrics for all suppliers of a buyer
   */
  static async batchCalculateMetrics(buyerId: string): Promise<void> {
    try {
      const { data: connections } = await supabase
        .from('buyer_supplier_connections')
        .select('supplier_id')
        .eq('buyer_id', buyerId)
        .eq('status', 'approved');

      if (!connections) return;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1); // Last 30 days

      for (const connection of connections) {
        const metrics = await this.calculateSupplierMetrics(
          connection.supplier_id,
          buyerId,
          startDate,
          endDate
        );

        if (metrics) {
          await this.saveMetrics(metrics, startDate, endDate);
        }
      }
    } catch (error) {
      console.error('Error in batch calculation:', error);
    }
  }

  /**
   * Save metrics to database
   */
  private static async saveMetrics(
    metrics: SupplierPerformanceMetrics,
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    const { error } = await supabase
      .from('supplier_performance_metrics')
      .upsert({
        supplier_id: metrics.supplierId,
        buyer_id: metrics.buyerId,
        compliance_score: metrics.complianceScore,
        response_time_avg: metrics.responseTimeAvg,
        on_time_submission_rate: metrics.onTimeSubmissionRate,
        document_quality_score: metrics.documentQualityScore,
        risk_level: metrics.riskLevel,
        risk_score: metrics.riskScore,
        risk_factors: metrics.riskFactors,
        auto_calculated_risk: metrics.riskLevel,
        trend_direction: metrics.trendDirection,
        total_requests: metrics.totalRequests,
        approved_requests: metrics.approvedRequests,
        pending_requests: metrics.pendingRequests,
        rejected_requests: metrics.rejectedRequests,
        overdue_requests: metrics.overdueRequests,
        expired_documents: metrics.expiredDocuments,
        metric_period_start: periodStart.toISOString().split('T')[0],
        metric_period_end: periodEnd.toISOString().split('T')[0]
      }, {
        onConflict: 'supplier_id,buyer_id,metric_period_start,metric_period_end'
      });

    if (error) throw error;
  }

  /**
   * Calculate risk assessment with detailed factors
   */
  static calculateRiskAssessment(params: {
    complianceScore: number;
    overdueRequests: number;
    totalRequests: number;
    rejectedRequests: number;
    expiredDocuments: number;
    responseTimeAvg: number;
  }): RiskAssessment {
    const { complianceScore, overdueRequests, totalRequests, rejectedRequests, expiredDocuments, responseTimeAvg } = params;
    
    const riskFactors: Array<{ factor: string; severity: string; description: string }> = [];
    let riskScore = 0;

    // Compliance score risk
    if (complianceScore < 70) {
      riskScore += 30;
      riskFactors.push({
        factor: 'Low Compliance Score',
        severity: 'high',
        description: `Compliance score is ${complianceScore.toFixed(1)}% (below 70% threshold)`
      });
    } else if (complianceScore < 85) {
      riskScore += 15;
      riskFactors.push({
        factor: 'Medium Compliance Score',
        severity: 'medium',
        description: `Compliance score is ${complianceScore.toFixed(1)}% (below 85% threshold)`
      });
    }

    // Overdue rate risk
    const overdueRate = totalRequests > 0 ? (overdueRequests / totalRequests) * 100 : 0;
    if (overdueRate > 20) {
      riskScore += 25;
      riskFactors.push({
        factor: 'High Overdue Rate',
        severity: 'high',
        description: `${overdueRate.toFixed(1)}% of requests are overdue`
      });
    } else if (overdueRate > 10) {
      riskScore += 10;
      riskFactors.push({
        factor: 'Moderate Overdue Rate',
        severity: 'medium',
        description: `${overdueRate.toFixed(1)}% of requests are overdue`
      });
    }

    // Rejection rate risk
    const rejectionRate = totalRequests > 0 ? (rejectedRequests / totalRequests) * 100 : 0;
    if (rejectionRate > 15) {
      riskScore += 20;
      riskFactors.push({
        factor: 'High Rejection Rate',
        severity: 'high',
        description: `${rejectionRate.toFixed(1)}% of documents rejected`
      });
    } else if (rejectionRate > 8) {
      riskScore += 10;
      riskFactors.push({
        factor: 'Moderate Rejection Rate',
        severity: 'medium',
        description: `${rejectionRate.toFixed(1)}% of documents rejected`
      });
    }

    // Expired documents risk
    if (expiredDocuments > 5) {
      riskScore += 15;
      riskFactors.push({
        factor: 'Multiple Expired Documents',
        severity: 'high',
        description: `${expiredDocuments} expired documents`
      });
    } else if (expiredDocuments > 2) {
      riskScore += 8;
      riskFactors.push({
        factor: 'Some Expired Documents',
        severity: 'medium',
        description: `${expiredDocuments} expired documents`
      });
    }

    // Response time risk
    if (responseTimeAvg > 120) { // 5 days
      riskScore += 10;
      riskFactors.push({
        factor: 'Slow Response Time',
        severity: 'medium',
        description: `Average response time is ${(responseTimeAvg / 24).toFixed(1)} days`
      });
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 70) riskLevel = 'critical';
    else if (riskScore >= 45) riskLevel = 'high';
    else if (riskScore >= 25) riskLevel = 'medium';
    else riskLevel = 'low';

    return { riskLevel, riskScore, riskFactors };
  }

  /**
   * Get performance trends over time
   */
  static async getPerformanceTrends(
    supplierId: string,
    buyerId: string,
    months: number = 6
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('supplier_performance_metrics')
      .select('*')
      .eq('supplier_id', supplierId)
      .eq('buyer_id', buyerId)
      .order('metric_period_end', { ascending: false })
      .limit(months);

    if (error) {
      console.error('Error fetching trends:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Override risk level manually
   */
  static async overrideRiskLevel(
    supplierId: string,
    buyerId: string,
    newRiskLevel: 'low' | 'medium' | 'high' | 'critical',
    reason: string,
    overrideBy: string
  ): Promise<boolean> {
    try {
      // Get latest metric
      const { data: latestMetric } = await supabase
        .from('supplier_performance_metrics')
        .select('*')
        .eq('supplier_id', supplierId)
        .eq('buyer_id', buyerId)
        .order('metric_period_end', { ascending: false })
        .limit(1)
        .single();

      if (!latestMetric) return false;

      const { error } = await supabase
        .from('supplier_performance_metrics')
        .update({
          manual_risk_override: newRiskLevel,
          risk_override_reason: reason,
          risk_override_by: overrideBy,
          risk_override_at: new Date().toISOString(),
          risk_level: newRiskLevel
        })
        .eq('id', latestMetric.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error overriding risk level:', error);
      return false;
    }
  }
}
