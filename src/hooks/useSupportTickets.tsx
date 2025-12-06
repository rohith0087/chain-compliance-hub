import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface SupportTicket {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  company_id: string | null;
  company_name: string | null;
  user_type: string | null;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  source: 'buyer_portal' | 'supplier_portal' | 'login_page' | 'other';
  page_url: string | null;
  page_route: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UseSupportTicketsOptions {
  statusFilter?: string;
  priorityFilter?: string;
  sourceFilter?: string;
}

export const useSupportTickets = (options: UseSupportTicketsOptions = {}) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTicketCount, setNewTicketCount] = useState(0);

  const fetchTickets = useCallback(async () => {
    try {
      let query = supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.statusFilter && options.statusFilter !== 'all') {
        query = query.eq('status', options.statusFilter);
      }
      if (options.priorityFilter && options.priorityFilter !== 'all') {
        query = query.eq('priority', options.priorityFilter);
      }
      if (options.sourceFilter && options.sourceFilter !== 'all') {
        query = query.eq('source', options.sourceFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTickets(data as SupportTicket[] || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [options.statusFilter, options.priorityFilter, options.sourceFilter]);

  const updateTicketStatus = async (ticketId: string, status: SupportTicket['status'], resolutionNotes?: string) => {
    try {
      const updateData: any = { 
        status, 
        updated_at: new Date().toISOString() 
      };
      
      if (status === 'resolved' || status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
      }
      if (resolutionNotes) {
        updateData.resolution_notes = resolutionNotes;
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;

      // Find the ticket to get details for notification
      const ticket = tickets.find(t => t.id === ticketId);

      // Update local state
      setTickets(prev => prev.map(t => 
        t.id === ticketId ? { ...t, ...updateData } : t
      ));

      // Send resolution notification if ticket is resolved/closed
      if ((status === 'resolved' || status === 'closed') && ticket) {
        try {
          await supabase.functions.invoke('send-ticket-notification', {
            body: {
              action: 'ticket_resolved',
              ticketId,
              ticketSubject: ticket.subject,
              resolutionNotes,
              userEmail: ticket.user_email,
              userName: ticket.user_name,
              companyId: ticket.company_id,
              companyName: ticket.company_name,
              companyType: ticket.user_type === 'buyer' ? 'buyer' : ticket.user_type === 'supplier' ? 'supplier' : undefined,
            }
          });
          console.log('Resolution notification sent successfully');
        } catch (notifError) {
          console.error('Failed to send resolution notification:', notifError);
          // Don't fail the status update if notification fails
        }
      }

      toast({
        title: "Status Updated",
        description: `Ticket status changed to ${status.replace('_', ' ')}.`,
      });
    } catch (error: any) {
      console.error('Error updating ticket:', error);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const assignTicket = async (ticketId: string, assignedTo: string | null) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          assigned_to: assignedTo,
          status: assignedTo ? 'in_progress' : 'open',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;

      setTickets(prev => prev.map(t => 
        t.id === ticketId ? { 
          ...t, 
          assigned_to: assignedTo,
          status: assignedTo ? 'in_progress' : 'open'
        } : t
      ));

      toast({
        title: assignedTo ? "Ticket Assigned" : "Assignment Removed",
        description: assignedTo ? "Ticket has been assigned." : "Ticket assignment removed.",
      });
    } catch (error: any) {
      console.error('Error assigning ticket:', error);
      toast({
        title: "Assignment Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Setup realtime subscription
  useEffect(() => {
    fetchTickets();

    // Use unique channel name per hook instance to avoid duplicate subscription error
    const channelName = `support-tickets-${Date.now()}-${Math.random()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_tickets'
        },
        (payload) => {
          const newTicket = payload.new as SupportTicket;
          setTickets(prev => [newTicket, ...prev]);
          setNewTicketCount(prev => prev + 1);
          
          toast({
            title: "🎫 New Support Ticket",
            description: `${newTicket.subject} (${newTicket.priority})`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets'
        },
        (payload) => {
          const updatedTicket = payload.new as SupportTicket;
          setTickets(prev => prev.map(t => 
            t.id === updatedTicket.id ? updatedTicket : t
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTickets]);

  const clearNewTicketCount = () => setNewTicketCount(0);

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    urgent: tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed').length,
  };

  return {
    tickets,
    loading,
    newTicketCount,
    clearNewTicketCount,
    stats,
    refetch: fetchTickets,
    updateTicketStatus,
    assignTicket,
  };
};
