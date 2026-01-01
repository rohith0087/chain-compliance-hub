import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './use-toast';

export interface AdminTicketResponse {
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

export const useAdminTicketResponses = (ticketId: string | null) => {
  const [responses, setResponses] = useState<AdminTicketResponse[]>([]);
  const [loading, setLoading] = useState(true);

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
        .order('created_at', { ascending: true });

      if (error) throw error;
      setResponses((data || []) as AdminTicketResponse[]);
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const createResponse = async (content: string, isInternal: boolean = false) => {
    if (!ticketId) return false;

    try {
      // Insert the response
      const { error: responseError } = await supabase
        .from('ticket_responses')
        .insert({
          ticket_id: ticketId,
          author_id: null, // Admin responses don't need author_id
          author_type: 'support',
          author_name: 'Support Team',
          content,
          is_internal: isInternal,
        });

      if (responseError) throw responseError;

      // If public response, mark ticket as having unread response for user
      if (!isInternal) {
        await supabase
          .from('support_tickets')
          .update({ has_unread_response: true })
          .eq('id', ticketId);
      }

      toast({
        title: isInternal ? "Internal note added" : "Response sent",
        description: isInternal 
          ? "Your internal note has been saved." 
          : "Your response has been sent to the user.",
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
    const channelName = `admin-ticket-responses-${ticketId}-${Date.now()}`;
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
          const newResponse = payload.new as AdminTicketResponse;
          setResponses(prev => {
            // Avoid duplicates
            if (prev.some(r => r.id === newResponse.id)) return prev;
            return [...prev, newResponse];
          });
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
