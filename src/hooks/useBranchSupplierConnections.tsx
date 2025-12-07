import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BranchSupplierConnection {
  id: string;
  branch_id: string;
  supplier_id: string;
  buyer_id: string;
  status: string;
  assigned_by?: string;
  assigned_at: string;
  notes?: string;
  supplier?: {
    company_name: string;
    contact_email: string;
    industry?: string;
    phone?: string;
    address?: string;
  } | null;
  branch?: {
    branch_name: string;
    location?: string;
  } | null;
}

export const useBranchSupplierConnections = (branchId?: string) => {
  const [connections, setConnections] = useState<BranchSupplierConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (branchId) {
      fetchBranchSuppliers();
    }
  }, [branchId]);

  // Set up real-time subscription for branch supplier connections
  useEffect(() => {
    if (!branchId) return;

    const channel = supabase
      .channel('branch-supplier-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branch_supplier_connections',
          filter: `branch_id=eq.${branchId}`
        },
        () => {
          fetchBranchSuppliers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId]);

  const fetchBranchSuppliers = async () => {
    if (!branchId) return;
    
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('branch_supplier_connections')
        .select(`
          id,
          branch_id,
          supplier_id,
          buyer_id,
          status,
          assigned_by,
          assigned_at,
          notes,
          created_at,
          updated_at
        `)
        .eq('branch_id', branchId)
        .eq('status', 'active')
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('Error fetching branch suppliers:', error);
        setError('Failed to load branch suppliers');
        return;
      }

      // Fetch supplier and branch details separately for each connection
      const connectionsWithDetails = await Promise.all(
        (data || []).map(async (connection) => {
          // Fetch supplier details
          const { data: supplierData } = await supabase
            .from('suppliers')
            .select('company_name, contact_email, industry, phone, address')
            .eq('id', connection.supplier_id)
            .single();

          // Fetch branch details
          const { data: branchData } = await supabase
            .from('company_branches')
            .select('branch_name, location')
            .eq('id', connection.branch_id)
            .single();

          return {
            ...connection,
            supplier: supplierData,
            branch: branchData
          };
        })
      );

      setConnections(connectionsWithDetails);
    } catch (err) {
      console.error('Error in fetchBranchSuppliers:', err);
      setError('Failed to load branch suppliers');
    } finally {
      setLoading(false);
    }
  };

  const assignSupplierToBranch = async (supplierId: string, notes?: string) => {
    if (!branchId) return false;

    try {
      const { data, error } = await supabase.rpc('assign_supplier_to_branch', {
        p_branch_id: branchId,
        p_supplier_id: supplierId,
        p_notes: notes
      });

      if (error) {
        console.error('Error assigning supplier to branch:', error);
        toast.error('Failed to assign supplier to branch');
        return false;
      }

      const result = data as any;
      if (!result.success) {
        toast.error(result.error || 'Failed to assign supplier');
        return false;
      }

      toast.success('Supplier successfully assigned to branch');
      await fetchBranchSuppliers();
      return true;
    } catch (err) {
      console.error('Error in assignSupplierToBranch:', err);
      toast.error('Failed to assign supplier to branch');
      return false;
    }
  };

  const removeSupplierFromBranch = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('branch_supplier_connections')
        .update({ status: 'inactive' })
        .eq('id', connectionId);

      if (error) {
        console.error('Error removing supplier from branch:', error);
        toast.error('Failed to remove supplier from branch');
        return false;
      }

      toast.success('Supplier removed from branch');
      await fetchBranchSuppliers();
      return true;
    } catch (err) {
      console.error('Error in removeSupplierFromBranch:', err);
      toast.error('Failed to remove supplier from branch');
      return false;
    }
  };

  return {
    connections,
    loading,
    error,
    assignSupplierToBranch,
    removeSupplierFromBranch,
    refetch: fetchBranchSuppliers
  };
};
