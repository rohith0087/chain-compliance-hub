import { Card, CardContent } from '@/components/ui/card';
import { FileCheck, AlertTriangle, CalendarClock, TrendingUp, XCircle, CheckCircle2 } from 'lucide-react';
import { useCOAOverviewStats } from '@/hooks/useCOA';
import { demoSubmissions, demoSchedules } from './coaDemoData';

export function COAOverview() {
  const { data: liveStats, isLoading } = useCOAOverviewStats();

  // Fallback to demo data when no live data
  const stats = liveStats && liveStats.totalSubmissions > 0
    ? liveStats
    : {
        totalSubmissions: demoSubmissions.length,
        passCount: demoSubmissions.filter(s => s.pass_fail === 'pass').length,
        failCount: demoSubmissions.filter(s => s.pass_fail === 'fail').length,
        flaggedCount: demoSubmissions.reduce((acc, s) => acc + s.flags_count, 0),
        avgScore: Math.round(demoSubmissions.reduce((acc, s) => acc + (s.overall_score || 0), 0) / demoSubmissions.length),
        overdueSchedules: demoSchedules.filter(s => s.status === 'overdue').length,
        upcomingSchedules: demoSchedules.filter(s => s.status === 'active').length,
      };

  const cards = [
    { label: 'Total COAs', value: stats.totalSubmissions, icon: FileCheck, color: 'text-primary' },
    { label: 'Passed', value: stats.passCount, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Failed', value: stats.failCount, icon: XCircle, color: 'text-destructive' },
    { label: 'Total Flags', value: stats.flaggedCount, icon: AlertTriangle, color: 'text-amber-600' },
    { label: 'Avg Score', value: stats.avgScore, icon: TrendingUp, color: 'text-primary' },
    { label: 'Overdue', value: stats.overdueSchedules, icon: CalendarClock, color: stats.overdueSchedules > 0 ? 'text-destructive' : 'text-muted-foreground' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="border-border/40">
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <Icon className={`h-5 w-5 ${stat.color}`} />
              <span className="text-2xl font-bold">{isLoading ? '…' : stat.value}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
