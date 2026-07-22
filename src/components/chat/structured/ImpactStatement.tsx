import React from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface ImpactStatementProps {
  content: string;
}

export const ImpactStatement: React.FC<ImpactStatementProps> = ({ content }) => {
  return (
    <Card className="p-4 bg-warning/10 border-warning/20">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-warning/15 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <div>
          <h4 className="font-semibold text-warning mb-1">
            Business Impact
          </h4>
          <p className="text-sm text-warning leading-relaxed">
            {content}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default ImpactStatement;
