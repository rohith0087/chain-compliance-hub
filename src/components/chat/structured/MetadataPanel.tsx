import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

interface MetadataPanelProps {
  metadata: Record<string, string>;
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({ metadata }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const entries = Object.entries(metadata);
  
  if (entries.length === 0) return null;
  
  return (
    <Card className="p-3 bg-muted/30 border-dashed">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between text-muted-foreground hover:text-foreground"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          <span className="text-xs font-medium">System Metadata</span>
          <Badge variant="outline" className="text-xs">
            {entries.length} fields
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </Button>
      
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="grid grid-cols-2 gap-2">
            {entries.map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="text-muted-foreground">{key}:</span>{' '}
                <span className="font-mono text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default MetadataPanel;
