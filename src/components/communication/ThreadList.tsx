import React, { useState } from 'react';
import { CommunicationThread } from '@/hooks/useCommunicationThreads';
import { ThreadListItem } from './ThreadListItem';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MessageSquare, Loader2 } from 'lucide-react';

interface ThreadListProps {
  threads: CommunicationThread[];
  loading: boolean;
  selectedThreadId?: string;
  onSelectThread: (thread: CommunicationThread) => void;
  companyType: 'buyer' | 'supplier';
}

export function ThreadList({
  threads,
  loading,
  selectedThreadId,
  onSelectThread,
  companyType
}: ThreadListProps) {
  const [search, setSearch] = useState('');

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold mb-3">Messages</h2>
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

      {/* Thread List */}
      <ScrollArea className="flex-1">
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
              <p className="text-xs text-muted-foreground/70 mt-1">
                Start a conversation with a {companyType === 'buyer' ? 'supplier' : 'buyer'}
              </p>
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
    </div>
  );
}
