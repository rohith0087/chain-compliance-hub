import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DocumentSet {
  id: string;
  buyer_id: string;
  set_name: string;
  description?: string;
  document_ids: string[];
  is_default: boolean;
  usage_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

interface CreateDocumentSetInput {
  buyer_id: string;
  set_name: string;
  description?: string;
  document_ids: string[];
  is_default?: boolean;
}

interface UpdateDocumentSetInput {
  set_name?: string;
  description?: string;
  document_ids?: string[];
  is_default?: boolean;
}

export function useDocumentSets(buyerId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all document sets for a buyer
  const { data: documentSets = [], isLoading, error } = useQuery({
    queryKey: ['document-sets', buyerId],
    queryFn: async () => {
      if (!buyerId) return [];
      
      const { data, error } = await supabase
        .from('document_sets')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as DocumentSet[];
    },
    enabled: !!buyerId,
  });

  // Get default document set
  const defaultSet = documentSets.find(set => set.is_default);

  // Create new document set
  const createSet = useMutation({
    mutationFn: async (input: CreateDocumentSetInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('document_sets')
        .insert({
          ...input,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-sets'] });
      toast({
        title: 'Success',
        description: 'Document set created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update document set
  const updateSet = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateDocumentSetInput }) => {
      const { data, error } = await supabase
        .from('document_sets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-sets'] });
      toast({
        title: 'Success',
        description: 'Document set updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete document set
  const deleteSet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('document_sets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-sets'] });
      toast({
        title: 'Success',
        description: 'Document set deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Increment usage count and update last_used_at
  const incrementUsage = useMutation({
    mutationFn: async (id: string) => {
      const set = documentSets.find(s => s.id === id);
      if (!set) throw new Error('Set not found');
      
      const { error } = await supabase
        .from('document_sets')
        .update({ 
          usage_count: set.usage_count + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-sets'] });
    },
  });

  // Duplicate document set
  const duplicateSet = useMutation({
    mutationFn: async (id: string) => {
      const original = documentSets.find(s => s.id === id);
      if (!original) throw new Error('Document set not found');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('document_sets')
        .insert({
          buyer_id: original.buyer_id,
          set_name: `${original.set_name} (Copy)`,
          description: original.description,
          document_ids: original.document_ids,
          is_default: false,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-sets'] });
      toast({
        title: 'Success',
        description: 'Document set duplicated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    documentSets,
    defaultSet,
    isLoading,
    error,
    createSet: createSet.mutate,
    updateSet: updateSet.mutate,
    deleteSet: deleteSet.mutate,
    incrementUsage: incrementUsage.mutate,
    duplicateSet: duplicateSet.mutate,
    isCreating: createSet.isPending,
    isUpdating: updateSet.isPending,
    isDeleting: deleteSet.isPending,
  };
}
