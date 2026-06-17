import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface ItemFacilityMapping {
  id: string;
  item_id: string;
  facility_id: string;
  is_primary_producer: boolean;
  production_capacity?: number;
  lead_time_days?: number;
  certifications?: any[];
  notes?: string;
  facility?: {
    id: string;
    branch_name: string;
    location: string;
    address: string;
  };
  item?: {
    id: string;
    item_name: string;
    category: string;
  };
}

export const useItemFacilityMappings = (supplierId?: string) => {
  const [mappings, setMappings] = useState<ItemFacilityMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadMappings = async () => {
    if (!supplierId) return;

    try {
      setLoading(true);
      // First get item IDs
      const { data: items } = await supabase
        .from('supplier_items')
        .select('id')
        .eq('supplier_id', supplierId);

      const itemIds = items?.map(item => item.id) || [];

      if (itemIds.length === 0) {
        setMappings([]);
        return;
      }

      const { data, error } = await supabase
        .from('item_facility_mappings')
        .select(`
          *,
          facility:company_branches(*),
          item:supplier_items(*)
        `)
        .in('item_id', itemIds);

      if (error) throw error;
      setMappings(data as any || []);
    } catch (error: any) {
      console.error('Error loading item-facility mappings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load item-facility mappings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createMapping = async (mapping: Partial<ItemFacilityMapping>) => {
    try {
      const { data, error } = await supabase
        .from('item_facility_mappings')
        .insert([mapping as any])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Item linked to facility successfully'
      });

      await loadMappings();
      return data;
    } catch (error: any) {
      console.error('Error creating mapping:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to link item to facility',
        variant: 'destructive'
      });
      return null;
    }
  };

  const updateMapping = async (id: string, updates: Partial<ItemFacilityMapping>) => {
    try {
      const { error } = await supabase
        .from('item_facility_mappings')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Mapping updated successfully'
      });

      await loadMappings();
    } catch (error: any) {
      console.error('Error updating mapping:', error);
      toast({
        title: 'Error',
        description: 'Failed to update mapping',
        variant: 'destructive'
      });
    }
  };

  const deleteMapping = async (id: string) => {
    try {
      const { error } = await supabase
        .from('item_facility_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Item unlinked from facility'
      });

      await loadMappings();
    } catch (error: any) {
      console.error('Error deleting mapping:', error);
      toast({
        title: 'Error',
        description: 'Failed to unlink item',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    loadMappings();
  }, [supplierId]);

  return {
    mappings,
    loading,
    createMapping,
    updateMapping,
    deleteMapping,
    refresh: loadMappings
  };
};
