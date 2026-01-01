import { format } from 'date-fns';
import { X, Calendar, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TicketStatusBadge } from './TicketStatusBadge';
import { TicketPriorityBadge } from './TicketPriorityBadge';
import { TicketConversation } from './TicketConversation';
import type { UserSupportTicket } from '@/hooks/useUserSupportTickets';

interface TicketDetailPanelProps {
  ticket: UserSupportTicket;
  onClose: () => void;
}

export const TicketDetailPanel = ({ ticket, onClose }: TicketDetailPanelProps) => {
  return (
    <div className="flex flex-col h-full bg-background border-l">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base line-clamp-2 leading-tight">
            {ticket.subject}
          </h3>
          
          {/* Status and priority */}
          <div className="flex items-center gap-2 mt-2">
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} showLabel />
          </div>
          
          {/* Metadata */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(ticket.created_at), 'MMM d, yyyy')}
            </span>
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {ticket.source.replace('_', ' ')}
            </span>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Conversation */}
      <div className="flex-1 overflow-hidden">
        <TicketConversation ticket={ticket} />
      </div>
    </div>
  );
};
