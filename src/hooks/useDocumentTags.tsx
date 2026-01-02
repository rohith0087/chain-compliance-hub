import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DocumentTag } from './useCommunicationMessages';

interface UseDocumentTagsResult {
  documents: DocumentTag[];
  loading: boolean;
  error: string | null;
  searchDocuments: (search: string) => Promise<void>;
}

export function useDocumentTags(
  buyerId?: string,
  supplierId?: string
): UseDocumentTagsResult {
  const [documents, setDocuments] = useState<DocumentTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchDocuments = useCallback(async (search: string) => {
    if (!buyerId || !supplierId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.functions.invoke('communication-hub', {
        body: {
          action: 'get_taggable_documents',
          buyerId,
          supplierId,
          search
        }
      });

      if (fetchError) throw fetchError;
      if (data.error) throw new Error(data.error);

      setDocuments(data.documents || []);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buyerId, supplierId]);

  return {
    documents,
    loading,
    error,
    searchDocuments
  };
}
