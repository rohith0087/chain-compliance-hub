import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Send, Loader2, User, Headset } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTicketResponses, type TicketResponse } from '@/hooks/useTicketResponses';
import type { UserSupportTicket } from '@/hooks/useUserSupportTickets';

interface TicketConversationProps {
  ticket: UserSupportTicket;
}

export const TicketConversation = ({ ticket }: TicketConversationProps) => {
  const { responses, loading, createResponse } = useTicketResponses(ticket.id);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [responses]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    
    setSending(true);
    const success = await createResponse(newMessage.trim());
    if (success) {
      setNewMessage('');
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isTicketClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <div className="flex flex-col h-full">
      {/* Conversation thread */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="py-4 space-y-4">
          {/* Original ticket message */}
          <MessageBubble
            content={ticket.description}
            authorType="user"
            authorName="You"
            timestamp={ticket.created_at}
            isOriginal
          />

          {/* Responses */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            responses.map((response) => (
              <MessageBubble
                key={response.id}
                content={response.content}
                authorType={response.author_type}
                authorName={response.author_name || (response.author_type === 'support' ? 'Support Team' : 'You')}
                timestamp={response.created_at}
              />
            ))
          )}

          {/* Resolution note */}
          {ticket.resolution_notes && isTicketClosed && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-1">Resolution</p>
              <p className="text-sm">{ticket.resolution_notes}</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Reply input */}
      {!isTicketClosed ? (
        <div className="p-4 border-t bg-background/50">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your reply..."
              className="min-h-[80px] resize-none"
              disabled={sending}
            />
          </div>
          <div className="flex justify-end mt-2">
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              size="sm"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t bg-muted/30 text-center">
          <p className="text-sm text-muted-foreground">
            This ticket is closed. Create a new ticket for further assistance.
          </p>
        </div>
      )}
    </div>
  );
};

interface MessageBubbleProps {
  content: string;
  authorType: 'user' | 'support';
  authorName: string;
  timestamp: string;
  isOriginal?: boolean;
}

const MessageBubble = ({ content, authorType, authorName, timestamp, isOriginal }: MessageBubbleProps) => {
  const isSupport = authorType === 'support';
  
  return (
    <div className={cn(
      'flex gap-3',
      isSupport ? 'flex-row' : 'flex-row-reverse'
    )}>
      {/* Avatar */}
      <div className={cn(
        'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
        isSupport ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      )}>
        {isSupport ? <Headset className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      
      {/* Message */}
      <div className={cn(
        'max-w-[75%] rounded-lg px-4 py-2.5',
        isSupport 
          ? 'bg-primary/5 border border-primary/10' 
          : 'bg-muted border border-border'
      )}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium">{authorName}</span>
          {isOriginal && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted-foreground/10 text-muted-foreground">
              Original
            </span>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {format(new Date(timestamp), 'MMM d, yyyy · h:mm a')}
        </p>
      </div>
    </div>
  );
};
