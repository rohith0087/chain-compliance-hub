import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, AlertTriangle } from 'lucide-react';
import { RiskDriver } from './riskData';

const confColor = (c: string) => {
  if (c === 'High') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (c === 'Medium') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300';
};

const barColor = (impact: number) => {
  if (impact >= 8) return 'bg-red-500 dark:bg-red-400';
  if (impact >= 5) return 'bg-amber-500 dark:bg-amber-400';
  return 'bg-emerald-500 dark:bg-emerald-400';
};

export function KeyDrivers({ drivers }: { drivers: RiskDriver[] }) {
  const maxImpact = Math.max(...drivers.map(d => d.impact), 1);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Key Risk Drivers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {drivers.map((d, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm flex-1">{d.description}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className={`text-xs border-0 ${confColor(d.confidence)}`}>{d.confidence}</Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[220px]">
                    <p className="text-xs">{d.source}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted/60">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${barColor(d.impact)}`}
                  style={{ width: `${(d.impact / maxImpact) * 100}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-muted-foreground w-6 text-right">+{d.impact}</span>
            </div>
          </div>
        ))}
        <div className="flex justify-between text-[10px] text-muted-foreground/60 pt-1 px-0.5">
          <span>0</span>
          <span>Impact score → {maxImpact}</span>
        </div>
      </CardContent>
    </Card>
  );
}
