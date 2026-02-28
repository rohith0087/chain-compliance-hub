import React, { useState } from 'react';
import { CommunicationMessage, DocumentTag } from '@/hooks/useCommunicationMessages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DocumentChip } from './DocumentChip';
import { MentionBadge } from './MentionBadge';
import { MoreHorizontal, Pencil, Trash2, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { resolveStoragePath } from '@/utils/storagePath';
import { toast } from '@/hooks/use-toast';

interface MessageBubbleProps {
  message: CommunicationMessage;
  isOwnMessage: boolean;
  isConsecutive: boolean;
  onEdit: (messageId: string, content: string) => Promise<boolean>;
  onDelete: (messageId: string) => Promise<boolean>;
  buyerId: string;
  supplierId: string;
}

export function MessageBubble({
  message,
  isOwnMessage,
  isConsecutive,
  onEdit,
  onDelete,
  buyerId,
  supplierId
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSaveEdit = async () => {
    if (editContent.trim() && editContent !== message.content) {
      const success = await onEdit(message.id, editContent);
      if (success) {
        setIsEditing(false);
      }
    } else {
      setIsEditing(false);
      setEditContent(message.content);
    }
  };

  const handleDelete = async () => {
    await onDelete(message.id);
  };

  const handleDocumentClick = async (doc: DocumentTag) => {
    // If it's a request (not an upload), show informative toast
    if (doc.type === 'request') {
      toast({
        title: 'Document Request',
        description: 'This is a document request, not an uploaded file.',
      });
      return;
    }

    // For uploads, open the document using signed URL
    if (!doc.filePath) {
      toast({
        title: 'Cannot open document',
        description: 'No file available for this document.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const pathInfo = resolveStoragePath(doc.filePath);
      if (!pathInfo) throw new Error('Invalid file path');

      const { data, error } = await supabase.storage
        .from(pathInfo.bucket)
        .createSignedUrl(pathInfo.key, 300); // 5 min expiry

      if (error || !data?.signedUrl) throw error || new Error('Could not generate URL');

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Error opening document:', err);
      toast({
        title: 'Error opening document',
        description: 'Could not open the document. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Parse content for mentions and document tags to render inline
  const renderContent = () => {
    let content = message.content;

    // For now, render the content directly
    // In a full implementation, we'd parse @mentions and /documents
    return <p className="whitespace-pre-wrap break-words">{content}</p>;
  };

  return (
    <div className={`flex gap-3 group ${isOwnMessage ? 'flex-row-reverse' : ''} ${isConsecutive ? 'mt-1' : 'mt-4'}`}>
      {/* Avatar */}
      {!isConsecutive ? (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={message.sender?.avatar_url || undefined} />
          <AvatarFallback className={`text-xs ${isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            {getInitials(message.sender?.name || 'U')}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}

      {/* Message Content */}
      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%]`}>
        {/* Sender name & time */}
        {!isConsecutive && (
          <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-medium">{message.sender?.name || 'Unknown'}</span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(message.created_at), 'h:mm a')}
            </span>
            {message.is_edited && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div className={`
          relative rounded-2xl px-4 py-2 
          ${isOwnMessage 
            ? 'bg-primary text-primary-foreground rounded-tr-md' 
            : 'bg-muted rounded-tl-md'
          }
        `}>
          {isEditing ? (
            <div className="min-w-[200px]">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] bg-background/50 border-0 resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  <Check className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              {renderContent()}

              {/* Document Tags */}
              {message.document_tags && message.document_tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                {message.document_tags.map((doc, idx) => (
                    <DocumentChip
                      key={idx}
                      document={doc}
                      buyerId={buyerId}
                      supplierId={supplierId}
                      onClick={() => handleDocumentClick(doc)}
                      isOwnMessage={isOwnMessage}
                    />
                  ))}
                </div>
              )}

              {/* Mentions */}
              {message.mentions && message.mentions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {message.mentions.map((mention, idx) => (
                    <MentionBadge key={idx} mention={mention} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Actions dropdown - only for own messages */}
          {isOwnMessage && !isEditing && (
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Message status + time for consecutive messages */}
        <div className={`flex items-center gap-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
          {/* Consecutive message time on hover */}
          {isConsecutive && (
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
              {format(new Date(message.created_at), 'h:mm a')}
            </span>
          )}
          
          {/* Read receipt indicator for own messages */}
          {isOwnMessage && (
            <div className="flex items-center mt-0.5">
              {message.is_read_by_recipient ? (
                <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
              ) : (
                <Check className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
