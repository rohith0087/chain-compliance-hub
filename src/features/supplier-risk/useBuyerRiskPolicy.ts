import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  fetchBuyerRiskPolicy,
  resolveBuyerId,
  saveBuyerRiskPolicy,
  type BuyerRiskPolicy,
  type RiskPolicyDraft,
} from './api';

export function useBuyerRiskPolicy() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<BuyerRiskPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const bId = await resolveBuyerId(user.id);
      setBuyerId(bId);
      setPolicy(bId ? await fetchBuyerRiskPolicy(bId) : null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load risk policy';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (draft: RiskPolicyDraft) => {
      if (!buyerId) {
        toast({ title: 'No buyer', description: 'No buyer account found for this user.', variant: 'destructive' });
        return;
      }
      setSaving(true);
      try {
        const saved = await saveBuyerRiskPolicy(buyerId, draft, policy);
        setPolicy(saved);
        toast({ title: 'Saved', description: `Risk policy saved (v${saved.version}).` });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to save risk policy';
        toast({ title: 'Error', description: message, variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    },
    [buyerId, policy, toast],
  );

  return { buyerId, policy, loading, saving, save };
}
