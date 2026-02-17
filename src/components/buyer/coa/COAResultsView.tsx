import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Calendar, Hash, Loader2 } from 'lucide-react';
import { useCOASubmissions } from '@/hooks/useCOA';
import { demoSubmissions, type COASubmission } from './coaDemoData';
import { COAScoreCard } from './COAScoreCard';
import { COAComparisonTable } from './COAComparisonTable';
import { COAFlagsBanner } from './COAFlagsBanner';
import { format, parseISO } from 'date-fns';

const passBadgeStyles: Record<string, string> = {
  pass: 'bg-green-100 text-green-700 border-green-300',
  partial: 'bg-amber-100 text-amber-700 border-amber-300',
  fail: 'bg-red-100 text-red-700 border-red-300',
};

export function COAResultsView() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: liveSubmissions, isLoading } = useCOASubmissions();

  const submissions: COASubmission[] = liveSubmissions && liveSubmissions.length > 0 ? liveSubmissions : demoSubmissions;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading results...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <COAFlagsBanner submissions={submissions} />

      <div className="space-y-3">
        {submissions.map((sub) => {
          const isExpanded = expandedId === sub.id;
          const passStyle = passBadgeStyles[sub.pass_fail || 'partial'];

          return (
            <Card key={sub.id} className="border-border/40 overflow-hidden">
              <CardContent className="p-0">
                {/* Header Row */}
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
                          <Calendar className="h-3 w-3" />
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

                {/* Expanded Detail */}
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
    </div>
  );
}
