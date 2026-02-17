import { Card, CardContent } from '@/components/ui/card';
import { FileCheck, AlertTriangle, CalendarClock, TrendingUp, XCircle, CheckCircle2 } from 'lucide-react';
import { demoSubmissions, demoSchedules } from './coaDemoData';

export function COAOverview() {
  const totalSubmissions = demoSubmissions.length;
  const passCount = demoSubmissions.filter(s => s.pass_fail === 'pass').length;
  const failCount = demoSubmissions.filter(s => s.pass_fail === 'fail').length;
  const flaggedCount = demoSubmissions.reduce((acc, s) => acc + s.flags_count, 0);
  const avgScore = Math.round(demoSubmissions.reduce((acc, s) => acc + (s.overall_score || 0), 0) / totalSubmissions);
  const overdueSchedules = demoSchedules.filter(s => s.status === 'overdue').length;
  const upcomingSchedules = demoSchedules.filter(s => s.status === 'active').length;

  const stats = [
    { label: 'Total COAs', value: totalSubmissions, icon: FileCheck, color: 'text-primary' },
    { label: 'Passed', value: passCount, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Failed', value: failCount, icon: XCircle, color: 'text-destructive' },
    { label: 'Total Flags', value: flaggedCount, icon: AlertTriangle, color: 'text-amber-600' },
    { label: 'Avg Score', value: avgScore, icon: TrendingUp, color: 'text-primary' },
    { label: 'Overdue', value: overdueSchedules, icon: CalendarClock, color: overdueSchedules > 0 ? 'text-destructive' : 'text-muted-foreground' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="border-border/40">
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <Icon className={`h-5 w-5 ${stat.color}`} />
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
