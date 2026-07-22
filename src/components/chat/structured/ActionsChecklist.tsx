import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ListChecks, ArrowRight, AlertTriangle, ArrowUp, Minus } from 'lucide-react';

interface Action {
  text: string;
  priority?: string;
}

interface ActionsChecklistProps {
  actions: Action[];
}

const getPriorityConfig = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case 'high':
    case 'urgent':
      return {
        icon: ArrowUp,
        color: 'text-danger',
        badgeClass: 'bg-danger/15 text-danger',
        label: 'High',
      };
    case 'medium':
      return {
        icon: Minus,
        color: 'text-warning',
        badgeClass: 'bg-warning/15 text-warning',
        label: 'Medium',
      };
    case 'low':
      return {
        icon: Minus,
        color: 'text-primary',
        badgeClass: 'bg-primary/15 text-primary',
        label: 'Low',
      };
    default:
      return {
        icon: Minus,
        color: 'text-muted-foreground',
        badgeClass: 'bg-muted text-muted-foreground',
        label: priority || '',
      };
  }
};

export const ActionsChecklist: React.FC<ActionsChecklistProps> = ({ actions }) => {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  
  const toggleItem = (index: number) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedItems(newChecked);
  };
  
  // Sort actions by priority (high first)
  const sortedActions = [...actions].sort((a, b) => {
    const priorityOrder: Record<string, number> = { high: 0, urgent: 0, medium: 1, low: 2 };
    const aPriority = priorityOrder[a.priority?.toLowerCase() || ''] ?? 3;
    const bPriority = priorityOrder[b.priority?.toLowerCase() || ''] ?? 3;
    return aPriority - bPriority;
  });
  
  const completedCount = checkedItems.size;
  const totalCount = actions.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  
  return (
    <Card className="p-4 border-l-4 border-l-primary bg-card">
      <div className="flex items-center gap-2 mb-4">
        <ListChecks className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg text-foreground">Recommended Actions</h3>
        <Badge variant="outline" className="ml-auto">
          {completedCount}/{totalCount}
        </Badge>
      </div>
      
      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      
      <ol className="space-y-2">
        {sortedActions.map((action, index) => {
          const priorityConfig = getPriorityConfig(action.priority);
          const isChecked = checkedItems.has(index);
          
          return (
            <li 
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                isChecked 
                  ? 'bg-muted/30 border-border/50 opacity-60' 
                  : 'bg-card border-border hover:border-primary/30'
              }`}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => toggleItem(index)}
                className="mt-0.5"
              />
              
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {action.text}
                </span>
              </div>
              
              {action.priority && (
                <Badge variant="outline" className={`shrink-0 text-xs ${priorityConfig.badgeClass}`}>
                  {priorityConfig.label}
                </Badge>
              )}
              
              {!isChecked && (
                <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2 text-xs">
                  <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
};

export default ActionsChecklist;
