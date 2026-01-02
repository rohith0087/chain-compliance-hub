import React, { useState, useEffect } from 'react';
import { useCommunicationThreads, CommunicationThread } from '@/hooks/useCommunicationThreads';
import { ThreadList } from './ThreadList';
import { ConversationPane } from './ConversationPane';
import { MessageSquare } from 'lucide-react';

interface CommunicationHubProps {
  companyId: string;
  companyType: 'buyer' | 'supplier';
  initialSupplierId?: string;
  initialBuyerId?: string;
}

export function CommunicationHub({ 
  companyId, 
  companyType,
  initialSupplierId,
  initialBuyerId
}: CommunicationHubProps) {
  const { threads, loading, totalUnread, getOrCreateThread, fetchThreads } = useCommunicationThreads(companyId, companyType);
  const [selectedThread, setSelectedThread] = useState<CommunicationThread | null>(null);
  const [mobileShowConversation, setMobileShowConversation] = useState(false);

  // Open or create a thread if initial supplier/buyer is provided
  useEffect(() => {
    const openInitialThread = async () => {
      if (companyType === 'buyer' && initialSupplierId && companyId) {
        const thread = await getOrCreateThread({
          buyerId: companyId,
          supplierId: initialSupplierId,
          participantType: 'buyer',
          companyId
        });
        if (thread) {
          setSelectedThread(thread);
          setMobileShowConversation(true);
        }
      } else if (companyType === 'supplier' && initialBuyerId && companyId) {
        const thread = await getOrCreateThread({
          buyerId: initialBuyerId,
          supplierId: companyId,
          participantType: 'supplier',
          companyId
        });
        if (thread) {
          setSelectedThread(thread);
          setMobileShowConversation(true);
        }
      }
    };

    if (initialSupplierId || initialBuyerId) {
      openInitialThread();
    }
  }, [initialSupplierId, initialBuyerId, companyId, companyType, getOrCreateThread]);

  const handleSelectThread = (thread: CommunicationThread) => {
    setSelectedThread(thread);
    setMobileShowConversation(true);
  };

  const handleBack = () => {
    setMobileShowConversation(false);
  };

  const handleStartConversation = async (targetCompanyId: string) => {
    const thread = await getOrCreateThread({
      buyerId: companyType === 'buyer' ? companyId : targetCompanyId,
      supplierId: companyType === 'supplier' ? companyId : targetCompanyId,
      participantType: companyType,
      companyId
    });
    if (thread) {
      setSelectedThread(thread);
      setMobileShowConversation(true);
    }
  };

  return (
    <div className="h-full flex bg-background overflow-hidden">
      {/* Thread List - Hidden on mobile when conversation is shown */}
      <div className={`
        w-full md:w-80 lg:w-96 border-r border-border flex-shrink-0 h-full overflow-hidden
        ${mobileShowConversation ? 'hidden md:flex' : 'flex'}
        flex-col
      `}>
        <ThreadList
          threads={threads}
          loading={loading}
          selectedThreadId={selectedThread?.id}
          onSelectThread={handleSelectThread}
          companyType={companyType}
          companyId={companyId}
          onStartConversation={handleStartConversation}
        />
      </div>

      {/* Conversation Pane */}
      <div className={`
        flex-1 flex flex-col h-full overflow-hidden
        ${!mobileShowConversation ? 'hidden md:flex' : 'flex'}
      `}>
        {selectedThread ? (
          <ConversationPane
            thread={selectedThread}
            companyId={companyId}
            companyType={companyType}
            onBack={handleBack}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a thread from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
