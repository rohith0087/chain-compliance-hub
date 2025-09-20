import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BuyerSupplierConnection {
  id: string;
  buyer_id: string;
  supplier_id: string;
  status: string;
  supplier?: {
    id: string;
    company_name: string;
    contact_email: string;
    industry?: string;
    phone?: string;
    address?: string;
  } | null;
}

export const useBuyerSupplierConnections = (buyerId?: string) => {
  const [connections, setConnections] = useState<BuyerSupplierConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (buyerId) {
      fetchConnections();
    }
  }, [buyerId]);

  const fetchConnections = async () => {
    if (!buyerId) return;
    
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('buyer_supplier_connections')
        .select(`
          id,
          buyer_id,
          supplier_id,
          status,
          suppliers (
            id,
            company_name,
            contact_email,
            industry,
            phone,
            address
          )
        `)
        .eq('buyer_id', buyerId)
        .eq('status', 'approved')
        .order('requested_at', { ascending: false });

      if (error) {
        console.error('Error fetching buyer supplier connections:', error);
        setError('Failed to load connected suppliers');
        return;
      }

      setConnections(data || []);
    } catch (err) {
      console.error('Error in fetchConnections:', err);
      setError('Failed to load connected suppliers');
    } finally {
      setLoading(false);
    }
  };

  return {
    connections,
    loading,
    error,
    refetch: fetchConnections
  };
};