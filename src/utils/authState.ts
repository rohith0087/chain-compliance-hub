import type { AuthChangeEvent } from '@supabase/supabase-js';

const PASSIVE_SESSION_EVENTS = new Set<AuthChangeEvent>([
  'INITIAL_SESSION',
  'SIGNED_IN',
  'TOKEN_REFRESHED',
]);

interface PreserveWorkspaceStateInput {
  event: AuthChangeEvent;
  initialized: boolean;
  currentUserId: string | null;
  nextUserId: string | null;
}

/**
 * Supabase may emit SIGNED_IN again when a browser tab regains focus.
 * Rebuilding user identity for those same-user events causes every hook that
 * depends on `user` to reload and unmounts in-progress dashboard work.
 */
export function shouldPreserveWorkspaceState({
  event,
  initialized,
  currentUserId,
  nextUserId,
}: PreserveWorkspaceStateInput): boolean {
  return initialized
    && PASSIVE_SESSION_EVENTS.has(event)
    && currentUserId !== null
    && currentUserId === nextUserId;
}
