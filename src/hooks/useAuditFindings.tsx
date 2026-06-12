import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type FindingSeverity = 'Minor' | 'Major' | 'Critical';
export type FindingStatus = 'Open' | 'In Progress' | 'Closed';

export interface AuditFinding {
  id: string;
  buyer_id: string;
  supplier_id: string;
  title: string;
  description: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  finding_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewAuditFinding {
  title: string;
  description?: string;
  severity: FindingSeverity;
  status?: FindingStatus;
  finding_date?: string;
}

async function resolveBuyerId(userId: string): Promise<string | null> {
  const { data: tm } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('profile_id', userId)
    .eq('company_type', 'buyer')
    .eq('status', 'active')
    .maybeSingle();
  if (tm?.company_id) return tm.company_id;
  const { data: owner } = await supabase
    .from('buyers')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle();
  return owner?.id ?? null;
}

export function useAuditFindings(supplierId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [buyerId, setBuyerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !supplierId) return;
    setLoading(true);
    try {
      const bId = await resolveBuyerId(user.id);
      setBuyerId(bId);
      if (!bId) {
        setFindings([]);
        return;
      }
      const { data, error } = await supabase
        .from('audit_findings')
        .select('*')
        .eq('buyer_id', bId)
        .eq('supplier_id', supplierId)
        .order('finding_date', { ascending: false });
      if (error) throw error;
      setFindings((data || []) as AuditFinding[]);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to load findings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, supplierId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: NewAuditFinding) => {
    if (!user || !supplierId || !buyerId) return;
    const { error } = await supabase.from('audit_findings').insert({
      buyer_id: buyerId,
      supplier_id: supplierId,
      title: input.title,
      description: input.description ?? null,
      severity: input.severity,
      status: input.status ?? 'Open',
      finding_date: input.finding_date ?? new Date().toISOString().slice(0, 10),
      created_by: user.id,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Finding added' });
    load();
  };

  const updateStatus = async (id: string, status: FindingStatus) => {
    const { error } = await supabase.from('audit_findings').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('audit_findings').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Finding removed' });
    load();
  };

  return { findings, loading, create, updateStatus, remove, refetch: load };
}
