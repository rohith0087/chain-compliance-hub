import React, { useEffect, useRef } from 'react';
import { DocumentTag } from '@/hooks/useCommunicationMessages';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface DocumentTagPickerProps {
  documents: DocumentTag[];
  search: string;
  onSelect: (document: DocumentTag) => void;
  onClose: () => void;
}

export function DocumentTagPicker({
  documents,
  search,
  onSelect,
  onClose
}: DocumentTagPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
      case 'pending_review':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'rejected':
      case 'declined':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'expired':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatStatus = (status: string) => {
    return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 w-80 bg-popover border border-border rounded-lg shadow-lg z-50"
    >
      <div className="p-3 border-b border-border">
        <p className="text-sm font-medium">Tag a Document</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {search ? `Searching for "${search}"...` : 'Type to search documents'}
        </p>
      </div>

      <ScrollArea className="max-h-60">
        {documents.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {search ? 'No documents found' : 'Start typing to search documents'}
          </div>
        ) : (
          <div className="p-2">
            {documents.map(doc => (
              <button
                key={doc.id}
                onClick={() => onSelect(doc)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted text-left transition-colors"
              >
                {getStatusIcon(doc.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{doc.type}</span>
                    <span>•</span>
                    <span>{formatStatus(doc.status)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
