import { describe, expect, it } from 'vitest';
import { shouldPreserveWorkspaceState } from '../../src/utils/authState';

describe('shouldPreserveWorkspaceState', () => {
  const sameUser = {
    initialized: true,
    currentUserId: 'user-1',
    nextUserId: 'user-1',
  };

  it.each(['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION'] as const)(
    'preserves mounted workspace state for a repeated same-user %s event',
    (event) => {
      expect(shouldPreserveWorkspaceState({ event, ...sameUser })).toBe(true);
    },
  );

  it('does not preserve state before the initial session is established', () => {
    expect(shouldPreserveWorkspaceState({
      event: 'INITIAL_SESSION',
      ...sameUser,
      initialized: false,
    })).toBe(false);
  });

  it('does not preserve state when a different user signs in', () => {
    expect(shouldPreserveWorkspaceState({
      event: 'SIGNED_IN',
      ...sameUser,
      nextUserId: 'user-2',
    })).toBe(false);
  });

  it('does not preserve state for sign-out or user-update events', () => {
    expect(shouldPreserveWorkspaceState({ event: 'SIGNED_OUT', ...sameUser, nextUserId: null })).toBe(false);
    expect(shouldPreserveWorkspaceState({ event: 'USER_UPDATED', ...sameUser })).toBe(false);
  });
});
