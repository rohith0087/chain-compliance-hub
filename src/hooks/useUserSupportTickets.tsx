import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserSupportTicket {
  id: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'awaiting_user' | 'resolved' | 'closed';
  source: string;
  has_unread_response: boolean;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

type StatusFilter = 'active' | 'closed' | 'all';

export const useUserSupportTickets = (statusFilter: StatusFilter = 'active') => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<UserSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchTickets = useCallback(async () => {
    if (!user?.id) {
      setTickets([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('support_tickets')
        .select('id, subject, description, priority, status, source, has_unread_response, resolution_notes, created_at, updated_at, resolved_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (statusFilter === 'active') {
        query = query.in('status', ['open', 'in_progress', 'awaiting_user']);
      } else if (statusFilter === 'closed') {
        query = query.in('status', ['resolved', 'closed']);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const ticketData = (data || []) as UserSupportTicket[];
      setTickets(ticketData);
      setUnreadCount(ticketData.filter(t => t.has_unread_response).length);
    } catch (error) {
      console.error('Error fetching user tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter]);

  const markTicketAsRead = async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ has_unread_response: false })
        .eq('id', ticketId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setTickets(prev => prev.map(t => 
        t.id === ticketId ? { ...t, has_unread_response: false } : t
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking ticket as read:', error);
    }
  };

  useEffect(() => {
    fetchTickets();

    if (!user?.id) return;

    // Realtime subscription for ticket updates
    const channelName = `user-tickets-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTicket = payload.new as UserSupportTicket;
            setTickets(prev => [newTicket, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedTicket = payload.new as UserSupportTicket;
            setTickets(prev => prev.map(t => 
              t.id === updatedTicket.id ? updatedTicket : t
            ));
            if (updatedTicket.has_unread_response) {
              setUnreadCount(prev => prev + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTickets, user?.id]);

  return {
    tickets,
    loading,
    unreadCount,
    refetch: fetchTickets,
    markTicketAsRead,
  };
};
