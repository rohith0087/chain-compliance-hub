import React from 'react';
import { Mention } from '@/hooks/useCommunicationMessages';
import { Badge } from '@/components/ui/badge';
import { AtSign } from 'lucide-react';

interface MentionBadgeProps {
  mention: Mention;
}

export function MentionBadge({ mention }: MentionBadgeProps) {
  return (
    <Badge 
      variant="secondary" 
      className="flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20"
    >
      <AtSign className="h-3 w-3" />
      <span>{mention.name}</span>
    </Badge>
  );
}
