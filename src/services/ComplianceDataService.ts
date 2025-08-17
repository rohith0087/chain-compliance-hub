import { supabase } from '@/integrations/supabase/client';

export interface SupplierComplianceData {
  supplier: {
    id: string;
    company_name: string;
    contact_email: string;
    phone?: string;
    industry?: string;
    country?: string;
    company_logo_url?: string;
  };
  requests: any[];
  uploads: any[];
  categoryStats: CategoryStat[];
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  submittedRequests: number;
  complianceScore: number;
  riskLevel: string;
  averageResponseTime: number;
  overdueRequests: number;
  responseTimeDistribution: ResponseTimeStat[];
  documentTypes: DocumentTypeStat[];
  monthlyTrends: MonthlyTrendStat[];
  riskFactors: RiskFactor[];
  performanceMetrics: PerformanceMetric[];
}

export interface CategoryStat {
  category: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  submitted: number;
  averageResponseTime: number;
}

export interface ResponseTimeStat {
  range: string;
  count: number;
  percentage: number;
}

export interface DocumentTypeStat {
  type: string;
  total: number;
  approved: number;
  complianceRate: number;
}

export interface MonthlyTrendStat {
  month: string;
  requests: number;
  approvals: number;
  complianceScore: number;
}

export interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: number;
}

export interface PerformanceMetric {
  metric: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
}

export interface ComparisonData {
  suppliers: SupplierComplianceData[];
  benchmarks: {
    industryAverage: number;
    topPerformer: number;
    medianScore: number;
  };
  comparativeMetrics: {
    complianceScores: number[];
    responseTimes: number[];
    riskLevels: string[];
    categoryPerformance: CategoryComparison[];
  };
  recommendations: ComparisonRecommendation[];
}

export interface CategoryComparison {
  category: string;
  supplierScores: { supplierId: string; score: number }[];
  industryBenchmark: number;
}

export interface ComparisonRecommendation {
  type: 'strength' | 'weakness' | 'opportunity';
  title: string;
  description: string;
  affectedSuppliers: string[];
  priority: 'high' | 'medium' | 'low';
}

