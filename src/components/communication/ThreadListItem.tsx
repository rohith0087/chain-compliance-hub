import React from 'react';
import { CommunicationThread } from '@/hooks/useCommunicationThreads';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface ThreadListItemProps {
  thread: CommunicationThread;
  isSelected: boolean;
  onClick: () => void;
  companyType: 'buyer' | 'supplier';
}

export function ThreadListItem({
  thread,
  isSelected,
  onClick,
  companyType
}: ThreadListItemProps) {
  const { user } = useAuth();
  
  // Show the other party's info
  const otherParty = companyType === 'buyer' ? thread.supplier : thread.buyer;
  const myParticipant = thread.participants?.find(p => p.profile_id === user?.id);
  const unreadCount = myParticipant?.unread_count || 0;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getContextBadge = () => {
    if (thread.thread_context === 'general') return null;
    return (
      <Badge variant="secondary" className="text-xs capitalize">
        {thread.thread_context}
      </Badge>
    );
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-full p-4 text-left transition-colors hover:bg-muted/50
        ${isSelected ? 'bg-muted' : ''}
        ${unreadCount > 0 ? 'bg-primary/5' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={otherParty?.company_logo_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {getInitials(otherParty?.company_name || 'Unknown')}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`font-medium truncate ${unreadCount > 0 ? 'text-foreground' : 'text-foreground/80'}`}>
              {otherParty?.company_name || 'Unknown Company'}
            </span>
            {thread.last_message_at && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: false })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {getContextBadge()}
          </div>

          {thread.last_message_preview && (
            <p className={`text-sm mt-1 truncate ${unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {thread.last_message_preview}
            </p>
          )}
        </div>

        {unreadCount > 0 && (
          <Badge className="bg-primary text-primary-foreground text-xs min-w-[20px] h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </div>
    </button>
  );
}
