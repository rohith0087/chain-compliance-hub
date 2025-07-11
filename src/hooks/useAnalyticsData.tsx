
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BuyerMetrics {
  buyerId: string;
  buyerName: string;
  industry: string;
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  complianceRate: number;
  avgResponseTime: number;
}

interface Buyer {
  id: string;
  company_name: string;
  industry: string;
}

export const useAnalyticsData = () => {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [buyerMetrics, setBuyerMetrics] = useState<BuyerMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadAnalyticsData = useCallback(async (
    selectedBuyers: string[], 
    dateRange: string, 
    category: string
  ) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Get supplier profile
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!supplier) {
        setError('Supplier profile not found');
        return;
      }

      // Get connected buyers
      const { data: connections, error: connectionsError } = await supabase
        .from('buyer_supplier_connections')
        .select(`
          buyers!inner (
            id,
            company_name,
            industry
          )
        `)
        .eq('supplier_id', supplier.id)
        .eq('status', 'approved');

      if (connectionsError) throw connectionsError;

      const buyersList = connections?.map(conn => conn.buyers).filter(Boolean) || [];
      setBuyers(buyersList);

      // Build date filter
      let dateFilter = '';
      const now = new Date();
      switch (dateRange) {
        case '30d':
          dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '90d':
          dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '180d':
          dateFilter = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '1y':
          dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
          break;
        default:
          dateFilter = '';
      }

      // Get document requests with filters
      let query = supabase
        .from('document_requests')
        .select(`
          id,
          status,
          created_at,
          updated_at,
          buyer_id,
          category
        `)
        .eq('supplier_id', supplier.id);

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      if (selectedBuyers.length > 0) {
        query = query.in('buyer_id', selectedBuyers);
      }

      const { data: requests, error: requestsError } = await query;

      if (requestsError) throw requestsError;

      // Calculate metrics for each buyer
      const metricsMap = new Map<string, BuyerMetrics>();

      buyersList.forEach(buyer => {
        if (selectedBuyers.length === 0 || selectedBuyers.includes(buyer.id)) {
          metricsMap.set(buyer.id, {
            buyerId: buyer.id,
            buyerName: buyer.company_name,
            industry: buyer.industry || 'Unknown',
            totalRequests: 0,
            approvedRequests: 0,
            pendingRequests: 0,
            rejectedRequests: 0,
            complianceRate: 0,
            avgResponseTime: 0
          });
        }
      });

      // Process requests
      requests?.forEach(request => {
        const metrics = metricsMap.get(request.buyer_id);
        if (!metrics) return;

        metrics.totalRequests++;

        switch (request.status) {
          case 'approved':
            metrics.approvedRequests++;
            break;
          case 'pending':
            metrics.pendingRequests++;
            break;
          case 'rejected':
            metrics.rejectedRequests++;
            break;
        }

        // Calculate response time (simplified - using updated_at - created_at)
        if (request.updated_at && request.created_at) {
          const responseTime = (new Date(request.updated_at).getTime() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24);
          metrics.avgResponseTime = (metrics.avgResponseTime + responseTime) / 2; // Simple average
        }
      });

      // Calculate compliance rates
      metricsMap.forEach(metrics => {
        if (metrics.totalRequests > 0) {
          metrics.complianceRate = Math.round((metrics.approvedRequests / metrics.totalRequests) * 100);
        }
      });

      setBuyerMetrics(Array.from(metricsMap.values()));

    } catch (err: any) {
      console.error('Error loading analytics data:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    buyers,
    buyerMetrics,
    loading,
    error,
    loadAnalyticsData
  };
};
