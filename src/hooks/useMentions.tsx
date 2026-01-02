import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MentionableUser {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  email: string | null;
  role: string;
}

interface UseMentionsResult {
  users: MentionableUser[];
  loading: boolean;
  error: string | null;
  searchUsers: (search: string) => Promise<void>;
}

export function useMentions(
  threadId?: string,
  companyId?: string,
  companyType?: 'buyer' | 'supplier'
): UseMentionsResult {
  const [users, setUsers] = useState<MentionableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchUsers = useCallback(async (search: string) => {
    if (!threadId || !companyId || !companyType) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.functions.invoke('communication-hub', {
        body: {
          action: 'get_mentionable_users',
          threadId,
          companyId,
          companyType,
          search
        }
      });

      if (fetchError) throw fetchError;
      if (data.error) throw new Error(data.error);

      setUsers(data.users || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [threadId, companyId, companyType]);

  return {
    users,
    loading,
    error,
    searchUsers
  };
}
