import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, ChevronUp, Calendar as CalendarIcon, Hash, Loader2, Search, X } from 'lucide-react';
import { useCOASubmissions } from '@/hooks/useCOA';
import { demoSubmissions, type COASubmission } from './coaDemoData';
import { COAScoreCard } from './COAScoreCard';
import { COAComparisonTable } from './COAComparisonTable';
import { COAFlagsBanner } from './COAFlagsBanner';
import { format, parseISO, isWithinInterval, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

const passBadgeStyles: Record<string, string> = {
  pass: 'bg-green-100 text-green-700 border-green-300',
  partial: 'bg-amber-100 text-amber-700 border-amber-300',
  fail: 'bg-red-100 text-red-700 border-red-300',
};

type DateStatus = 'green' | 'yellow' | 'orange' | 'red';

function computeDateStatusMap(submissions: COASubmission[]): Map<string, DateStatus> {
  const dateMap = new Map<string, { total: number; failCount: number }>();

  for (const sub of submissions) {
    const dateKey = sub.submission_date.slice(0, 10);
    const existing = dateMap.get(dateKey) || { total: 0, failCount: 0 };
    existing.total++;
    const fails = sub.analyte_results.filter(r => r.status === 'fail').length;
    existing.failCount += fails;
    dateMap.set(dateKey, existing);
  }

  const statusMap = new Map<string, DateStatus>();
  for (const [dateKey, { failCount }] of dateMap) {
    if (failCount === 0) statusMap.set(dateKey, 'green');
    else if (failCount <= 2) statusMap.set(dateKey, 'yellow');
    else if (failCount <= 5) statusMap.set(dateKey, 'orange');
    else statusMap.set(dateKey, 'red');
  }
  return statusMap;
}

const dotColors: Record<DateStatus, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

const dotGlows: Record<DateStatus, string> = {
  green: '0 0 4px #22c55e',
  yellow: '0 0 4px #facc15',
  orange: '0 0 4px #f97316',
  red: '0 0 4px #ef4444',
};

export function COAResultsView() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { data: liveSubmissions, isLoading } = useCOASubmissions();

  const submissions: COASubmission[] = liveSubmissions && liveSubmissions.length > 0 ? liveSubmissions : demoSubmissions;

  // Compute status dots based on supplier filter context
  const dotsSourceSubmissions = useMemo(() => {
    if (!searchQuery) return submissions;
    return submissions.filter(s => s.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [submissions, searchQuery]);

  const dateStatusMap = useMemo(() => computeDateStatusMap(dotsSourceSubmissions), [dotsSourceSubmissions]);

  const filteredSubmissions = useMemo(() => {
    return submissions
      .filter(s => s.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter(s => {
        if (!dateRange?.from) return true;
        const subDate = startOfDay(parseISO(s.submission_date));
        if (dateRange.to) {
          return isWithinInterval(subDate, { start: startOfDay(dateRange.from), end: startOfDay(dateRange.to) });
        }
        return subDate.getTime() === startOfDay(dateRange.from).getTime();
      });
  }, [submissions, searchQuery, dateRange]);

  const hasFilters = searchQuery.length > 0 || !!dateRange?.from;

  const rangeLabel = useMemo(() => {
    if (!dateRange?.from) return null;
    const fromStr = format(dateRange.from, 'MMM d, yyyy');
    if (!dateRange.to) return fromStr;
    const toStr = format(dateRange.to, 'MMM d, yyyy');
    return `${fromStr} – ${toStr}`;
  }, [dateRange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading results...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for a supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {rangeLabel && (
            <Badge
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-secondary/80 transition-colors text-xs"
              onClick={() => setDateRange(undefined)}
            >
              {rangeLabel}
              <X className="h-3 w-3" />
            </Badge>
          )}

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "h-10 w-10 shrink-0 transition-colors",
                  dateRange?.from && "border-primary/50 text-primary"
                )}
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                className={cn("p-3 pointer-events-auto")}
                classNames={{
                  day_range_start: "day-range-end rounded-l-full bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_range_end: "day-range-end rounded-r-full bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_range_middle: "aria-selected:bg-primary/10 aria-selected:text-foreground rounded-none",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                }}
                components={{
                  DayContent: ({ date }) => {
                    const dateKey = format(date, 'yyyy-MM-dd');
                    const status = dateStatusMap.get(dateKey);
                    return (
                      <div className="relative flex flex-col items-center">
                        <span>{date.getDate()}</span>
                        {status && (
                          <span
                            className={cn(
                              'absolute -bottom-1 h-1.5 w-1.5 rounded-full ring-1 ring-background',
                              dotColors[status]
                            )}
                            style={{ boxShadow: dotGlows[status] }}
                          />
                        )}
                      </div>
                    );
                  },
                }}
                initialFocus
              />
              {/* Legend */}
              <div className="px-3 pb-3 pt-1 flex items-center justify-center gap-4 text-[10px] text-muted-foreground border-t border-border/30">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-500 ring-1 ring-background" /> All pass
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-yellow-400 ring-1 ring-background" /> Minor
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange-500 ring-1 ring-background" /> Moderate
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 ring-1 ring-background" /> Critical
                </span>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => { setSearchQuery(''); setDateRange(undefined); }}
          >
            Clear all
          </Button>
        )}
      </div>

      <COAFlagsBanner submissions={filteredSubmissions} />

      {filteredSubmissions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No COA submissions match your filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map((sub) => {
            const isExpanded = expandedId === sub.id;
            const passStyle = passBadgeStyles[sub.pass_fail || 'partial'];

            return (
              <Card key={sub.id} className="border-border/40 overflow-hidden">
                <CardContent className="p-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <COAScoreCard score={sub.overall_score || 0} size={56} strokeWidth={5} />
                      <div className="text-left">
                        <h4 className="font-medium text-sm">{sub.supplier_name}</h4>
                        <p className="text-xs text-muted-foreground">{sub.product_name}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className={`text-[10px] ${passStyle}`}>
                            {sub.pass_fail?.toUpperCase()}
                          </Badge>
                          {sub.flags_count > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                              {sub.flags_count} flag{sub.flags_count > 1 ? 's' : ''}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {format(parseISO(sub.submission_date), 'MMM d, yyyy')}
                          </span>
                          {sub.lot_number && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              {sub.lot_number}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {sub.analyte_results.length} analytes
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/50 p-4 bg-muted/10">
                      <COAComparisonTable results={sub.analyte_results} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
