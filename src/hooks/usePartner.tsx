import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PartnerInfo { partner_id: string; partner_name: string; role: string; }
export interface PartnerCustomer {
  company_id: string; company_type: string; company_name: string; industry: string | null; user_count: number;
}
export interface PartnerCompanyUser {
  company_user_id: string; profile_id: string; email: string; full_name: string;
  role: string; status: string; account_disabled: boolean; last_login_at: string | null;
}
export interface PartnerMember {
  member_id: string; profile_id: string; email: string; full_name: string; role: string; status: string;
}
export interface PartnerActivity {
  id: string; actor_name: string | null; company_name: string; target_name: string | null;
  action: string; detail: Record<string, unknown>; created_at: string;
}

// Reseller/partner portal data + actions. Mirrors usePlatformAdmin. All calls go
// through partner-scoped SECURITY DEFINER RPCs (authorization enforced server-side).
export function usePartner() {
  const { user } = useAuth();
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) { setPartner(null); setLoading(false); return; }
      const { data } = await client.from('partner_members')
        .select('partner_id, role, status, partners(id, name, status)')
        .eq('profile_id', user.id).eq('status', 'active');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = (data ?? []).find((r: any) => r.partners?.status === 'active');
      if (!active) return;
      setPartner(row ? { partner_id: row.partner_id, partner_name: row.partners.name, role: row.role } : null);
      setLoading(false);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const listCustomers = useCallback(async (): Promise<PartnerCustomer[]> =>
    (await client.rpc('partner_list_customers')).data ?? [], [client]);

  const listCompanyUsers = useCallback(async (companyId: string, companyType: string): Promise<PartnerCompanyUser[]> =>
    (await client.rpc('partner_list_company_users', { p_company_id: companyId, p_company_type: companyType })).data ?? [], [client]);

  const setUserRole = useCallback((companyUserId: string, newRole: string) =>
    client.rpc('partner_set_company_user_role', { p_company_user_id: companyUserId, p_new_role: newRole }), [client]);

  const removeUser = useCallback((companyUserId: string) =>
    client.rpc('partner_remove_company_user', { p_company_user_id: companyUserId }), [client]);

  const setUserStatus = useCallback((userId: string, disabled: boolean) =>
    client.functions.invoke('admin-set-user-status', { body: { user_id: userId, disabled } }), [client]);

  const listMembers = useCallback(async (): Promise<PartnerMember[]> =>
    (await client.rpc('partner_list_members')).data ?? [], [client]);

  const listActivity = useCallback(async (): Promise<PartnerActivity[]> =>
    (await client.rpc('partner_list_activity', { p_limit: 100 })).data ?? [], [client]);

  // Invite-by-email (create-user edge function). kind: 'company_user' | 'partner_member'.
  const invite = useCallback((body: Record<string, unknown>) =>
    client.functions.invoke('create-user', { body }), [client]);

  return {
    partner, isPartner: !!partner, loading,
    listCustomers, listCompanyUsers, setUserRole, removeUser, setUserStatus, listMembers, listActivity, invite,
  };
}
