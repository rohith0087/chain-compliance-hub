import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SupplierPerformance {
  id: string;
  supplier_id: string;
  buyer_id: string;
  compliance_score: number;
  response_time_avg: number;
  on_time_submission_rate: number;
  document_quality_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  risk_factors: any[];
  trend_direction: 'improving' | 'stable' | 'declining';
  total_requests: number;
  approved_requests: number;
  pending_requests: number;
  rejected_requests: number;
  overdue_requests: number;
  expired_documents: number;
  supplier?: {
    company_name: string;
    industry: string;
  };
}

export const useSupplierPerformance = (buyerId?: string) => {
  const [performance, setPerformance] = useState<SupplierPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    if (buyerId || profile) {
      loadPerformance();
    }
  }, [buyerId, profile]);

  const loadPerformance = async () => {
    try {
      setLoading(true);

      // Get buyer ID
      let targetBuyerId = buyerId;
      if (!targetBuyerId && profile) {
        const { data: buyer } = await supabase
          .from('buyers')
          .select('id')
          .eq('profile_id', profile.id)
          .single();
        targetBuyerId = buyer?.id;
      }

      if (!targetBuyerId) {
        setPerformance([]);
        return;
      }

      // Get latest metrics for all suppliers
      const { data, error } = await supabase
        .from('supplier_performance_metrics')
        .select(`
          *,
          supplier:suppliers(company_name, industry)
        `)
        .eq('buyer_id', targetBuyerId)
        .order('metric_period_end', { ascending: false });

      if (error) throw error;

      // Group by supplier and get latest
      const latestMetrics = new Map();
      data?.forEach((metric: any) => {
        if (!latestMetrics.has(metric.supplier_id) ||
            new Date(metric.metric_period_end) > new Date(latestMetrics.get(metric.supplier_id).metric_period_end)) {
          latestMetrics.set(metric.supplier_id, metric);
        }
      });

      setPerformance(Array.from(latestMetrics.values()));
    } catch (error) {
      console.error('Error loading supplier performance:', error);
      setPerformance([]);
    } finally {
      setLoading(false);
    }
  };

  return { performance, loading, refresh: loadPerformance };
};
