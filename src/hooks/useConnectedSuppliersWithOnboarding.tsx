import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SupplierWithOnboardingStatus {
  id: string;
  company_name: string;
  contact_email: string;
  industry?: string;
  phone?: string;
  address?: string;
  connection_id: string;
  onboarding_request_id?: string;
  onboarding_status?: 'pending' | 'requested' | 'onboarding_initiated' | 'under_review' | 'none';
  has_active_onboarding: boolean;
}

export const useConnectedSuppliersWithOnboarding = (buyerId?: string) => {
  const [suppliers, setSuppliers] = useState<SupplierWithOnboardingStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = async () => {
    if (!buyerId) {
      setSuppliers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get all approved connections
      const { data: connections, error: connError } = await supabase
        .from('buyer_supplier_connections')
        .select('id, supplier_id')
        .eq('buyer_id', buyerId)
        .eq('status', 'approved');

      if (connError) throw connError;

      if (!connections || connections.length === 0) {
        setSuppliers([]);
        setLoading(false);
        return;
      }

      const supplierIds = connections.map(c => c.supplier_id).filter(Boolean);

      // Get supplier details
      const { data: suppliersData, error: suppError } = await supabase
        .from('suppliers')
        .select('id, company_name, contact_email, industry, phone, address')
        .in('id', supplierIds)
        .order('company_name', { ascending: true });

      if (suppError) throw suppError;

      // Get active onboarding requests for these suppliers
      const { data: onboardingData, error: onboardError } = await supabase
        .from('supplier_onboarding_requests')
        .select('id, supplier_id, status')
        .eq('buyer_id', buyerId)
        .in('supplier_id', supplierIds)
        .in('status', ['pending', 'requested', 'onboarding_initiated', 'under_review']);

      if (onboardError) throw onboardError;

      // Map onboarding requests by supplier_id
      const onboardingMap = new Map(
        (onboardingData || []).map(req => [req.supplier_id, req])
      );

      // Map connections by supplier_id
      const connectionMap = new Map(
        connections.map(conn => [conn.supplier_id, conn])
      );

      // Combine the data
      const suppliersWithStatus: SupplierWithOnboardingStatus[] = (suppliersData || []).map(supplier => {
        const onboarding = onboardingMap.get(supplier.id);
        const connection = connectionMap.get(supplier.id);
        
        return {
          ...supplier,
          connection_id: connection?.id || '',
          onboarding_request_id: onboarding?.id,
          onboarding_status: onboarding?.status as any || 'none',
          has_active_onboarding: !!onboarding
        };
      });

      setSuppliers(suppliersWithStatus);
    } catch (err: any) {
      console.error('Error fetching connected suppliers with onboarding:', err);
      setError(err.message || 'Failed to load suppliers');
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [buyerId]);

  return {
    suppliers,
    loading,
    error,
    refetch: fetchSuppliers
  };
};