export class ComplianceDataService {
  static async getSupplierComplianceData(
    supplierId: string, 
    buyerId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<SupplierComplianceData> {
    try {
      // Get supplier basic info
      const { data: supplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .single();

      if (supplierError) throw supplierError;

      // Build date filter
      let dateFilter = '';
      const params: any = { buyer_id: buyerId, supplier_id: supplierId };
      
      if (dateRange?.from && dateRange?.to) {
        dateFilter = 'and(created_at.gte.{from},created_at.lte.{to})';
        params.from = dateRange.from.toISOString();
        params.to = dateRange.to.toISOString();
      }

      // Get document requests
      const { data: requests, error: requestsError } = await supabase
        .from('document_requests')
        .select(`
          *,
          document_uploads (*)
        `)
        .eq('buyer_id', buyerId)
        .eq('supplier_id', supplierId)
        .filter('created_at', 'gte', dateRange?.from?.toISOString() || '2020-01-01')
        .filter('created_at', 'lte', dateRange?.to?.toISOString() || new Date().toISOString())
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Get all uploads for the requests
      const requestIds = requests?.map(r => r.id) || [];
      const { data: uploads } = await supabase
        .from('document_uploads')
        .select('*')
        .in('request_id', requestIds);

      // Calculate basic stats
      const totalRequests = requests?.length || 0;
      const approvedRequests = requests?.filter(r => r.status === 'approved').length || 0;
      const pendingRequests = requests?.filter(r => r.status === 'pending').length || 0;
      const rejectedRequests = requests?.filter(r => r.status === 'rejected').length || 0;
      const submittedRequests = uploads?.filter(u => u.status === 'submitted').length || 0;

      const complianceScore = totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0;
      
      // Calculate average response time
      const responseTimes = requests?.map(request => {
        if (request.document_uploads?.length > 0) {
          const created = new Date(request.created_at);
          const uploaded = new Date(request.document_uploads[0].created_at);
          return Math.ceil((uploaded.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }
        return null;
      }).filter(time => time !== null) || [];

      const averageResponseTime = responseTimes.length > 0 
        ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length)
        : 0;

      // Calculate overdue requests
      const overdueRequests = requests?.filter(request => {
        if (request.status === 'pending' && request.due_date) {
          return new Date(request.due_date) < new Date();
        }
        return false;
      }).length || 0;

      // Calculate category stats
      const categoryStats = this.calculateCategoryStats(requests || []);

      // Calculate document type stats
      const documentTypes = this.calculateDocumentTypeStats(requests || []);

      // Calculate response time distribution
      const responseTimeDistribution = this.calculateResponseTimeDistribution(responseTimes);

      // Calculate monthly trends
      const monthlyTrends = this.calculateMonthlyTrends(requests || []);

      // Determine risk level
      const riskLevel = this.calculateRiskLevel(complianceScore, overdueRequests, averageResponseTime);

      // Calculate risk factors
      const riskFactors = this.calculateRiskFactors({
        complianceScore,
        overdueRequests,
        averageResponseTime,
        pendingRequests,
        totalRequests
      });

      // Calculate performance metrics
      const performanceMetrics = this.calculatePerformanceMetrics({
        complianceScore,
        averageResponseTime,
        approvedRequests,
        totalRequests,
        overdueRequests
      });

      return {
        supplier,
        requests: requests || [],
        uploads: uploads || [],
        categoryStats,
        totalRequests,
        approvedRequests,
        pendingRequests,
        rejectedRequests,
        submittedRequests,
        complianceScore,
        riskLevel,
        averageResponseTime,
        overdueRequests,
        responseTimeDistribution,
        documentTypes,
        monthlyTrends,
        riskFactors,
        performanceMetrics
      };

    } catch (error) {
      console.error('Error fetching supplier compliance data:', error);
      throw error;
    }
  }

  static async getMultiSupplierComparisonData(
    supplierIds: string[],
    buyerId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<ComparisonData> {
    try {
      // Get data for each supplier
      const supplierDataPromises = supplierIds.map(id => 
        this.getSupplierComplianceData(id, buyerId, dateRange)
      );
      
      const suppliers = await Promise.all(supplierDataPromises);

      // Calculate benchmarks
      const complianceScores = suppliers.map(s => s.complianceScore);
      const benchmarks = {
        industryAverage: Math.round(complianceScores.reduce((sum, score) => sum + score, 0) / complianceScores.length),
        topPerformer: Math.max(...complianceScores),
        medianScore: this.calculateMedian(complianceScores)
      };

      // Calculate comparative metrics
      const comparativeMetrics = {
        complianceScores,
        responseTimes: suppliers.map(s => s.averageResponseTime),
        riskLevels: suppliers.map(s => s.riskLevel),
        categoryPerformance: this.calculateCategoryComparison(suppliers)
      };

      // Generate comparison recommendations
      const recommendations = this.generateComparisonRecommendations(suppliers, benchmarks);

      return {
        suppliers,
        benchmarks,
        comparativeMetrics,
        recommendations
      };

    } catch (error) {
      console.error('Error fetching multi-supplier comparison data:', error);
      throw error;
    }
  }

  private static calculateCategoryStats(requests: any[]): CategoryStat[] {
    const categoryMap = new Map<string, CategoryStat>();

    requests.forEach(request => {
      const category = request.category || 'Uncategorized';
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          submitted: 0,
          averageResponseTime: 0
        });
      }

      const stat = categoryMap.get(category)!;
      stat.total++;
      
      if (request.status === 'approved') stat.approved++;
      if (request.status === 'pending') stat.pending++;
      if (request.status === 'rejected') stat.rejected++;
      if (request.document_uploads?.some((u: any) => u.status === 'submitted')) stat.submitted++;
    });

    return Array.from(categoryMap.values());
  }

  private static calculateDocumentTypeStats(requests: any[]): DocumentTypeStat[] {
    const typeMap = new Map<string, DocumentTypeStat>();

    requests.forEach(request => {
      const type = request.document_type || 'Other';
      
      if (!typeMap.has(type)) {
        typeMap.set(type, {
          type,
          total: 0,
          approved: 0,
          complianceRate: 0
        });
      }

      const stat = typeMap.get(type)!;
      stat.total++;
      if (request.status === 'approved') stat.approved++;
    });

    // Calculate compliance rates
    Array.from(typeMap.values()).forEach(stat => {
      stat.complianceRate = stat.total > 0 ? Math.round((stat.approved / stat.total) * 100) : 0;
    });

    return Array.from(typeMap.values());
  }

  private static calculateResponseTimeDistribution(responseTimes: number[]): ResponseTimeStat[] {
    const ranges = [
      { range: '0-1 days', min: 0, max: 1 },
      { range: '2-3 days', min: 2, max: 3 },
      { range: '4-7 days', min: 4, max: 7 },
      { range: '8-14 days', min: 8, max: 14 },
      { range: '15+ days', min: 15, max: Infinity }
    ];

    const total = responseTimes.length;
    
    return ranges.map(range => {
      const count = responseTimes.filter(time => time >= range.min && time <= range.max).length;
      return {
        range: range.range,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      };
    });
  }

  private static calculateMonthlyTrends(requests: any[]): MonthlyTrendStat[] {
    const monthMap = new Map<string, MonthlyTrendStat>();

    requests.forEach(request => {
      const date = new Date(request.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthName,
          requests: 0,
          approvals: 0,
          complianceScore: 0
        });
      }

      const trend = monthMap.get(monthKey)!;
      trend.requests++;
      if (request.status === 'approved') trend.approvals++;
    });

