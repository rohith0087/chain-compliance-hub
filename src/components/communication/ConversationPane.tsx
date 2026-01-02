import React, { useRef, useEffect } from 'react';
import { CommunicationThread } from '@/hooks/useCommunicationThreads';
import { useCommunicationMessages } from '@/hooks/useCommunicationMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useAuth } from '@/hooks/useAuth';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Loader2, Users } from 'lucide-react';

interface ConversationPaneProps {
  thread: CommunicationThread;
  companyId: string;
  companyType: 'buyer' | 'supplier';
  onBack?: () => void;
}

export function ConversationPane({
  thread,
  companyId,
  companyType,
  onBack
}: ConversationPaneProps) {
  const { user, profile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { 
    messages, 
    loading, 
    sendMessage, 
    editMessage, 
    deleteMessage,
    loadMore,
    hasMore
  } = useCommunicationMessages(thread.id, companyType, companyId);

  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(
    thread.id,
    profile?.name || 'Unknown'
  );

  const otherParty = companyType === 'buyer' ? thread.supplier : thread.buyer;

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSendMessage = async (
    content: string,
    mentions: any[],
    documentTags: any[],
    attachments: File[]
  ) => {
    stopTyping();
    await sendMessage(content, mentions, documentTags);
    // TODO: Handle file attachments
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        <Avatar className="h-10 w-10">
          <AvatarImage src={otherParty?.company_logo_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(otherParty?.company_name || 'Unknown')}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{otherParty?.company_name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{thread.participants?.length || 0} participants</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {hasMore && (
          <div className="flex justify-center mb-4">
            <Button variant="ghost" size="sm" onClick={loadMore} disabled={loading}>
              Load earlier messages
            </Button>
          </div>
        )}

        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              const prevMessage = messages[index - 1];
              const showDate = !prevMessage || 
                new Date(message.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString();
              const isConsecutive = prevMessage && 
                prevMessage.sender_id === message.sender_id &&
                !showDate;

              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="flex items-center justify-center my-4">
                      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {new Date(message.created_at).toLocaleDateString(undefined, {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    isOwnMessage={message.sender_id === user?.id}
                    isConsecutive={isConsecutive}
                    onEdit={editMessage}
                    onDelete={deleteMessage}
                    buyerId={thread.buyer_id}
                    supplierId={thread.supplier_id}
                  />
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
            <div className="flex space-x-1">
              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>
              {typingUsers.map(u => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}
      </ScrollArea>

      {/* Composer */}
      <MessageComposer
        threadId={thread.id}
        buyerId={thread.buyer_id}
        supplierId={thread.supplier_id}
        companyId={companyId}
        companyType={companyType}
        onSend={handleSendMessage}
        onTyping={startTyping}
      />
    </div>
  );
}
