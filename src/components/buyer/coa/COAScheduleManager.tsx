import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarClock, Plus, AlertTriangle, CheckCircle2, Clock, Bell } from 'lucide-react';
import { demoSchedules } from './coaDemoData';
import { format, parseISO, differenceInDays } from 'date-fns';

const frequencyLabels: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  per_lot: 'Per Lot',
  custom: 'Custom',
};

const statusStyles: Record<string, { color: string; icon: any }> = {
  active: { color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle2 },
  overdue: { color: 'bg-red-100 text-red-700 border-red-300', icon: AlertTriangle },
  paused: { color: 'bg-gray-100 text-gray-600 border-gray-300', icon: Clock },
};

export function COAScheduleManager() {
  const [schedules] = useState(demoSchedules);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">COA Schedules ({schedules.length})</h3>
        <Button size="sm">
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Schedule
        </Button>
      </div>

      <div className="grid gap-3">
        {schedules.map((schedule) => {
          const style = statusStyles[schedule.status] || statusStyles.active;
          const StatusIcon = style.icon;
          const daysUntilDue = differenceInDays(parseISO(schedule.next_due_date), new Date());
          const isOverdue = daysUntilDue < 0;

          return (
            <Card key={schedule.id} className="border-border/40">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isOverdue ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                      <CalendarClock className={`h-5 w-5 ${isOverdue ? 'text-destructive' : 'text-primary'}`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{schedule.supplier_name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{schedule.product_name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {frequencyLabels[schedule.frequency]}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${style.color}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {schedule.status}
                        </Badge>
                        {schedule.auto_remind && (
                          <Badge variant="outline" className="text-[10px]">
                            <Bell className="h-3 w-3 mr-1" />
                            Auto-remind
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${isOverdue ? 'text-destructive' : ''}`}>
                      {isOverdue 
                        ? `${Math.abs(daysUntilDue)} days overdue`
                        : `Due in ${daysUntilDue} days`
                      }
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Next: {format(parseISO(schedule.next_due_date), 'MMM d, yyyy')}
                    </div>
                    {schedule.last_submitted_date && (
                      <div className="text-xs text-muted-foreground">
                        Last: {format(parseISO(schedule.last_submitted_date), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
