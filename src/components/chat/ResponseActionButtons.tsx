import React from 'react';
import { Button } from "@/components/ui/button";
import { Copy, RotateCw, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at: string;
}

interface ResponseActionButtonsProps {
  message: Message;
  messages: Message[];
  onRegenerate: (question: string) => void;
  onShare: (message: Message) => void;
}

const ResponseActionButtons: React.FC<ResponseActionButtonsProps> = ({
  message,
  messages,
  onRegenerate,
  onShare,
}) => {
  const { toast } = useToast();

  const extractPlainText = (msg: Message): string => {
    // Extract readable text from structured responses
    const structured = msg.metadata?.structured_response;
    
    if (!structured) {
      return typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    }

    let text = '';
    
    // Add main content
    if (structured.content) text += structured.content + '\n\n';
    if (structured.response) text += structured.response + '\n\n';
    if (structured.explanation) text += structured.explanation + '\n\n';
    
    // Add sections
    if (structured.sections) {
      structured.sections.forEach((section: any) => {
        text += `${section.title}\n${section.content}\n\n`;
      });
    }
    
    // Add document summaries (not full list)
    if (structured.documents?.length) {
      text += `Documents referenced: ${structured.documents.length} items\n`;
    }
    
    return text.trim() || typeof msg.content === 'string' ? msg.content : 'AI Response';
  };

  const handleCopy = async () => {
    // Copy the on-screen rendered node so tables/bold/lists survive a paste into
    // email or docs (rich text/html), with a clean plain-text fallback.
    const rendered = document.querySelector(`[data-copy-id="${message.id}"]`) as HTMLElement | null;
    const html = rendered?.innerHTML?.trim();
    const plain = (rendered?.innerText?.trim()) || extractPlainText(message);
    try {
      if (html && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      toast({ title: "Copied to clipboard", description: "Formatting preserved" });
    } catch (error) {
      try {
        await navigator.clipboard.writeText(plain);
        toast({ title: "Copied to clipboard", description: "Response copied" });
      } catch {
        toast({ title: "Failed to copy", description: "Could not copy response to clipboard", variant: "destructive" });
      }
    }
  };

  const findPreviousUserMessage = (): string | null => {
    // Find the index of current assistant message
    const currentIndex = messages.findIndex(m => m.id === message.id);
    
    // Look backwards for the most recent user message
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i].content;
      }
    }
    
    return null;
  };

  const handleRegenerate = () => {
    const previousQuestion = findPreviousUserMessage();
    
    if (previousQuestion) {
      toast({
        title: "Regenerating response...",
        description: "Getting a fresh answer",
      });
      onRegenerate(previousQuestion);
    } else {
      toast({
        title: "Cannot regenerate",
        description: "No previous question found",
        variant: "destructive",
      });
    }
  };

  const handleShare = () => {
    onShare(message);
  };

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-8 px-2 text-muted-foreground hover:text-foreground"
      >
        <Copy className="h-3.5 w-3.5 mr-1.5" />
        Copy
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRegenerate}
        className="h-8 px-2 text-muted-foreground hover:text-foreground"
      >
        <RotateCw className="h-3.5 w-3.5 mr-1.5" />
        Regenerate
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleShare}
        className="h-8 px-2 text-muted-foreground hover:text-foreground"
      >
        <Share2 className="h-3.5 w-3.5 mr-1.5" />
        Share
      </Button>
    </div>
  );
};

export default ResponseActionButtons;
