import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSearch, Mail, ListPlus, UserSquare2 } from 'lucide-react';

export interface QuickActionItem {
  type: string;
  label: string;
}

interface QuickActionButtonsProps {
  actions: QuickActionItem[];
  metadata: Record<string, string>;
  onQuickAction?: (type: string, metadata: Record<string, string>) => void;
}

const ACTION_ICON: Record<string, typeof FileSearch> = {
  request_documents: FileSearch,
  generate_email: Mail,
  create_task: ListPlus,
  view_supplier_profile: UserSquare2,
};

export const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({ actions, metadata, onQuickAction }) => {
  if (actions.length === 0) return null;

  return (
    <Card className="p-3 border-l-4 border-l-primary bg-card">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = ACTION_ICON[action.type] || FileSearch;
          return (
            <Button
              key={action.type}
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => onQuickAction?.(action.type, metadata)}
            >
              <Icon className="w-3.5 h-3.5" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </Card>
  );
};

export default QuickActionButtons;
