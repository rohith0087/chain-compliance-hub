import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  FileCheck, AlertTriangle, CalendarClock, TrendingUp, XCircle, CheckCircle2,
  ShieldAlert, Beaker, FlaskConical, Wheat, TrendingDown, Clock, ArrowUpRight
} from 'lucide-react';
import { useCOAOverviewStats } from '@/hooks/useCOA';
import { demoSubmissions, demoSchedules, COASubmission, COASchedule } from './coaDemoData';
import { COAScoreCard } from './COAScoreCard';
import { format, parseISO, differenceInDays } from 'date-fns';

export function COAOverview() {
  const { data: liveStats, isLoading } = useCOAOverviewStats();

  const submissions = demoSubmissions;
  const schedules = demoSchedules;

  const stats = liveStats && liveStats.totalSubmissions > 0
    ? liveStats
    : {
        totalSubmissions: submissions.length,
        passCount: submissions.filter(s => s.pass_fail === 'pass').length,
        failCount: submissions.filter(s => s.pass_fail === 'fail').length,
        flaggedCount: submissions.reduce((acc, s) => acc + s.flags_count, 0),
        avgScore: Math.round(submissions.reduce((acc, s) => acc + (s.overall_score || 0), 0) / submissions.length),
        overdueSchedules: schedules.filter(s => s.status === 'overdue').length,
        upcomingSchedules: schedules.filter(s => s.status === 'active').length,
      };

  // Derive top failing analytes
  const failingAnalytes = useMemo(() => {
    const map: Record<string, { name: string; fails: number; flags: number; category: string }> = {};
    submissions.forEach(sub => {
      sub.analyte_results.forEach(r => {
        if (r.status === 'fail' || r.status === 'flagged') {
          if (!map[r.analyte_code]) {
            map[r.analyte_code] = { name: r.analyte_name, fails: 0, flags: 0, category: '' };
            const spec = demoSchedules; // category from specs
          }
          if (r.status === 'fail') map[r.analyte_code].fails++;
          if (r.status === 'flagged') map[r.analyte_code].flags++;
        }
      });
    });
    return Object.values(map)
      .sort((a, b) => (b.fails + b.flags) - (a.fails + a.flags))
      .slice(0, 6);
  }, [submissions]);

  const maxAnalyteIssues = Math.max(...failingAnalytes.map(a => a.fails + a.flags), 1);

  // Derive supplier performance
  const supplierPerf = useMemo(() => {
    const map: Record<string, { name: string; count: number; passCount: number; failCount: number; partialCount: number; lastDate: string; avgScore: number; totalScore: number }> = {};
    submissions.forEach(sub => {
      if (!map[sub.supplier_id]) {
        map[sub.supplier_id] = { name: sub.supplier_name, count: 0, passCount: 0, failCount: 0, partialCount: 0, lastDate: sub.submission_date, avgScore: 0, totalScore: 0 };
      }
      const s = map[sub.supplier_id];
      s.count++;
      s.totalScore += sub.overall_score || 0;
      if (sub.pass_fail === 'pass') s.passCount++;
      else if (sub.pass_fail === 'fail') s.failCount++;
      else if (sub.pass_fail === 'partial') s.partialCount++;
      if (sub.submission_date > s.lastDate) s.lastDate = sub.submission_date;
    });
    return Object.values(map).map(s => ({ ...s, avgScore: Math.round(s.totalScore / s.count) }));
  }, [submissions]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, { total: number; pass: number; fail: number; flagged: number }> = {
      'Microbiological': { total: 0, pass: 0, fail: 0, flagged: 0 },
      'Heavy Metals': { total: 0, pass: 0, fail: 0, flagged: 0 },
      'Allergens': { total: 0, pass: 0, fail: 0, flagged: 0 },
    };
    const catMap: Record<string, string> = {
      SALMONELLA: 'Microbiological', E_COLI: 'Microbiological', TPC: 'Microbiological',
      YEAST_MOLD: 'Microbiological', LISTERIA: 'Microbiological', COLIFORMS: 'Microbiological',
      LEAD: 'Heavy Metals', ARSENIC: 'Heavy Metals', CADMIUM: 'Heavy Metals', MERCURY: 'Heavy Metals',
      PEANUT: 'Allergens', GLUTEN: 'Allergens', MILK: 'Allergens', SOY: 'Allergens', SESAME: 'Allergens',
    };
    submissions.forEach(sub => {
      sub.analyte_results.forEach(r => {
        const cat = catMap[r.analyte_code];
        if (cat && cats[cat]) {
          cats[cat].total++;
          if (r.status === 'pass') cats[cat].pass++;
          else if (r.status === 'fail') cats[cat].fail++;
          else if (r.status === 'flagged') cats[cat].flagged++;
        }
      });
    });
    return cats;
  }, [submissions]);

  // Critical alerts
  const criticalAlerts = useMemo(() => {
    const alerts: { severity: 'critical' | 'high' | 'medium'; message: string; source: string }[] = [];
    submissions.forEach(sub => {
      sub.analyte_results.forEach(r => {
        if (r.analyte_code === 'SALMONELLA' && r.status === 'fail') {
          alerts.push({ severity: 'critical', message: `Salmonella detected in ${sub.product_name}`, source: `${sub.supplier_name} — Lot ${sub.lot_number}` });
        }
        if (r.analyte_code === 'LISTERIA' && r.status === 'fail') {
          alerts.push({ severity: 'critical', message: `Listeria detected in ${sub.product_name}`, source: `${sub.supplier_name} — Lot ${sub.lot_number}` });
        }
        if (r.analyte_code === 'LEAD' && r.status === 'fail' && r.numeric_value && r.spec_max && r.numeric_value > r.spec_max * 2) {
          alerts.push({ severity: 'high', message: `Lead at ${r.numeric_value} mg/kg (${(r.numeric_value / r.spec_max).toFixed(1)}x limit)`, source: `${sub.supplier_name} — ${sub.product_name}` });
        }
      });
      if (sub.overall_score !== null && sub.overall_score < 50) {
        alerts.push({ severity: 'high', message: `COA score ${sub.overall_score}/100 — immediate review needed`, source: `${sub.supplier_name} — ${sub.product_name}` });
      }
    });
    schedules.forEach(sch => {
      if (sch.status === 'overdue') {
        const daysOverdue = differenceInDays(new Date(), parseISO(sch.next_due_date));
        alerts.push({ severity: 'medium', message: `COA overdue by ${daysOverdue} days`, source: `${sch.supplier_name} — ${sch.product_name}` });
      }
    });
    return alerts.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [submissions, schedules]);

  const categoryIcons: Record<string, React.ReactNode> = {
    'Microbiological': <FlaskConical className="h-4 w-4 text-purple-500" />,
    'Heavy Metals': <Beaker className="h-4 w-4 text-orange-500" />,
    'Allergens': <Wheat className="h-4 w-4 text-amber-500" />,
  };

  const statCards = [
    { label: 'Total COAs', value: stats.totalSubmissions, icon: FileCheck, color: 'text-primary' },
    { label: 'Passed', value: stats.passCount, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Failed', value: stats.failCount, icon: XCircle, color: 'text-destructive' },
    { label: 'Total Flags', value: stats.flaggedCount, icon: AlertTriangle, color: 'text-amber-600' },
    { label: 'Avg Score', value: stats.avgScore, icon: TrendingUp, color: 'text-primary' },
    { label: 'Overdue', value: stats.overdueSchedules, icon: CalendarClock, color: stats.overdueSchedules > 0 ? 'text-destructive' : 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((stat) => {
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

      {/* Row 1: Failing Analytes + Supplier Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Failing Analytes */}
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Top Failing Analytes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {failingAnalytes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No failures detected — all analytes within spec</p>
            ) : (
              failingAnalytes.map((analyte) => {
                const total = analyte.fails + analyte.flags;
                const pct = (total / maxAnalyteIssues) * 100;
                return (
                  <div key={analyte.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{analyte.name}</span>
                      <div className="flex items-center gap-2">
                        {analyte.fails > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{analyte.fails} fail{analyte.fails > 1 ? 's' : ''}</Badge>
                        )}
                        {analyte.flags > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600">{analyte.flags} flag{analyte.flags > 1 ? 's' : ''}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: analyte.fails > 0
                            ? 'hsl(var(--destructive))'
                            : 'hsl(var(--chart-4))',
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Supplier Performance */}
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Supplier Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Supplier</TableHead>
                  <TableHead className="text-xs text-center">COAs</TableHead>
                  <TableHead className="text-xs text-center">Score</TableHead>
                  <TableHead className="text-xs text-center">Pass Rate</TableHead>
                  <TableHead className="text-xs text-right">Last COA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierPerf.map(sp => {
                  const passRate = sp.count > 0 ? Math.round((sp.passCount / sp.count) * 100) : 0;
                  return (
                    <TableRow key={sp.name}>
                      <TableCell className="font-medium text-sm py-2">{sp.name}</TableCell>
                      <TableCell className="text-center text-sm py-2">{sp.count}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex justify-center">
                          <COAScoreCard score={sp.avgScore} size={40} strokeWidth={4} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <span className={`text-sm font-medium ${passRate >= 80 ? 'text-green-600' : passRate >= 50 ? 'text-amber-600' : 'text-destructive'}`}>
                          {passRate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground py-2">
                        {format(parseISO(sp.lastDate), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Category Breakdown + Critical Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Breakdown */}
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Beaker className="h-4 w-4 text-primary" />
              Category Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(categoryBreakdown).map(([cat, data]) => {
              const passRate = data.total > 0 ? Math.round((data.pass / data.total) * 100) : 100;
              return (
                <div key={cat} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {categoryIcons[cat]}
                      <span className="text-sm font-medium">{cat}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{data.total} tests</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                    {data.total > 0 && (
                      <>
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${(data.pass / data.total) * 100}%` }}
                        />
                        <div
                          className="h-full bg-amber-500 transition-all"
                          style={{ width: `${(data.flagged / data.total) * 100}%` }}
                        />
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${(data.fail / data.total) * 100}%`,
                            background: 'hsl(var(--destructive))',
                          }}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{data.pass} pass</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{data.flagged} flagged</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'hsl(var(--destructive))' }} />{data.fail} fail</span>
                    <span className="ml-auto font-medium" style={{ color: passRate >= 80 ? 'hsl(var(--chart-2))' : passRate >= 50 ? 'hsl(var(--chart-4))' : 'hsl(var(--destructive))' }}>{passRate}% pass</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Critical Alerts */}
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Critical Alerts
              {criticalAlerts.length > 0 && (
                <Badge variant="destructive" className="text-[10px] ml-1">{criticalAlerts.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {criticalAlerts.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-sm">No critical alerts</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {criticalAlerts.map((alert, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50 border border-border/30">
                    <div className="mt-0.5">
                      {alert.severity === 'critical' ? (
                        <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                      ) : alert.severity === 'high' ? (
                        <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                      ) : (
                        <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{alert.source}</p>
                    </div>
                    <Badge
                      variant={alert.severity === 'critical' ? 'destructive' : 'outline'}
                      className="text-[10px] px-1.5 py-0 shrink-0"
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recent Submissions */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Recent Submissions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Supplier</TableHead>
                <TableHead className="text-xs">Product</TableHead>
                <TableHead className="text-xs">Lot #</TableHead>
                <TableHead className="text-xs text-center">Score</TableHead>
                <TableHead className="text-xs text-center">Result</TableHead>
                <TableHead className="text-xs text-center">Flags</TableHead>
                <TableHead className="text-xs text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...submissions]
                .sort((a, b) => b.submission_date.localeCompare(a.submission_date))
                .map(sub => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium text-sm py-2.5">{sub.supplier_name}</TableCell>
                    <TableCell className="text-sm py-2.5">{sub.product_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground py-2.5 font-mono">{sub.lot_number}</TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex justify-center">
                        <COAScoreCard score={sub.overall_score || 0} size={36} strokeWidth={3} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-2.5">
                      <Badge
                        variant={sub.pass_fail === 'pass' ? 'default' : sub.pass_fail === 'partial' ? 'secondary' : 'destructive'}
                        className="text-[10px] px-2"
                      >
                        {sub.pass_fail === 'pass' ? 'Pass' : sub.pass_fail === 'partial' ? 'Partial' : 'Fail'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center py-2.5">
                      {sub.flags_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          {sub.flags_count}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground py-2.5">
                      {format(parseISO(sub.submission_date), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
