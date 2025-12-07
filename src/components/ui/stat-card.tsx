import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  className?: string;
  iconClassName?: string;
  valueClassName?: string;
  compact?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  className,
  iconClassName,
  valueClassName,
  compact = false
}: StatCardProps) {
  const trendPositive = trend && trend > 0;
  const trendNegative = trend && trend < 0;

  return (
    <Card className={cn(
      "group relative overflow-hidden border-0 bg-gradient-card hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5",
      className
    )}>
      {/* Gradient accent top border */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1 bg-gradient-to-r",
        iconClassName || "from-primary via-secondary to-accent"
      )} />
      
      <CardContent className={cn(compact ? "p-4" : "p-6")}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className={cn(
              "font-medium text-muted-foreground truncate",
              compact ? "text-xs mb-1" : "text-sm mb-2"
            )}>
              {title}
            </p>
            <p className={cn(
              "font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent",
              compact ? "text-2xl" : "text-4xl",
              valueClassName
            )}>
              {value}
            </p>
            {subtitle && (
              <p className={cn(
                "text-muted-foreground mt-1 truncate",
                compact ? "text-xs" : "text-sm"
              )}>
                {subtitle}
              </p>
            )}
            
            {trend !== undefined && (
              <div className={cn(
                "flex items-center gap-1 text-xs",
                compact ? "mt-1" : "mt-3"
              )}>
                {trendPositive ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : trendNegative ? (
                  <TrendingDown className="h-3 w-3 text-danger" />
                ) : null}
                <span className={cn(
                  "font-medium",
                  trendPositive && "text-success",
                  trendNegative && "text-danger"
                )}>
                  {trend > 0 ? '+' : ''}{trend}%
                </span>
                {trendLabel && (
                  <span className="text-muted-foreground">{trendLabel}</span>
                )}
              </div>
            )}
          </div>
          
          {/* Icon with gradient background and glow */}
          <div className="relative flex-shrink-0">
            <div className={cn(
              "absolute inset-0 blur-xl group-hover:blur-2xl transition-all",
              iconClassName?.includes('from-') ? iconClassName.replace('from-', 'bg-').split(' ')[0] + '/20' : 'bg-primary/20'
            )} />
            <div className={cn(
              "relative rounded-xl flex items-center justify-center shadow-lg",
              compact ? "h-10 w-10" : "h-12 w-12",
              iconClassName || "bg-gradient-to-br from-primary to-secondary"
            )}>
              <Icon className={cn(
                "text-white",
                compact ? "h-5 w-5" : "h-6 w-6"
              )} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}