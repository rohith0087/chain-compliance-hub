import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StickyNote, ShieldCheck, MessageSquare, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { AnalyteNote } from './AnalyteReviewDialog';

interface COANotesPanelProps {
  notes: Map<string, AnalyteNote>;
  hasActiveFilter: boolean;
}

export function COANotesPanel({ notes, hasActiveFilter }: COANotesPanelProps) {
  const notesList = Array.from(notes.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 relative transition-colors"
        >
          <StickyNote className="h-4 w-4" />
          {notesList.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
              {notesList.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="px-3 py-2.5 border-b border-border/50">
          <h4 className="text-sm font-semibold">Review Notes</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {notesList.length} note{notesList.length !== 1 ? 's' : ''} recorded
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notesList.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No review notes yet.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click an analyte row to add one.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {notesList.map((n, idx) => (
                <div key={`${n.submissionId}-${n.analyteId}-${idx}`} className="px-3 py-2.5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{n.analyteName}</span>
                    {n.isFalsePositive && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-blue-200 text-blue-600 bg-blue-50">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Overridden
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{n.supplierName}</p>
                  {n.note && (
                    <p className="text-xs text-foreground/80 leading-relaxed mb-1.5">{n.note}</p>
                  )}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <CalendarIcon className="h-2.5 w-2.5" />
                    {format(parseISO(n.timestamp), 'MMM d, yyyy · h:mm a')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
