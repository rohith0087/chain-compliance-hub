
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BuyerMetrics {
  buyerId: string;
  buyerName: string;
  complianceRate: number;
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  avgResponseTime: number;
  industry: string;
}

interface Buyer {
  id: string;
  company_name: string;
  industry: string;
}

export const useAnalyticsData = () => {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [buyerMetrics, setBuyerMetrics] = useState<BuyerMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchBuyers = async (supplierId: string) => {
    const { data: connections, error: connectionsError } = await supabase
      .from('buyer_supplier_connections')
      .select(`
        buyer_id,
        buyers (
          id,
          company_name,
          industry
        )
      `)
      .eq('supplier_id', supplierId)
      .eq('status', 'approved');

    if (connectionsError) {
      console.error('Error fetching buyers:', connectionsError);
      return [];
    }

    return connections
      ?.map(connection => connection.buyers)
      .filter(buyer => buyer !== null) || [];
  };

  const calculateBuyerMetrics = async (
    supplierId: string,
    selectedBuyers: string[],
    dateRange: string,
    category: string
  ) => {
    let query = supabase
      .from('document_requests')
      .select(`
        *,
        buyers (
          id,
          company_name,
          industry
        )
      `)
      .eq('supplier_id', supplierId);

    // Apply buyer filter
    if (selectedBuyers.length > 0) {
      query = query.in('buyer_id', selectedBuyers);
    }

    // Apply category filter
    if (category) {
      query = query.eq('category', category);
    }

    // Apply date range filter
    if (dateRange !== 'all') {
      const days = {
        '30d': 30,
        '90d': 90,
        '180d': 180,
        '1y': 365
      }[dateRange] || 30;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      query = query.gte('created_at', cutoffDate.toISOString());
    }

    const { data: requests, error: requestsError } = await query;

    if (requestsError) {
      console.error('Error fetching document requests:', requestsError);
      return [];
    }

    // Group requests by buyer and calculate metrics
    const buyerGroups = requests?.reduce((acc, request) => {
      const buyerId = request.buyer_id;
      if (!buyerId || !request.buyers) return acc;

      if (!acc[buyerId]) {
        acc[buyerId] = {
          buyerId,
          buyerName: request.buyers.company_name,
          industry: request.buyers.industry || 'Not specified',
          requests: []
        };
      }

      acc[buyerId].requests.push(request);
      return acc;
    }, {} as Record<string, any>) || {};

    // Calculate metrics for each buyer
    const metrics: BuyerMetrics[] = Object.values(buyerGroups).map((group: any) => {
      const requests = group.requests;
      const totalRequests = requests.length;
      const approvedRequests = requests.filter((r: any) => r.status === 'approved').length;
      const pendingRequests = requests.filter((r: any) => r.status === 'pending').length;
      const rejectedRequests = requests.filter((r: any) => r.status === 'rejected').length;
      
      const complianceRate = totalRequests > 0 
        ? Math.round((approvedRequests / totalRequests) * 100) 
        : 0;

      // Calculate average response time (simplified - using created to updated time)
      const responseTimes = requests
        .filter((r: any) => r.updated_at && r.created_at && r.status !== 'pending')
        .map((r: any) => {
          const created = new Date(r.created_at);
          const updated = new Date(r.updated_at);
          return (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
        });

      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

      return {
        buyerId: group.buyerId,
        buyerName: group.buyerName,
        complianceRate,
        totalRequests,
        approvedRequests,
        pendingRequests,
        rejectedRequests,
        avgResponseTime,
        industry: group.industry
      };
    });

    return metrics;
  };

  const loadAnalyticsData = async (
    selectedBuyers: string[] = [],
    dateRange: string = '30d',
    category: string = ''
  ) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Get supplier profile
      const { data: supplierProfile } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!supplierProfile) {
        setError('Supplier profile not found');
        return;
      }

      // Fetch buyers and metrics
      const [buyersData, metricsData] = await Promise.all([
        fetchBuyers(supplierProfile.id),
        calculateBuyerMetrics(supplierProfile.id, selectedBuyers, dateRange, category)
      ]);

      setBuyers(buyersData);
      setBuyerMetrics(metricsData);
    } catch (err) {
      console.error('Error loading analytics data:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  return {
    buyers,
    buyerMetrics,
    loading,
    error,
    loadAnalyticsData
  };
};
