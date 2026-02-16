import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, AlertTriangle } from 'lucide-react';
import { RiskDriver } from './riskData';

const confColor = (c: string) => {
  if (c === 'High') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (c === 'Medium') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300';
};

export function KeyDrivers({ drivers }: { drivers: RiskDriver[] }) {
  const maxImpact = Math.max(...drivers.map(d => d.impact));

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Key Risk Drivers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {drivers.map((d, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm flex-1">{d.description}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="destructive" className="text-xs font-semibold">+{d.impact}</Badge>
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
            <Progress value={(d.impact / maxImpact) * 100} className="h-1.5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
