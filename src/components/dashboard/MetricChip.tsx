import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MetricChipProps {
  label: string;
  value: number;
  subtitle?: string;
  trend?: number;
  color?: 'blue' | 'amber' | 'teal' | 'red' | 'green' | 'purple';
  pulse?: boolean;
  onClick?: () => void;
}

const colorMap = {
  blue: 'bg-primary/10 text-primary',
  amber: 'bg-warning/10 text-warning',
  teal: 'bg-primary/10 text-primary',
  red: 'bg-danger/10 text-danger',
  green: 'bg-success/10 text-success',
  purple: 'bg-primary/10 text-primary',
};

const dotColorMap = {
  blue: 'bg-primary',
  amber: 'bg-warning',
  teal: 'bg-primary',
  red: 'bg-danger',
  green: 'bg-success',
  purple: 'bg-primary',
};

export function MetricChip({ label, value, subtitle, trend, color = 'blue', pulse, onClick }: MetricChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-5 py-4 rounded-xl min-w-[110px]',
        'bg-gradient-to-br from-card to-muted/30 border border-border/50',
        'hover:border-primary/40 hover:shadow-md transition-all duration-200',
        onClick && 'cursor-pointer active:scale-[0.98]',
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
              trend > 0 ? 'text-success' : 'text-danger'
            )}>
              {trend > 0 ? '+' : ''}{trend}
            </span>
          )}
        </div>
        {subtitle && (
          <span className="text-micro text-muted-foreground/70 mt-0.5">{subtitle}</span>
        )}
      </div>
    </motion.div>
  );
}
