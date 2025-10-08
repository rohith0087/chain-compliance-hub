import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: 'high' | 'medium' | 'low';
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = {
    high: {
      icon: AlertTriangle,
      label: 'High Priority',
      className: 'bg-danger/10 text-danger border-danger/20 animate-pulse'
    },
    medium: {
      icon: Clock,
      label: 'Medium Priority',
      className: 'bg-warning/10 text-warning border-warning/20'
    },
    low: {
      icon: CheckCircle,
      label: 'Low Priority',
      className: 'bg-success/10 text-success border-success/20'
    }
  };

  const { icon: Icon, label, className: priorityClassName } = config[priority];

  return (
    <Badge className={cn(
      'rounded-full px-3 py-1.5 border',
      priorityClassName,
      className
    )}>
      <Icon className="h-3 w-3 mr-1.5" />
      {label}
    </Badge>
  );
}

interface UrgencyBadgeProps {
  daysUntilDue: number;
  className?: string;
}

export function UrgencyBadge({ daysUntilDue, className }: UrgencyBadgeProps) {
  const isOverdue = daysUntilDue < 0;
  const isUrgent = daysUntilDue <= 3 && daysUntilDue >= 0;

  if (isOverdue) {
    return (
      <Badge className={cn(
        'rounded-full px-3 py-1.5 bg-danger/10 text-danger border border-danger/20 animate-pulse',
        className
      )}>
        <AlertTriangle className="h-3 w-3 mr-1.5" />
        Overdue
      </Badge>
    );
  }

  if (isUrgent) {
    return (
      <Badge className={cn(
        'rounded-full px-3 py-1.5 bg-warning/10 text-warning border border-warning/20',
        className
      )}>
        <Clock className="h-3 w-3 mr-1.5" />
        Due Soon
      </Badge>
    );
  }

  return null;
}