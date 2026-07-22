import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type BuyerDashboardView = 'overview' | 'detailed' | 'focus' | 'pulse';

const STORAGE_KEY = 'buyerDashboard_view';
const CHANGE_EVENT = 'buyer-dashboard-view-changed';
const DEFAULT_VIEW: BuyerDashboardView = 'overview';
const KNOWN_VIEWS: BuyerDashboardView[] = ['overview', 'detailed', 'focus', 'pulse'];

const normalize = (value: string | null | undefined): BuyerDashboardView =>
  value && (KNOWN_VIEWS as string[]).includes(value) ? (value as BuyerDashboardView) : DEFAULT_VIEW;

const readCache = (): BuyerDashboardView => {
  if (typeof window === 'undefined') return DEFAULT_VIEW;
  return normalize(localStorage.getItem(STORAGE_KEY));
};

/**
 * Buyer dashboard layout preference, persisted per-user in `user_preferences`.
 *
 * localStorage is kept purely as an instant-paint cache so the dashboard does
 * not flash the default view on load; the database row is the source of truth
 * and survives across devices/sessions. Choosing a view stores it until the
 * user picks another; absent/unknown values fall back to 'overview'.
 *
 * All mounted instances stay in sync via a window event, so the settings
 * toggle and the live dashboard update together without a reload.
 */
export function useBuyerDashboardView() {
  const { user } = useAuth();
  const [view, setViewState] = useState<BuyerDashboardView>(readCache);
  const [loading, setLoading] = useState<boolean>(Boolean(user));

  // Load the persisted preference once the user is known.
  useEffect(() => {
    let active = true;
    if (!user) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from('user_preferences')
        .select('buyer_dashboard_view')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!active) return;
      if (!error && data?.buyer_dashboard_view) {
        const next = normalize(data.buyer_dashboard_view);
        setViewState(next);
        localStorage.setItem(STORAGE_KEY, next);
        window.dispatchEvent(new Event(CHANGE_EVENT));
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  // Keep every instance in sync when any of them changes the view.
  useEffect(() => {
    const handler = () => setViewState(readCache());
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  const setView = useCallback(
    async (next: BuyerDashboardView) => {
      // Optimistic: update the UI and cache immediately, then persist.
      setViewState(next);
      localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));

      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      await client
        .from('user_preferences')
        .upsert({ user_id: user.id, buyer_dashboard_view: next }, { onConflict: 'user_id' });
    },
    [user?.id],
  );

  return { view, setView, loading };
}
