import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { useNotificationSound } from './useNotificationSound';

export interface TicketResponse {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_type: 'user' | 'support';
  author_name: string | null;
  content: string;
  is_internal: boolean;
  attachments: any[];
  created_at: string;
}

export const useTicketResponses = (ticketId: string | null) => {
  const { user } = useAuth();
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const { playNotificationSound } = useNotificationSound();
  const initialLoadComplete = useRef(false);

  const fetchResponses = useCallback(async () => {
    if (!ticketId) {
      setResponses([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('ticket_responses')
        .select('*')
        .eq('ticket_id', ticketId)
        .eq('is_internal', false) // Users don't see internal notes
        .order('created_at', { ascending: true });

      if (error) throw error;
      setResponses((data || []) as TicketResponse[]);
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setLoading(false);
      initialLoadComplete.current = true;
    }
  }, [ticketId]);

  const createResponse = async (content: string) => {
    if (!ticketId || !user?.id) return false;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { error } = await supabase
        .from('ticket_responses')
        .insert({
          ticket_id: ticketId,
          author_id: user.id,
          author_type: 'user',
          author_name: profile?.full_name || user.email || 'User',
          content,
          is_internal: false,
        });

      if (error) throw error;

      toast({
        title: "Response sent",
        description: "Your message has been sent to support.",
      });

      return true;
    } catch (error: any) {
      console.error('Error creating response:', error);
      toast({
        title: "Failed to send",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchResponses();

    if (!ticketId) return;

    // Realtime subscription for new responses
    const channelName = `ticket-responses-${ticketId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_responses',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          const newResponse = payload.new as TicketResponse;
          // Only show non-internal responses
          if (!newResponse.is_internal) {
            setResponses(prev => [...prev, newResponse]);
            
            // Play sound for support responses (not user's own responses)
            if (initialLoadComplete.current && newResponse.author_type === 'support') {
              playNotificationSound('ticket_response');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchResponses, ticketId]);

  return {
    responses,
    loading,
    refetch: fetchResponses,
    createResponse,
  };
};
