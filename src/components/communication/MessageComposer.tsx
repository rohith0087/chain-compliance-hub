import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDocumentTags } from '@/hooks/useDocumentTags';
import { useMentions } from '@/hooks/useMentions';
import { DocumentTag, Mention } from '@/hooks/useCommunicationMessages';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DocumentTagPicker } from './DocumentTagPicker';
import { MentionPicker } from './MentionPicker';
import { DocumentChip } from './DocumentChip';
import { MentionBadge } from './MentionBadge';
import { Send, Paperclip, X } from 'lucide-react';

interface MessageComposerProps {
  threadId: string;
  buyerId: string;
  supplierId: string;
  companyId: string;
  companyType: 'buyer' | 'supplier';
  onSend: (content: string, mentions: Mention[], documentTags: DocumentTag[], attachments: File[]) => Promise<void>;
  onTyping?: () => void;
}

export function MessageComposer({
  threadId,
  buyerId,
  supplierId,
  companyId,
  companyType,
  onSend,
  onTyping
}: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [documentTags, setDocumentTags] = useState<DocumentTag[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [documentSearch, setDocumentSearch] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { documents, searchDocuments } = useDocumentTags(buyerId, supplierId);
  const { users, searchUsers } = useMentions(threadId, companyId, companyType);

  // Handle input changes to detect / and @ triggers
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    setContent(value);
    onTyping?.();

    // Check for / trigger for documents
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const lastSpaceIndex = Math.max(textBeforeCursor.lastIndexOf(' '), textBeforeCursor.lastIndexOf('\n'));

    // Document picker: / at start of word
    if (lastSlashIndex > lastSpaceIndex && lastSlashIndex !== -1) {
      const searchTerm = textBeforeCursor.substring(lastSlashIndex + 1);
      setDocumentSearch(searchTerm);
      setShowDocumentPicker(true);
      setShowMentionPicker(false);
      searchDocuments(searchTerm);
    } 
    // Mention picker: @ at start of word
    else if (lastAtIndex > lastSpaceIndex && lastAtIndex !== -1) {
      const searchTerm = textBeforeCursor.substring(lastAtIndex + 1);
      setMentionSearch(searchTerm);
      setShowMentionPicker(true);
      setShowDocumentPicker(false);
      searchUsers(searchTerm);
    } 
    else {
      setShowDocumentPicker(false);
      setShowMentionPicker(false);
    }
  };

  // Select a document tag
  const handleSelectDocument = (doc: DocumentTag) => {
    // Add to tags if not already added
    if (!documentTags.find(d => d.id === doc.id)) {
      setDocumentTags(prev => [...prev, doc]);
    }

    // Remove the /search from content
    const cursorPosition = textareaRef.current?.selectionStart || content.length;
    const textBeforeCursor = content.substring(0, cursorPosition);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    const newContent = content.substring(0, lastSlashIndex) + content.substring(cursorPosition);
    setContent(newContent);

    setShowDocumentPicker(false);
    textareaRef.current?.focus();
  };

  // Select a mention
  const handleSelectMention = (user: { profileId: string; name: string }) => {
    const mention: Mention = { profile_id: user.profileId, name: user.name };
    
    // Add to mentions if not already added
    if (!mentions.find(m => m.profile_id === user.profileId)) {
      setMentions(prev => [...prev, mention]);
    }

    // Replace @search with @Name in content
    const cursorPosition = textareaRef.current?.selectionStart || content.length;
    const textBeforeCursor = content.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const newContent = content.substring(0, lastAtIndex) + `@${user.name} ` + content.substring(cursorPosition);
    setContent(newContent);

    setShowMentionPicker(false);
    textareaRef.current?.focus();
  };

  // Remove a document tag
  const handleRemoveDocument = (docId: string) => {
    setDocumentTags(prev => prev.filter(d => d.id !== docId));
  };

  // Remove a mention
  const handleRemoveMention = (profileId: string) => {
    setMentions(prev => prev.filter(m => m.profile_id !== profileId));
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
    e.target.value = '';
  };

  // Remove attachment
  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Send message
  const handleSend = async () => {
    if (!content.trim() && documentTags.length === 0 && attachments.length === 0) return;

    setSending(true);
    try {
      await onSend(content.trim(), mentions, documentTags, attachments);
      setContent('');
      setMentions([]);
      setDocumentTags([]);
      setAttachments([]);
    } finally {
      setSending(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setShowDocumentPicker(false);
      setShowMentionPicker(false);
    }
  };

  return (
    <div className="border-t border-border bg-card p-4">
      {/* Selected items preview */}
      {(documentTags.length > 0 || mentions.length > 0 || attachments.length > 0) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {documentTags.map(doc => (
            <div key={doc.id} className="flex items-center gap-1">
              <DocumentChip 
                document={doc} 
                buyerId={buyerId}
                supplierId={supplierId}
                compact 
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => handleRemoveDocument(doc.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {mentions.map(mention => (
            <div key={mention.profile_id} className="flex items-center gap-1">
              <MentionBadge mention={mention} />
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => handleRemoveMention(mention.profile_id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {attachments.map((file, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm">
              <span className="truncate max-w-[150px]">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => handleRemoveAttachment(idx)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Pickers */}
      <div className="relative">
        {showDocumentPicker && (
          <DocumentTagPicker
            documents={documents}
            search={documentSearch}
            onSelect={handleSelectDocument}
            onClose={() => setShowDocumentPicker(false)}
          />
        )}
        {showMentionPicker && (
          <MentionPicker
            users={users}
            search={mentionSearch}
            onSelect={handleSelectMention}
            onClose={() => setShowMentionPicker(false)}
          />
        )}
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.csv"
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0"
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... Use / to tag documents, @ to mention people"
            className="min-h-[44px] max-h-[200px] resize-none pr-12"
            rows={1}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={sending || (!content.trim() && documentTags.length === 0 && attachments.length === 0)}
          size="icon"
          className="flex-shrink-0"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to send, 
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] ml-1">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
