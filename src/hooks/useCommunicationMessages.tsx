import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MessageAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  download_count: number;
}

export interface DocumentTag {
  id: string;
  type: 'upload' | 'request';
  name: string;
  status: string;
  expirationDate?: string;
  dueDate?: string;
  category?: string;
  documentType?: string;
}

export interface Mention {
  profile_id: string;
  name: string;
}

export interface CommunicationMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_type: 'buyer' | 'supplier';
  sender_company_id: string;
  content: string;
  mentions: Mention[];
  document_tags: DocumentTag[];
  is_edited: boolean;
  edited_at: string | null;
  is_system_message: boolean;
  created_at: string;
  sender: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  };
  attachments: MessageAttachment[];
}

interface UseCommunicationMessagesResult {
  messages: CommunicationMessage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  sendMessage: (content: string, mentions?: Mention[], documentTags?: DocumentTag[]) => Promise<CommunicationMessage | null>;
  editMessage: (messageId: string, content: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  loadMore: () => Promise<void>;
  markAsRead: () => Promise<void>;
}

export function useCommunicationMessages(
  threadId: string | null,
  senderType: 'buyer' | 'supplier',
  senderCompanyId: string
): UseCommunicationMessagesResult {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loadedRef = useRef(false);

  const fetchMessages = useCallback(async (before?: string) => {
    if (!user || !threadId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.functions.invoke('communication-hub', {
        body: {
          action: 'get_messages',
          threadId,
          limit: 50,
          before
        }
      });

      if (fetchError) throw fetchError;
      if (data.error) throw new Error(data.error);

      const newMessages = data.messages || [];
      
      if (before) {
        setMessages(prev => [...newMessages, ...prev]);
      } else {
        setMessages(newMessages);
      }
      
      setHasMore(newMessages.length === 50);

    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, threadId]);

  const sendMessage = useCallback(async (
    content: string,
    mentions: Mention[] = [],
    documentTags: DocumentTag[] = []
  ): Promise<CommunicationMessage | null> => {
    if (!user || !threadId) return null;

    try {
      const { data, error: sendError } = await supabase.functions.invoke('communication-hub', {
        body: {
          action: 'send_message',
          threadId,
          content,
          mentions,
          documentTags,
          senderType,
          senderCompanyId
        }
      });

      if (sendError) throw sendError;
      if (data.error) throw new Error(data.error);

      // Message will be added via realtime subscription
      return data.message;
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message);
      return null;
    }
  }, [user, threadId, senderType, senderCompanyId]);

  const editMessage = useCallback(async (messageId: string, content: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error: editError } = await supabase.functions.invoke('communication-hub', {
        body: {
          action: 'edit_message',
          messageId,
          content
        }
      });

      if (editError) throw editError;
      if (data.error) throw new Error(data.error);

      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content, is_edited: true, edited_at: new Date().toISOString() }
          : msg
      ));

      return true;
    } catch (err: any) {
      console.error('Error editing message:', err);
      setError(err.message);
      return false;
    }
  }, [user]);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error: deleteError } = await supabase.functions.invoke('communication-hub', {
        body: {
          action: 'delete_message',
          messageId
        }
      });

      if (deleteError) throw deleteError;
      if (data.error) throw new Error(data.error);

      // Remove from local state
      setMessages(prev => prev.filter(msg => msg.id !== messageId));

      return true;
    } catch (err: any) {
      console.error('Error deleting message:', err);
      setError(err.message);
      return false;
    }
  }, [user]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || messages.length === 0) return;
    const oldestMessage = messages[0];
    await fetchMessages(oldestMessage.created_at);
  }, [hasMore, loading, messages, fetchMessages]);

  const markAsRead = useCallback(async () => {
    if (!user || !threadId) return;

    try {
      await supabase.functions.invoke('communication-hub', {
        body: {
          action: 'mark_read',
          threadId
        }
      });
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [user, threadId]);

  // Initial fetch when thread changes
  useEffect(() => {
    if (threadId) {
      loadedRef.current = false;
      setMessages([]);
      fetchMessages();
    }
  }, [threadId, fetchMessages]);

  // Mark as read when viewing thread
  useEffect(() => {
    if (threadId && messages.length > 0 && !loadedRef.current) {
      loadedRef.current = true;
      markAsRead();
    }
  }, [threadId, messages.length, markAsRead]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`messages-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communication_messages',
          filter: `thread_id=eq.${threadId}`
        },
        async (payload) => {
          // Fetch the full message with sender info
          const newMsg = payload.new as any;
          
          // Get sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .eq('id', newMsg.sender_id)
            .single();

          const fullMessage: CommunicationMessage = {
            ...newMsg,
            sender: sender || { id: newMsg.sender_id, name: 'Unknown', avatar_url: null },
            attachments: [],
            mentions: newMsg.mentions || [],
            document_tags: newMsg.document_tags || []
          };

          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === fullMessage.id)) return prev;
            return [...prev, fullMessage];
          });

          // Mark as read if we're viewing this thread
          if (user && newMsg.sender_id !== user.id) {
            markAsRead();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'communication_messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          const updated = payload.new as any;
          setMessages(prev => prev.map(msg => 
            msg.id === updated.id 
              ? { ...msg, ...updated }
              : msg
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, user, markAsRead]);

  return {
    messages,
    loading,
    error,
    hasMore,
    sendMessage,
    editMessage,
    deleteMessage,
    loadMore,
    markAsRead
  };
}