    // Calculate compliance scores
    Array.from(monthMap.values()).forEach(trend => {
      trend.complianceScore = trend.requests > 0 ? Math.round((trend.approvals / trend.requests) * 100) : 0;
    });

    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }

  private static calculateRiskLevel(complianceScore: number, overdueRequests: number, averageResponseTime: number): string {
    let riskPoints = 0;

    // Compliance score risk
    if (complianceScore < 70) riskPoints += 3;
    else if (complianceScore < 85) riskPoints += 1;

    // Overdue requests risk
    if (overdueRequests > 5) riskPoints += 3;
    else if (overdueRequests > 2) riskPoints += 2;
    else if (overdueRequests > 0) riskPoints += 1;

    // Response time risk
    if (averageResponseTime > 10) riskPoints += 2;
    else if (averageResponseTime > 5) riskPoints += 1;

    if (riskPoints >= 5) return 'High';
    if (riskPoints >= 2) return 'Medium';
    return 'Low';
  }

  private static calculateRiskFactors(data: {
    complianceScore: number;
    overdueRequests: number;
    averageResponseTime: number;
    pendingRequests: number;
    totalRequests: number;
  }): RiskFactor[] {
    const factors: RiskFactor[] = [];

    if (data.complianceScore < 70) {
      factors.push({
        factor: 'Low Compliance Score',
        severity: 'high',
        description: 'Compliance score is below acceptable threshold of 70%',
        impact: 9
      });
    }

    if (data.overdueRequests > 3) {
      factors.push({
        factor: 'High Overdue Requests',
        severity: 'high',
        description: 'Multiple requests are past due date',
        impact: 8
      });
    }

    if (data.averageResponseTime > 7) {
      factors.push({
        factor: 'Slow Response Time',
        severity: 'medium',
        description: 'Average response time exceeds 7 days',
        impact: 6
      });
    }

    if (data.pendingRequests / data.totalRequests > 0.3) {
      factors.push({
        factor: 'High Pending Ratio',
        severity: 'medium',
        description: 'More than 30% of requests are still pending',
        impact: 5
      });
    }

    return factors;
  }

  private static calculatePerformanceMetrics(data: {
    complianceScore: number;
    averageResponseTime: number;
    approvedRequests: number;
    totalRequests: number;
    overdueRequests: number;
  }): PerformanceMetric[] {
    return [
      {
        metric: 'Compliance Score',
        value: data.complianceScore,
        target: 85,
        unit: '%',
        trend: data.complianceScore >= 85 ? 'up' : 'down'
      },
      {
        metric: 'Response Time',
        value: data.averageResponseTime,
        target: 5,
        unit: 'days',
        trend: data.averageResponseTime <= 5 ? 'up' : 'down'
      },
      {
        metric: 'Approval Rate',
        value: data.totalRequests > 0 ? Math.round((data.approvedRequests / data.totalRequests) * 100) : 0,
        target: 90,
        unit: '%',
        trend: 'stable'
      },
      {
        metric: 'Overdue Count',
        value: data.overdueRequests,
        target: 0,
        unit: 'requests',
        trend: data.overdueRequests === 0 ? 'up' : 'down'
      }
    ];
  }

  private static calculateCategoryComparison(suppliers: SupplierComplianceData[]): CategoryComparison[] {
    const allCategories = new Set<string>();
    
    suppliers.forEach(supplier => {
      supplier.categoryStats.forEach(stat => {
        allCategories.add(stat.category);
      });
    });

    return Array.from(allCategories).map(category => {
      const supplierScores = suppliers.map(supplier => {
        const stat = supplier.categoryStats.find(s => s.category === category);
        const score = stat ? Math.round((stat.approved / stat.total) * 100) : 0;
        return { supplierId: supplier.supplier.id, score };
      });

      const industryBenchmark = Math.round(
        supplierScores.reduce((sum, s) => sum + s.score, 0) / supplierScores.length
      );

      return {
        category,
        supplierScores,
        industryBenchmark
      };
    });
  }

  private static generateComparisonRecommendations(
    suppliers: SupplierComplianceData[],
    benchmarks: any
  ): ComparisonRecommendation[] {
    const recommendations: ComparisonRecommendation[] = [];

    // Find top performer
    const topPerformer = suppliers.reduce((max, current) => 
      current.complianceScore > max.complianceScore ? current : max
    );

    recommendations.push({
      type: 'strength',
      title: 'Top Performing Supplier',
      description: `${topPerformer.supplier.company_name} demonstrates excellent compliance with ${topPerformer.complianceScore}% score`,
      affectedSuppliers: [topPerformer.supplier.id],
      priority: 'high'
    });

    // Find suppliers needing improvement
    const underPerformers = suppliers.filter(s => s.complianceScore < benchmarks.industryAverage);
    
    if (underPerformers.length > 0) {
      recommendations.push({
        type: 'weakness',
        title: 'Below Average Performance',
        description: `${underPerformers.length} supplier(s) performing below industry average of ${benchmarks.industryAverage}%`,
        affectedSuppliers: underPerformers.map(s => s.supplier.id),
        priority: 'high'
      });
    }

    return recommendations;
  }

  private static calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
    }
    
    return sorted[middle];
  }
}