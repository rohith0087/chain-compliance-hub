import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle2, ClipboardList, Clock, FileWarning,
  Gauge, Loader2, PlayCircle, RefreshCw, ShieldX,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { reviewCardContainerClass } from '@/components/documents/buyerReviewDesignSystem';

interface CommandCenterViewProps {
  buyerId: string;
  onNavigate?: (tab: string) => void;
}

interface SignalRow {
  id: string;
  signal_type: string;
  weight: number;
  framework_code: string;
  requirement_title: string | null;
  requirement_key: string;
  explanation: string | null;
  detected_at: string;
  supplier_name: string | null;
}

interface TaskRow {
  id: string;
  task_type: string;
  title: string;
  status: string;
  due_date: string | null;
  created_at: string;
  supplier_name: string | null;
}

interface Summary {
  outcome_counts: Record<string, number>;
  open_signal_count: number;
  open_task_count: number;
  top_signals: SignalRow[];
  open_tasks: TaskRow[];
}

const SIGNAL_META: Record<string, { label: string; icon: typeof AlertTriangle; tone: string; cta: { label: string; tab: string } }> = {
  expired_evidence: { label: 'Expired evidence', icon: ShieldX, tone: 'text-danger', cta: { label: 'Open decisions', tab: 'compliance-decisions' } },
  missing_evidence: { label: 'Missing evidence', icon: FileWarning, tone: 'text-danger', cta: { label: 'Open decisions', tab: 'compliance-decisions' } },
  rejected_evidence: { label: 'Rejected evidence', icon: AlertTriangle, tone: 'text-warning', cta: { label: 'Open decisions', tab: 'compliance-decisions' } },
  awaiting_review: { label: 'Awaiting review', icon: Clock, tone: 'text-warning', cta: { label: 'Review mappings', tab: 'mapping-review' } },
  requested_pending: { label: 'Requested, pending supplier', icon: Activity, tone: 'text-primary', cta: { label: 'View requests', tab: 'requests' } },
};

export default function CommandCenterView({ buyerId, onNavigate }: CommandCenterViewProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcError } = await (supabase as any).rpc('command_center_summary_v1', { p_buyer_id: buyerId });
      if (rpcError) throw rpcError;
      setSummary(data as Summary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load command center');
    } finally {
      setLoading(false);
    }
  }, [buyerId]);

  useEffect(() => { void load(); }, [load]);

  const [actingTaskId, setActingTaskId] = useState<string | null>(null);
  const taskAction = async (taskId: string, action: 'start' | 'complete') => {
    setActingTaskId(taskId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rpcError } = await (supabase as any).rpc('update_compliance_task_v1', {
        p_task_id: taskId, p_action: action,
      });
      if (rpcError) throw rpcError;
      toast.success(action === 'complete' ? 'Task marked done' : 'Task started');
      await load();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Task update failed');
    } finally {
      setActingTaskId(null);
    }
  };

  const counts = summary?.outcome_counts ?? {};
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  const compliant = Number(counts.compliant ?? 0) + Number(counts.not_applicable ?? 0);
  const compliantPct = total > 0 ? Math.round((compliant / total) * 100) : 0;

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading command center…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-h1 font-semibold text-foreground">
          <Gauge className="h-6 w-6 text-primary" />
          Command Center
        </h1>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${reviewCardContainerClass} p-4`}>
          <p className="text-xs uppercase text-muted-foreground">Requirement health</p>
          <p className="mt-1 text-3xl font-semibold">{compliantPct}%</p>
          <p className="text-xs text-muted-foreground">{compliant} of {total} requirement decisions compliant</p>
        </div>
        <div className={`${reviewCardContainerClass} p-4`}>
          <p className="text-xs uppercase text-muted-foreground">Open risk signals</p>
          <p className="mt-1 text-3xl font-semibold text-warning">{summary?.open_signal_count ?? 0}</p>
          <p className="text-xs text-muted-foreground">gaps detected by the 15-minute scan</p>
        </div>
        <div className={`${reviewCardContainerClass} p-4`}>
          <p className="text-xs uppercase text-muted-foreground">Open tasks</p>
          <p className="mt-1 text-3xl font-semibold">{summary?.open_task_count ?? 0}</p>
          <p className="text-xs text-muted-foreground">auto-created from gaps + assigned work</p>
        </div>
        <div className={`${reviewCardContainerClass} p-4`}>
          <p className="text-xs uppercase text-muted-foreground">Status mix</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(counts).map(([outcome, count]) => (
              <Badge key={outcome} variant="outline" className="text-xs">{outcome}: {String(count)}</Badge>
            ))}
            {total === 0 && <span className="text-xs text-muted-foreground">No evaluations yet</span>}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Priority queue</h2>
          {(summary?.top_signals ?? []).length > 0 && (
            <span className="text-xs text-muted-foreground">{(summary?.top_signals ?? []).length} to action</span>
          )}
        </div>
        <div className={`${reviewCardContainerClass} divide-y divide-border overflow-hidden`}>
          {(summary?.top_signals ?? []).map((signal) => {
            const meta = SIGNAL_META[signal.signal_type] ?? SIGNAL_META.missing_evidence;
            const Icon = meta.icon;
            const risk = Math.round(Number(signal.weight) * 100);
            const riskTone = risk >= 70 ? 'bg-danger/15 text-danger' : risk >= 40 ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground';
            return (
              <div key={signal.id} className="flex items-center gap-3 p-3 hover:bg-muted/40">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${riskTone}`}>{risk}</span>
                <Icon className={`h-4 w-4 shrink-0 ${meta.tone}`} />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate font-medium">{signal.requirement_title ?? signal.requirement_key}</span>
                  <Badge variant="secondary" className="font-mono text-micro">{signal.framework_code}</Badge>
                  {signal.supplier_name && <Badge variant="outline" className="text-micro">{signal.supplier_name}</Badge>}
                  <span className={`text-micro font-medium ${meta.tone}`}>{meta.label}</span>
                </div>
                {onNavigate && (
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => onNavigate(meta.cta.tab)}>{meta.cta.label}</Button>
                )}
              </div>
            );
          })}
          {(summary?.top_signals ?? []).length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-success" />
              All clear — no open risk signals right now.
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <ClipboardList className="h-4 w-4" /> Open tasks
        </h2>
        <div className={`${reviewCardContainerClass} divide-y divide-border overflow-hidden`}>
          {(summary?.open_tasks ?? []).map((task) => (
            <div key={task.id} className="flex items-center gap-2 p-3 hover:bg-muted/40">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-micro">{task.task_type.replaceAll('_', ' ')}</Badge>
                {task.status === 'in_progress' && <Badge className="bg-primary/15 text-primary text-micro">in progress</Badge>}
                <span className="truncate text-sm">{task.title}</span>
                {task.supplier_name && <Badge variant="outline" className="text-micro">{task.supplier_name}</Badge>}
              </div>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {task.due_date ? `due ${task.due_date}` : new Date(task.created_at).toLocaleDateString()}
              </span>
              {task.status === 'open' && (
                <Button size="sm" variant="ghost" className="shrink-0" disabled={actingTaskId === task.id} onClick={() => void taskAction(task.id, 'start')}>
                  <PlayCircle className="mr-1 h-4 w-4" /> Start
                </Button>
              )}
              <Button size="sm" variant="outline" className="shrink-0" disabled={actingTaskId === task.id} onClick={() => void taskAction(task.id, 'complete')}>
                {actingTaskId === task.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />} Done
              </Button>
            </div>
          ))}
          {(summary?.open_tasks ?? []).length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No open tasks.</div>
          )}
        </div>
      </div>
    </div>
  );
}
