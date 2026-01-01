import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowUp, Minus, ArrowDown } from 'lucide-react';

interface TicketPriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  showLabel?: boolean;
  className?: string;
}

const priorityConfig = {
  urgent: {
    label: 'Urgent',
    icon: AlertTriangle,
    className: 'text-red-600 dark:text-red-400',
  },
  high: {
    label: 'High',
    icon: ArrowUp,
    className: 'text-orange-600 dark:text-orange-400',
  },
  medium: {
    label: 'Medium',
    icon: Minus,
    className: 'text-muted-foreground',
  },
  low: {
    label: 'Low',
    icon: ArrowDown,
    className: 'text-muted-foreground/70',
  },
};

export const TicketPriorityBadge = ({ priority, showLabel = false, className }: TicketPriorityBadgeProps) => {
  const config = priorityConfig[priority] || priorityConfig.medium;
  const Icon = config.icon;
  
  return (
    <span 
      className={cn(
        'inline-flex items-center gap-1',
        config.className,
        className
      )}
      title={config.label}
    >
      <Icon className="h-3.5 w-3.5" />
      {showLabel && <span className="text-xs font-medium">{config.label}</span>}
    </span>
  );
};
