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
  valueClassName
}: StatCardProps) {
  const trendPositive = trend && trend > 0;
  const trendNegative = trend && trend < 0;

  return (
    <Card className={cn(
      "group relative overflow-hidden border-0 bg-gradient-card hover:shadow-2xl transition-all duration-500 hover:-translate-y-1",
      className
    )}>
      {/* Gradient accent top border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent" />
      
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {title}
            </p>
            <p className={cn(
              "text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent",
              valueClassName
            )}>
              {value}
            </p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">
                {subtitle}
              </p>
            )}
            
            {trend !== undefined && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                {trendPositive ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : trendNegative ? (
                  <TrendingDown className="h-4 w-4 text-danger" />
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
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/10 blur-xl group-hover:blur-2xl transition-all" />
            <div className={cn(
              "relative h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg",
              iconClassName
            )}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}