import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Copy, Edit2, Send, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailDraftCardProps {
  subject: string;
  body: string;
}

export const EmailDraftCard: React.FC<EmailDraftCardProps> = ({ subject, body }) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    toast({
      title: 'Copied to clipboard',
      description: 'Email draft copied successfully',
    });
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Clean up HTML entities and formatting in the body
  const cleanBody = body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  
  return (
    <Card className="p-4 border-l-4 border-l-blue-500 bg-card">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg text-foreground">Follow-Up Email Draft</h3>
        <Badge variant="outline" className="ml-auto bg-primary/15 text-primary">
          Draft
        </Badge>
      </div>
      
      <div className="space-y-4">
        {/* Subject line */}
        <div className="p-3 rounded-lg bg-muted/50">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Subject
          </span>
          <p className="font-medium text-foreground mt-1">{subject}</p>
        </div>
        
        {/* Email body */}
        <div className="p-3 rounded-lg bg-muted/50">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Message
          </span>
          <div className="mt-2 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {cleanBody}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCopy}
            className="flex-1"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="default" size="sm" className="flex-1">
            <Send className="w-4 h-4 mr-2" />
            Send
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default EmailDraftCard;
