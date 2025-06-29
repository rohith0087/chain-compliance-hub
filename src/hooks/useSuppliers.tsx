
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Supplier {
  id: string;
  company_name: string;
  contact_email: string;
  industry?: string;
  phone?: string;
  address?: string;
}

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name, contact_email, industry, phone, address')
        .order('company_name', { ascending: true });

      if (error) {
        console.error('Error fetching suppliers:', error);
        setError('Failed to load suppliers');
        return;
      }

      setSuppliers(data || []);
    } catch (err) {
      console.error('Error in fetchSuppliers:', err);
      setError('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  return {
    suppliers,
    loading,
    error,
    refetch: fetchSuppliers
  };
};
