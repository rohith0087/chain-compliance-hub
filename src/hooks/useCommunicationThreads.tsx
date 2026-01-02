import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ThreadParticipant {
  id: string;
  profile_id: string;
  participant_type: 'buyer' | 'supplier';
  unread_count: number;
  last_read_at: string | null;
  profile: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  };
}

export interface CommunicationThread {
  id: string;
  buyer_id: string;
  supplier_id: string;
  buyer_branch_id: string | null;
  supplier_branch_id: string | null;
  thread_context: 'general' | 'compliance' | 'onboarding' | 'renewals';
  thread_title: string | null;
  status: 'active' | 'archived';
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  buyer: {
    id: string;
    company_name: string;
    company_logo_url: string | null;
  };
  supplier: {
    id: string;
    company_name: string;
    company_logo_url: string | null;
  };
  participants: ThreadParticipant[];
}

interface UseCommunicationThreadsResult {
  threads: CommunicationThread[];
  loading: boolean;
  error: string | null;
  totalUnread: number;
  fetchThreads: () => Promise<void>;
  getOrCreateThread: (params: {
    buyerId: string;
    supplierId: string;
    buyerBranchId?: string;
    supplierBranchId?: string;
    threadContext?: string;
    participantType: 'buyer' | 'supplier';
    companyId: string;
  }) => Promise<CommunicationThread | null>;
}

export function useCommunicationThreads(
  companyId?: string,
  companyType?: 'buyer' | 'supplier'
): UseCommunicationThreadsResult {
  const { user } = useAuth();
  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);

  const fetchThreads = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.functions.invoke('communication-hub', {
        body: {
          action: 'get_threads',
          companyId,
          companyType
        }
      });

      if (fetchError) throw fetchError;
      if (data.error) throw new Error(data.error);

      setThreads(data.threads || []);
      
      // Calculate total unread
      const unread = (data.threads || []).reduce((sum: number, thread: CommunicationThread) => {
        const myParticipant = thread.participants?.find(p => p.profile_id === user.id);
        return sum + (myParticipant?.unread_count || 0);
      }, 0);
      setTotalUnread(unread);

    } catch (err: any) {
      console.error('Error fetching threads:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, companyId, companyType]);

  const getOrCreateThread = useCallback(async (params: {
    buyerId: string;
    supplierId: string;
    buyerBranchId?: string;
    supplierBranchId?: string;
    threadContext?: string;
    participantType: 'buyer' | 'supplier';
    companyId: string;
  }): Promise<CommunicationThread | null> => {
    if (!user) return null;

    try {
      const { data, error: fetchError } = await supabase.functions.invoke('communication-hub', {
        body: {
          action: 'get_or_create_thread',
          ...params
        }
      });

      if (fetchError) throw fetchError;
      if (data.error) throw new Error(data.error);

      // Refresh threads list
      await fetchThreads();

      return data.thread;
    } catch (err: any) {
      console.error('Error creating thread:', err);
      setError(err.message);
      return null;
    }
  }, [user, fetchThreads]);

  // Initial fetch
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('communication-threads-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'thread_participants',
          filter: `profile_id=eq.${user.id}`
        },
        () => {
          fetchThreads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchThreads]);

  return {
    threads,
    loading,
    error,
    totalUnread,
    fetchThreads,
    getOrCreateThread
  };
}
