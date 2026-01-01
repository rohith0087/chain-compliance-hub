import { useState, useRef, useEffect } from 'react';
import { useAdminTicketResponses, AdminTicketResponse } from '@/hooks/useAdminTicketResponses';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Lock, User, Headphones, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Neon color palette for cyber theme
const NEON_COLORS = {
  cyan: '#22d3ee',
  purple: '#a855f7',
  green: '#4ade80',
  amber: '#fbbf24',
};

interface AdminTicketConversationProps {
  ticketId: string;
  ticketDescription: string;
  ticketCreatedAt: string;
  userName: string;
  isClosed?: boolean;
}

export const AdminTicketConversation = ({
  ticketId,
  ticketDescription,
  ticketCreatedAt,
  userName,
  isClosed = false,
}: AdminTicketConversationProps) => {
  const { responses, loading, createResponse } = useAdminTicketResponses(ticketId);
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [responses]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const success = await createResponse(newMessage.trim(), isInternal);
    if (success) {
      setNewMessage('');
      setIsInternal(false);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2 md:mb-3">
        <span className="text-xs md:text-sm font-medium" style={{ color: NEON_COLORS.cyan }}>
          Conversation
        </span>
        <Badge 
          variant="outline" 
          className="text-[10px] md:text-xs"
          style={{ borderColor: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text-muted))' }}
        >
          {responses.length + 1} messages
        </Badge>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 pr-2 md:pr-4" ref={scrollRef}>
        <div className="space-y-3 md:space-y-4 pb-4">
          {/* Original ticket message */}
          <MessageBubble
            content={ticketDescription}
            authorType="user"
            authorName={userName}
            timestamp={ticketCreatedAt}
            isOriginal
          />

          {/* Responses */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: NEON_COLORS.cyan }} />
            </div>
          ) : (
            responses.map((response) => (
              <MessageBubble
                key={response.id}
                content={response.content}
                authorType={response.author_type}
                authorName={response.author_name || (response.author_type === 'support' ? 'Support Team' : 'User')}
                timestamp={response.created_at}
                isInternal={response.is_internal}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Reply Input - Stacked on mobile */}
      {!isClosed ? (
        <div className="mt-3 md:mt-4 pt-3 md:pt-4 space-y-2 md:space-y-3" style={{ borderTop: '1px solid hsl(var(--admin-border))' }}>
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your reply..."
            rows={2}
            disabled={sending}
            className="text-sm"
            style={{ 
              backgroundColor: 'hsl(var(--admin-bg))', 
              borderColor: 'hsl(var(--admin-border))', 
              color: 'hsl(var(--admin-text))' 
            }}
          />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="internal"
                checked={isInternal}
                onCheckedChange={(checked) => setIsInternal(checked as boolean)}
                disabled={sending}
              />
              <Label 
                htmlFor="internal" 
                className="text-xs md:text-sm cursor-pointer flex items-center gap-1"
                style={{ color: isInternal ? NEON_COLORS.amber : 'hsl(var(--admin-text-muted))' }}
              >
                <Lock className="w-3 h-3" />
                Internal note only
              </Label>
            </div>
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              size="sm"
              className="w-full md:w-auto"
              style={{ backgroundColor: NEON_COLORS.cyan, color: '#000' }}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isInternal ? 'Add Note' : 'Send Reply'}
            </Button>
          </div>
        </div>
      ) : (
        <div 
          className="mt-3 md:mt-4 pt-3 md:pt-4 text-center text-xs md:text-sm"
          style={{ borderTop: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text-muted))' }}
        >
          This ticket is closed. Reopen it to continue the conversation.
        </div>
      )}
    </div>
  );
};

// Message Bubble Component
interface MessageBubbleProps {
  content: string;
  authorType: 'user' | 'support';
  authorName: string;
  timestamp: string;
  isOriginal?: boolean;
  isInternal?: boolean;
}

const MessageBubble = ({
  content,
  authorType,
  authorName,
  timestamp,
  isOriginal = false,
  isInternal = false,
}: MessageBubbleProps) => {
  const isSupport = authorType === 'support';

  return (
    <div className={`flex gap-2 md:gap-3 ${isSupport ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: isSupport 
            ? `${NEON_COLORS.cyan}20` 
            : `${NEON_COLORS.purple}20`,
        }}
      >
        {isSupport ? (
          <Headphones className="w-3.5 h-3.5 md:w-4 md:h-4" style={{ color: NEON_COLORS.cyan }} />
        ) : (
          <User className="w-3.5 h-3.5 md:w-4 md:h-4" style={{ color: NEON_COLORS.purple }} />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[90%] md:max-w-[85%] ${isSupport ? 'text-right' : ''}`}>
        <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1" style={{ justifyContent: isSupport ? 'flex-end' : 'flex-start' }}>
          <span className="text-[10px] md:text-xs font-medium" style={{ color: isSupport ? NEON_COLORS.cyan : NEON_COLORS.purple }}>
            {authorName}
          </span>
          {isOriginal && (
            <Badge 
              variant="outline" 
              className="text-[8px] md:text-[10px] px-1 py-0"
              style={{ borderColor: NEON_COLORS.purple, color: NEON_COLORS.purple }}
            >
              Original
            </Badge>
          )}
          {isInternal && (
            <Badge 
              variant="outline" 
              className="text-[8px] md:text-[10px] px-1 py-0 flex items-center gap-0.5"
              style={{ borderColor: NEON_COLORS.amber, color: NEON_COLORS.amber }}
            >
              <Lock className="w-2 h-2 md:w-2.5 md:h-2.5" />
              Internal
            </Badge>
          )}
          <span className="text-[8px] md:text-[10px]" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </span>
        </div>
        <div
          className="p-2 md:p-3 rounded-lg text-xs md:text-sm whitespace-pre-wrap"
          style={{
            backgroundColor: isInternal 
              ? `${NEON_COLORS.amber}10`
              : isSupport 
                ? `${NEON_COLORS.cyan}10` 
                : 'hsl(var(--admin-bg))',
            border: `1px solid ${isInternal 
              ? `${NEON_COLORS.amber}30`
              : isSupport 
                ? `${NEON_COLORS.cyan}30` 
                : 'hsl(var(--admin-border))'}`,
            color: 'hsl(var(--admin-text))',
            textAlign: 'left',
          }}
        >
          {content}
        </div>
      </div>
    </div>
  );
};
