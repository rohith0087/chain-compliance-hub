import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SupplierItem {
  id: string;
  supplier_id: string;
  item_name: string;
  item_category: string;
  branch_id?: string;
  description?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export const ITEM_CATEGORIES = [
  { value: 'seafood', label: 'Seafood', icon: '🐟' },
  { value: 'dairy', label: 'Dairy', icon: '🥛' },
  { value: 'meat', label: 'Meat', icon: '🥩' },
  { value: 'produce', label: 'Produce', icon: '🥬' },
  { value: 'beverages', label: 'Beverages', icon: '🥤' },
  { value: 'packaged_goods', label: 'Packaged Goods', icon: '📦' },
  { value: 'other', label: 'Other', icon: '📋' },
];

export const useSupplierItems = (supplierId?: string) => {
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (supplierId) {
      fetchItems();
    }
  }, [supplierId]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('supplier_items')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('item_category', { ascending: true })
        .order('item_name', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      console.error('Error fetching items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load items',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createItem = async (itemData: Omit<SupplierItem, 'id' | 'supplier_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('supplier_items')
        .insert([{ 
          item_name: itemData.item_name,
          item_category: itemData.item_category,
          branch_id: itemData.branch_id,
          description: itemData.description,
          metadata: itemData.metadata,
          supplier_id: supplierId!
        }])
        .select()
        .single();

      if (error) throw error;

      setItems([...items, data]);
      toast({
        title: 'Success',
        description: 'Item created successfully',
      });
      return data;
    } catch (error: any) {
      console.error('Error creating item:', error);
      toast({
        title: 'Error',
        description: 'Failed to create item',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateItem = async (itemId: string, itemData: Partial<SupplierItem>) => {
    try {
      const { data, error } = await supabase
        .from('supplier_items')
        .update(itemData)
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;

      setItems(items.map(item => item.id === itemId ? data : item));
      toast({
        title: 'Success',
        description: 'Item updated successfully',
      });
      return data;
    } catch (error: any) {
      console.error('Error updating item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('supplier_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setItems(items.filter(item => item.id !== itemId));
      toast({
        title: 'Success',
        description: 'Item deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const filterByCategory = (category: string) => {
    return items.filter(item => item.item_category === category);
  };

  const getItemsByCategory = () => {
    const grouped: { [key: string]: SupplierItem[] } = {};
    items.forEach(item => {
      if (!grouped[item.item_category]) {
        grouped[item.item_category] = [];
      }
      grouped[item.item_category].push(item);
    });
    return grouped;
  };

  return {
    items,
    loading,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    filterByCategory,
    getItemsByCategory,
  };
};
