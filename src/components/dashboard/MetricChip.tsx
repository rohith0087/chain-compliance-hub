import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MetricChipProps {
  label: string;
  value: number;
  trend?: number;
  color?: 'blue' | 'amber' | 'teal' | 'red' | 'green' | 'purple';
  pulse?: boolean;
}

const colorMap = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  green: 'bg-green-500/10 text-green-600 dark:text-green-400',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

const dotColorMap = {
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  teal: 'bg-teal-500',
  red: 'bg-red-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
};

export function MetricChip({ label, value, trend, color = 'blue', pulse }: MetricChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'flex items-center gap-3 px-5 py-4 rounded-xl min-w-[110px]',
        'bg-gradient-to-br from-card to-muted/30 border border-border/50',
        'hover:border-primary/40 hover:shadow-md transition-all duration-200',
        colorMap[color]
      )}
    >
      <div className="relative">
        <div className={cn('w-3 h-3 rounded-full', dotColorMap[color])} />
        {pulse && (
          <div className={cn('absolute inset-0 w-3 h-3 rounded-full animate-ping', dotColorMap[color], 'opacity-75')} />
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-2xl font-bold">{value}</span>
          {trend !== undefined && trend !== 0 && (
            <span className={cn(
              'text-sm font-medium',
              trend > 0 ? 'text-green-500' : 'text-red-500'
            )}>
              {trend > 0 ? '+' : ''}{trend}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
