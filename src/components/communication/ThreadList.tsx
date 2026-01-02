import React, { useState } from 'react';
import { CommunicationThread } from '@/hooks/useCommunicationThreads';
import { ThreadListItem } from './ThreadListItem';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Search, MessageSquare, Loader2, Plus } from 'lucide-react';
import { NewConversationModal } from './NewConversationModal';

interface ThreadListProps {
  threads: CommunicationThread[];
  loading: boolean;
  selectedThreadId?: string;
  onSelectThread: (thread: CommunicationThread) => void;
  companyType: 'buyer' | 'supplier';
  companyId: string;
  onStartConversation: (targetCompanyId: string) => void;
}

export function ThreadList({
  threads,
  loading,
  selectedThreadId,
  onSelectThread,
  companyType,
  companyId,
  onStartConversation
}: ThreadListProps) {
  const [search, setSearch] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);

  const filteredThreads = threads.filter(thread => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const companyName = companyType === 'buyer' 
      ? thread.supplier?.company_name 
      : thread.buyer?.company_name;
    return companyName?.toLowerCase().includes(searchLower) ||
           thread.last_message_preview?.toLowerCase().includes(searchLower);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header - frozen */}
      <div className="p-4 border-b border-border flex-shrink-0 bg-background">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Messages</h2>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowNewConversation(true)}
            className="h-8 w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Thread List - scrollable */}
      <ScrollArea className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No conversations found' : 'No conversations yet'}
            </p>
            {!search && (
              <>
                <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
                  Start a conversation with a {companyType === 'buyer' ? 'supplier' : 'buyer'}
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowNewConversation(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Conversation
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredThreads.map(thread => (
              <ThreadListItem
                key={thread.id}
                thread={thread}
                isSelected={thread.id === selectedThreadId}
                onClick={() => onSelectThread(thread)}
                companyType={companyType}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <NewConversationModal
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        companyId={companyId}
        companyType={companyType}
        onSelectCompany={onStartConversation}
      />
    </div>
  );
}
