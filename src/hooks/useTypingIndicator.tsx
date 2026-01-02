import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface TypingUser {
  id: string;
  name: string;
}

interface UseTypingIndicatorResult {
  typingUsers: TypingUser[];
  startTyping: () => void;
  stopTyping: () => void;
}

export function useTypingIndicator(
  threadId: string | null,
  userName: string
): UseTypingIndicatorResult {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!threadId || !user) return;

    const channel = supabase.channel(`typing-${threadId}`, {
      config: {
        presence: { key: user.id }
      }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: TypingUser[] = [];
        
        Object.entries(state).forEach(([userId, presences]: [string, any]) => {
          if (userId !== user.id && presences.length > 0 && presences[0].typing) {
            users.push({ id: userId, name: presences[0].name || 'Someone' });
          }
        });
        
        setTypingUsers(users);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [threadId, user]);

  const startTyping = useCallback(() => {
    if (!channelRef.current || !user) return;

    channelRef.current.track({ typing: true, name: userName });

    // Auto-stop typing after 3 seconds
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [user, userName]);

  const stopTyping = useCallback(() => {
    if (!channelRef.current || !user) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    channelRef.current.track({ typing: false, name: userName });
  }, [user, userName]);

  return {
    typingUsers,
    startTyping,
    stopTyping
  };
}
