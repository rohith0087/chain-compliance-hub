import React from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface ImpactStatementProps {
  content: string;
}

export const ImpactStatement: React.FC<ImpactStatementProps> = ({ content }) => {
  return (
    <Card className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
            Business Impact
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-400/90 leading-relaxed">
            {content}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default ImpactStatement;
