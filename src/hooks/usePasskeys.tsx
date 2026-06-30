import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Passkey {
  id: string;
  credential_id: string;
  nickname: string;
  device_type: string | null;
  backed_up: boolean;
  last_used_at: string | null;
  created_at: string;
}

export const usePasskeys = () => {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPasskeys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_passkeys')
      .select('id, credential_id, nickname, device_type, backed_up, last_used_at, created_at')
      .order('created_at', { ascending: false });
    if (!error && data) setPasskeys(data as Passkey[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPasskeys(); }, [fetchPasskeys]);

  const rename = async (id: string, nickname: string) => {
    const { error } = await supabase
      .from('user_passkeys')
      .update({ nickname: nickname.trim().slice(0, 60) || 'Passkey' })
      .eq('id', id);
    if (!error) await fetchPasskeys();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('user_passkeys').delete().eq('id', id);
    if (!error) await fetchPasskeys();
    return { error };
  };

  return { passkeys, loading, fetchPasskeys, rename, remove };
};
