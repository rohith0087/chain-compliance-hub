import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface DocumentLibrary {
  id: string;
  company_id: string;
  company_type: 'buyer' | 'supplier';
  branch_id?: string;
  library_name: string;
  description?: string;
  library_type: string;
  is_default: boolean;
  access_level: 'branch' | 'company' | 'restricted';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SharedDocument {
  id: string;
  document_id: string;
  document_type: 'upload' | 'request';
  shared_from_branch_id: string;
  shared_to_branch_id: string;
  shared_by: string;
  permission_level: 'read' | 'write' | 'admin';
  expires_at?: string;
  notes?: string;
  status: 'active' | 'revoked' | 'expired';
  created_at: string;
  updated_at: string;
}

export const useBranchDocumentLibraries = (companyId?: string, companyType?: 'buyer' | 'supplier', branchId?: string) => {
  const [libraries, setLibraries] = useState<DocumentLibrary[]>([]);
  const [sharedDocuments, setSharedDocuments] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchLibraries = async () => {
    if (!companyId || !companyType) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: librariesData, error: librariesError } = await supabase
        .from('document_libraries')
        .select('*')
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .order('library_name', { ascending: true });

      if (librariesError) {
        console.error('Error fetching libraries:', librariesError);
        setError('Failed to load document libraries');
        return;
      }

      setLibraries(librariesData as DocumentLibrary[] || []);

    } catch (err) {
      console.error('Error in fetchLibraries:', err);
      setError('Failed to load document libraries');
    } finally {
      setLoading(false);
    }
  };

  const fetchSharedDocuments = async () => {
    if (!branchId) return;

    try {
      const { data: sharedData, error: sharedError } = await supabase
        .from('shared_documents')
        .select('*')
        .or(`shared_from_branch_id.eq.${branchId},shared_to_branch_id.eq.${branchId}`)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (sharedError) {
        console.error('Error fetching shared documents:', sharedError);
        return;
      }

      setSharedDocuments(sharedData as SharedDocument[] || []);
    } catch (err) {
      console.error('Error in fetchSharedDocuments:', err);
    }
  };

  const createLibrary = async (libraryData: Omit<DocumentLibrary, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) {
      toast.error('You must be logged in to create libraries');
      return { error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('document_libraries')
        .insert([libraryData])
        .select()
        .single();

      if (error) {
        console.error('Error creating library:', error);
        toast.error('Failed to create library');
        return { error };
      }

      setLibraries(prev => [...prev, data as DocumentLibrary]);
      toast.success('Library created successfully');
      return { data, error: null };
    } catch (err) {
      console.error('Error in createLibrary:', err);
      toast.error('Failed to create library');
      return { error: err };
    }
  };

  const shareDocument = async (shareData: Omit<SharedDocument, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) {
      toast.error('You must be logged in to share documents');
      return { error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('shared_documents')
        .insert([shareData])
        .select()
        .single();

      if (error) {
        console.error('Error sharing document:', error);
        toast.error('Failed to share document');
        return { error };
      }

      setSharedDocuments(prev => [...prev, data as SharedDocument]);
      toast.success('Document shared successfully');
      return { data, error: null };
    } catch (err) {
      console.error('Error in shareDocument:', err);
      toast.error('Failed to share document');
      return { error: err };
    }
  };

  const revokeDocumentShare = async (shareId: string) => {
    if (!user) {
      toast.error('You must be logged in to revoke shares');
      return { error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('shared_documents')
        .update({ status: 'revoked' })
        .eq('id', shareId)
        .select()
        .single();

      if (error) {
        console.error('Error revoking share:', error);
        toast.error('Failed to revoke document share');
        return { error };
      }

      setSharedDocuments(prev => prev.map(doc => 
        doc.id === shareId ? { ...doc, status: 'revoked' } : doc
      ));
      toast.success('Document share revoked');
      return { data, error: null };
    } catch (err) {
      console.error('Error in revokeDocumentShare:', err);
      toast.error('Failed to revoke document share');
      return { error: err };
    }
  };

  useEffect(() => {
    fetchLibraries();
    fetchSharedDocuments();
  }, [companyId, companyType, branchId]);

  return {
    libraries,
    sharedDocuments,
    loading,
    error,
    createLibrary,
    shareDocument,
    revokeDocumentShare,
    refetch: () => {
      fetchLibraries();
      fetchSharedDocuments();
    }
  };
};