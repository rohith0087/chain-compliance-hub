import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at: string;
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: Message;
}

const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  onOpenChange,
  message,
}) => {
  const { toast } = useToast();

  const extractDisplayText = (msg: Message): string => {
    const structured = msg.metadata?.structured_response;
    
    if (!structured) {
      return typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    }

    let text = '';
    
    if (structured.content) text += structured.content + '\n\n';
    if (structured.response) text += structured.response + '\n\n';
    if (structured.explanation) text += structured.explanation + '\n\n';
    
    if (structured.sections) {
      structured.sections.forEach((section: any) => {
        text += `${section.title}\n${section.content}\n\n`;
      });
    }
    
    if (structured.documents?.length) {
      text += `\nDocuments referenced: ${structured.documents.length} items`;
    }
    
    return text.trim() || typeof msg.content === 'string' ? msg.content : 'AI Response';
  };

  const handleCopyText = async () => {
    try {
      const text = extractDisplayText(message);
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Response text copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy text to clipboard",
        variant: "destructive",
      });
    }
  };

  const responseText = extractDisplayText(message);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Share from Compliance Copilot
          </DialogTitle>
          <DialogDescription>
            Share this AI-generated compliance insight
          </DialogDescription>
        </DialogHeader>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="mb-4 flex items-center gap-2 pb-3 border-b">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Compliance Copilot</span>
            </div>
            
            <div className="prose prose-sm max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {responseText}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
              Generated on {new Date(message.created_at).toLocaleDateString()} at{' '}
              {new Date(message.created_at).toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleCopyText}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy text
          </Button>
          
          <Button
            variant="default"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
