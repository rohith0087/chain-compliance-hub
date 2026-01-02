import React from 'react';
import { DocumentTag } from '@/hooks/useCommunicationMessages';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, CheckCircle, XCircle, AlertTriangle, HourglassIcon } from 'lucide-react';
import { format } from 'date-fns';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

interface DocumentChipProps {
  document: DocumentTag;
  buyerId: string;
  supplierId: string;
  compact?: boolean;
  onClick?: () => void;
}

export function DocumentChip({
  document,
  buyerId,
  supplierId,
  compact = false,
  onClick
}: DocumentChipProps) {
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'pending':
      case 'pending_review':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'rejected':
      case 'declined':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'expired':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'submitted':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <CheckCircle className="h-3 w-3" />;
      case 'pending':
      case 'pending_review':
        return <HourglassIcon className="h-3 w-3" />;
      case 'rejected':
      case 'declined':
        return <XCircle className="h-3 w-3" />;
      case 'expired':
        return <AlertTriangle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const formatStatus = (status: string) => {
    return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  if (compact) {
    return (
      <Badge 
        variant="outline" 
        className={`flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 ${getStatusColor(document.status)}`}
        onClick={onClick}
      >
        <FileText className="h-3 w-3" />
        <span className="truncate max-w-[120px]">{document.name}</span>
      </Badge>
    );
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Badge 
          variant="outline" 
          className={`flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 transition-colors ${getStatusColor(document.status)}`}
          onClick={onClick}
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="truncate max-w-[150px]">{document.name}</span>
          {getStatusIcon(document.status)}
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-72" align="start">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">{document.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{document.type}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Status</span>
              <p className="font-medium">{formatStatus(document.status)}</p>
            </div>
            {document.category && (
              <div>
                <span className="text-muted-foreground text-xs">Category</span>
                <p className="font-medium capitalize">{document.category}</p>
              </div>
            )}
          </div>

          {(document.expirationDate || document.dueDate) && (
            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {document.expirationDate 
                    ? `Expires: ${format(new Date(document.expirationDate), 'MMM d, yyyy')}`
                    : document.dueDate 
                      ? `Due: ${format(new Date(document.dueDate), 'MMM d, yyyy')}`
                      : ''
                  }
                </span>
              </div>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
