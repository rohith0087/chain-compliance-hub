import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useSupplierRisk } from './useSupplierRisk';
import { submitRiskFeedback, type FeedbackType } from './scoreApi';
import { RISK_DIMENSION_LABELS, RISK_DIMENSIONS, type RiskDimension } from './templates';

export interface ComplianceRisk {
  compliance_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
}

function riskLevelVariant(level: string): 'secondary' | 'outline' | 'destructive' {
  if (level === 'high' || level === 'critical') return 'destructive';
  if (level === 'medium') return 'outline';
  return 'secondary';
}

// Higher score = higher risk (0–100).
function scoreTone(score: number): string {
  if (score >= 67) return 'text-red-600';
  if (score >= 34) return 'text-amber-600';
  return 'text-emerald-600';
}

export function SupplierRiskPanel({
  buyerId,
  supplierId,
  compliance,
}: {
  buyerId: string | null;
  supplierId: string | null;
  compliance?: ComplianceRisk | null;
}) {
  const { score, events, loading, recomputing, recompute } = useSupplierRisk(buyerId, supplierId);
  const { toast } = useToast();
  const [labeling, setLabeling] = useState<string | null>(null);

  const delta =
    score && score.previous_score != null ? score.overall_score - score.previous_score : null;

  // Labels are buyer-scoped; not_relevant / false_entity_match drop the event
  // out of THIS buyer's score (engine v2), so recompute to reflect it.
  const onFeedback = async (eventId: string, type: FeedbackType) => {
    if (!buyerId) return;
    setLabeling(eventId);
    try {
      await submitRiskFeedback(buyerId, eventId, type);
      toast({
        title: 'Feedback saved',
        description:
          type === 'relevant' ? 'Marked relevant.' : 'Excluded from your score — recomputing…',
      });
      if (type !== 'relevant') await recompute();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to save feedback',
        variant: 'destructive',
      });
    } finally {
      setLabeling(null);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* External / adaptive risk (new) */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">External Risk</CardTitle>
            <CardDescription>Sanctions, recalls, ESG, geopolitical…</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={recompute} disabled={recomputing || !supplierId}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${recomputing ? 'animate-spin' : ''}`} />
            Recompute
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !score ? (
            <p className="text-sm text-muted-foreground">
              No external risk score yet. Click Recompute to generate one from current events.
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-3">
                <span className={`text-4xl font-semibold ${scoreTone(score.overall_score)}`}>
                  {score.overall_score}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
                {delta != null && delta !== 0 && (
                  <span className={`text-sm ${delta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {RISK_DIMENSIONS.filter((d) => (score.dimension_scores[d] ?? 0) > 0).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No dimension risk detected.</p>
                ) : (
                  RISK_DIMENSIONS.map((d: RiskDimension) => {
                    const v = score.dimension_scores[d] ?? 0;
                    if (v <= 0) return null;
                    return (
                      <div key={d} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{RISK_DIMENSION_LABELS[d]}</span>
                          <span className="text-muted-foreground">{v}</span>
                        </div>
                        <Progress value={v} />
                      </div>
                    );
                  })
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                engine {score.engine_version} · {new Date(score.calculated_at).toLocaleString()}
              </p>
            </>
          )}

          {events.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Contributing events</p>
                {events.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">
                      {e.event_type.replace(/_/g, ' ')}{' '}
                      <span className="text-muted-foreground">({e.dimension})</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant={e.status === 'under_review' ? 'outline' : 'secondary'}>
                        {e.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs"
                        disabled={labeling === e.id}
                        onClick={() => onFeedback(e.id, 'relevant')}
                      >
                        Relevant
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs"
                        disabled={labeling === e.id}
                        onClick={() => onFeedback(e.id, 'not_relevant')}
                      >
                        Not relevant
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs"
                        disabled={labeling === e.id}
                        onClick={() => onFeedback(e.id, 'false_entity_match')}
                      >
                        False match
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Compliance / document-performance risk (existing) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance Risk</CardTitle>
          <CardDescription>Document performance &amp; submissions (existing).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!compliance ? (
            <p className="text-sm text-muted-foreground">No compliance metrics for this supplier.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className={`text-4xl font-semibold ${scoreTone(compliance.risk_score)}`}>
                  {compliance.risk_score}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
                <Badge variant={riskLevelVariant(compliance.risk_level)}>
                  {compliance.risk_level}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Compliance score</span>
                <span>{compliance.compliance_score}</span>
              </div>
              <Progress value={compliance.compliance_score} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
