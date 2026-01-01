import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { TicketStatusBadge } from './TicketStatusBadge';
import { TicketPriorityBadge } from './TicketPriorityBadge';
import type { UserSupportTicket } from '@/hooks/useUserSupportTickets';

interface TicketCardProps {
  ticket: UserSupportTicket;
  isSelected?: boolean;
  onClick?: () => void;
}

export const TicketCard = ({ ticket, isSelected, onClick }: TicketCardProps) => {
  const hasUnread = ticket.has_unread_response;
  
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative p-4 rounded-lg border cursor-pointer transition-all duration-200',
        'hover:border-primary/30 hover:bg-accent/30',
        isSelected && 'border-primary bg-accent/50 shadow-sm',
        hasUnread && 'border-l-4 border-l-primary',
        !isSelected && !hasUnread && 'border-border bg-card'
      )}
    >
      {/* Unread indicator dot */}
      {hasUnread && (
        <span className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
      )}
      
      <div className="flex items-start justify-between gap-3 pr-4">
        <div className="flex-1 min-w-0">
          {/* Subject */}
          <h4 className={cn(
            'text-sm font-medium truncate',
            hasUnread && 'font-semibold'
          )}>
            {ticket.subject}
          </h4>
          
          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5">
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
          </div>
        </div>
      </div>
      
      {/* Footer: timestamp */}
      <p className="text-xs text-muted-foreground mt-2.5">
        Updated {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
      </p>
    </div>
  );
};
