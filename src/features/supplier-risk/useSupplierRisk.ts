import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  fetchLatestRiskScore,
  fetchRiskEvents,
  recomputeRiskScore,
  type RiskEvent,
  type RiskScore,
} from './scoreApi';

// Loads the latest external-risk snapshot + events for a buyer x supplier, and
// exposes an on-demand recompute (calls the deterministic engine RPC).
export function useSupplierRisk(buyerId: string | null, supplierId: string | null) {
  const { toast } = useToast();
  const [score, setScore] = useState<RiskScore | null>(null);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const load = useCallback(async () => {
    if (!buyerId || !supplierId) {
      setScore(null);
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      const [sc, ev] = await Promise.all([
        fetchLatestRiskScore(buyerId, supplierId),
        fetchRiskEvents(supplierId),
      ]);
      setScore(sc);
      setEvents(ev);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load risk',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [buyerId, supplierId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const recompute = useCallback(async () => {
    if (!buyerId || !supplierId) return;
    setRecomputing(true);
    try {
      const sc = await recomputeRiskScore(buyerId, supplierId);
      setScore(sc);
      toast({ title: 'Recomputed', description: `External risk score: ${sc.overall_score}` });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Recompute failed',
        variant: 'destructive',
      });
    } finally {
      setRecomputing(false);
    }
  }, [buyerId, supplierId, toast]);

  return { score, events, loading, recomputing, recompute, reload: load };
}
