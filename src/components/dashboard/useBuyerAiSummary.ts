import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Reads the buyer's current AI briefing, written by the buyer-ai-summary edge
 * function on a 2-hourly cron. `refresh()` asks that function to regenerate now.
 *
 * The card falls back to locally-derived bullets when `bullets` is empty (no run
 * yet, or the job errored), so it is never blank.
 */

export interface AiBullet {
  text: string;
  tone: 'neutral' | 'warn' | 'danger';
}

export interface AiFollowUp {
  label: string;
  prompt: string;
}

export interface BuyerAiSummary {
  bullets: AiBullet[];
  followUps: AiFollowUp[];
  generatedAt: string | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

const EMPTY: BuyerAiSummary = {
  bullets: [],
  followUps: [],
  generatedAt: null,
  loading: true,
  refreshing: false,
  error: null,
};

export function useBuyerAiSummary(buyerId: string | null | undefined) {
  const [state, setState] = useState<BuyerAiSummary>(EMPTY);

  const load = useCallback(async () => {
    if (!buyerId) {
      setState({ ...EMPTY, loading: false });
      return;
    }
    try {
      // Table isn't in generated types yet -- same convention as scoreApi.ts.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from('buyer_ai_summaries')
        .select('bullets, follow_ups, generated_at, error')
        .eq('buyer_id', buyerId)
        .maybeSingle();
      if (error) throw error;

      setState({
        bullets: Array.isArray(data?.bullets) ? data.bullets : [],
        followUps: Array.isArray(data?.follow_ups) ? data.follow_ups : [],
        generatedAt: data?.generated_at ?? null,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (e) {
      // A missing summary is not a page error -- the card falls back.
      setState({
        ...EMPTY,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load summary',
      });
    }
  }, [buyerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    if (!buyerId) return;
    setState((s) => ({ ...s, refreshing: true }));
    try {
      const { error } = await supabase.functions.invoke('buyer-ai-summary', {
        body: { buyerId, force: true },
      });
      if (error) throw error;
      await load();
    } catch (e) {
      setState((s) => ({
        ...s,
        refreshing: false,
        error: e instanceof Error ? e.message : 'Refresh failed',
      }));
    }
  }, [buyerId, load]);

  return { ...state, refresh };
}
