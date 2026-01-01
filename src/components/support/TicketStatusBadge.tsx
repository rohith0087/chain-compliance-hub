import { cn } from '@/lib/utils';

interface TicketStatusBadgeProps {
  status: 'open' | 'in_progress' | 'awaiting_user' | 'resolved' | 'closed';
  className?: string;
}

const statusConfig = {
  open: {
    label: 'Open',
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  },
  awaiting_user: {
    label: 'Awaiting Response',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/50 dark:text-gray-400 dark:border-gray-700',
  },
  closed: {
    label: 'Closed',
    className: 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-900/50 dark:text-gray-500 dark:border-gray-700',
  },
};

export const TicketStatusBadge = ({ status, className }: TicketStatusBadgeProps) => {
  const config = statusConfig[status] || statusConfig.open;
  
  return (
    <span 
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
};
