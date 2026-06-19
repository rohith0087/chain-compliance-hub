import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, AlertTriangle, CheckCircle2, ClipboardList, Clock,
  FileQuestion, Loader2, ShieldCheck, ShieldQuestion, XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ComplianceDecisionsViewProps {
  buyerId: string;
}

type SubjectType = 'supplier' | 'facility' | 'product';
type ComplianceOutcome =
  | 'missing' | 'requested' | 'submitted' | 'under_review' | 'compliant'
  | 'conditional' | 'noncompliant' | 'expired' | 'not_applicable';

interface DecisionResult {
  requirement_key: string;
  framework_code: string;
  framework_version: string;
  title: string;
  outcome: ComplianceOutcome;
  explanation: string;
  evidence_claim_ids: string[];
  effective_from: string | null;
  effective_to: string | null;
}

interface EvaluationResponse {
  evaluation_id: string;
  idempotent_replay: boolean;
  evaluator_version: string;
  correlation_id: string;
  results: DecisionResult[];
}

interface SubjectOption {
  id: string;
  label: string;
}

interface ActionTask {
  id: string;
  title: string;
  task_type: string;
  due_date: string | null;
  status: string;
}

interface ActionFinding {
  id: string;
  description: string;
  severity: string;
  status: string;
}

interface ActionApproval {
  id: string;
  approval_type: string;
  status: string;
  requested_at: string;
}

const outcomeConfig: Record<ComplianceOutcome, { label: string; icon: typeof CheckCircle2; className: string }> = {
  compliant: { label: 'Compliant', icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  conditional: { label: 'Conditional', icon: ShieldQuestion, className: 'border-sky-200 bg-sky-50 text-sky-800' },
  noncompliant: { label: 'Noncompliant', icon: XCircle, className: 'border-red-200 bg-red-50 text-red-800' },
  expired: { label: 'Expired', icon: Clock, className: 'border-orange-200 bg-orange-50 text-orange-800' },
  under_review: { label: 'Under review', icon: FileQuestion, className: 'border-amber-200 bg-amber-50 text-amber-800' },
  submitted: { label: 'Submitted', icon: FileQuestion, className: 'border-amber-200 bg-amber-50 text-amber-800' },
  requested: { label: 'Requested', icon: ClipboardList, className: 'border-slate-200 bg-slate-50 text-slate-700' },
  missing: { label: 'Missing', icon: AlertTriangle, className: 'border-slate-200 bg-slate-50 text-slate-700' },
  not_applicable: { label: 'Not applicable', icon: XCircle, className: 'border-slate-200 bg-slate-50 text-slate-500' },
};

const outcomeSeverity: Record<ComplianceOutcome, number> = {
  noncompliant: 0, expired: 1, missing: 2, requested: 3, submitted: 4,
  under_review: 5, conditional: 6, compliant: 7, not_applicable: 8,
};

// Phase 3 tables are intentionally not added to generated types until the migration is approved.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function DecisionCard({ result }: { result: DecisionResult }) {
  const config = outcomeConfig[result.outcome];
  const Icon = config.icon;
  return (
    <Card>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{result.title}</CardTitle>
            <CardDescription>{result.framework_code} · {result.framework_version}</CardDescription>
          </div>
          <Badge variant="outline" className={config.className}>
            <Icon className="mr-1 h-3.5 w-3.5" />{config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">{result.explanation}</p>
        {result.evidence_claim_ids.length > 0 && (
          <p className="text-xs text-muted-foreground">{result.evidence_claim_ids.length} evidence claim(s) considered</p>
        )}
      </CardContent>
    </Card>
  );
}

function ActionItemsPanel({ buyerId }: { buyerId: string }) {
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [findings, setFindings] = useState<ActionFinding[]>([]);
  const [approvals, setApprovals] = useState<ActionApproval[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: taskRows }, { data: findingRows }, { data: approvalRows }] = await Promise.all([
      db.from('compliance_tasks').select('id, title, task_type, due_date, status')
        .eq('buyer_id', buyerId).in('status', ['open', 'in_progress']).order('due_date'),
      db.from('compliance_findings').select('id, description, severity, status')
        .eq('buyer_id', buyerId).in('status', ['open', 'acknowledged']).order('raised_at', { ascending: false }),
      db.from('compliance_approvals').select('id, approval_type, status, requested_at')
        .eq('buyer_id', buyerId).eq('status', 'pending').order('requested_at'),
    ]);
    setTasks(taskRows || []);
    setFindings(findingRows || []);
    setApprovals(approvalRows || []);
  }, [buyerId]);

  useEffect(() => { void load(); }, [load]);

  const runAction = async (id: string, fn: () => Promise<{ error: { message: string } | null }>) => {
    setBusyId(id);
    setError(null);
    const { error: actionError } = await fn();
    setBusyId(null);
    if (actionError) setError(actionError.message);
    else void load();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Action items</CardTitle><CardDescription>Open tasks, findings, and approvals for this organization.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        <div>
          <p className="mb-2 text-sm font-medium">Tasks ({tasks.length})</p>
          {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No open tasks.</p> : (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <span>{task.title} <span className="text-xs text-muted-foreground">({task.task_type}{task.due_date ? `, due ${task.due_date}` : ''})</span></span>
                  <Button size="sm" variant="outline" disabled={busyId === task.id}
                    onClick={() => runAction(task.id, () => db.rpc('complete_compliance_task_v1', { p_task_id: task.id }))}>
                    Complete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Findings ({findings.length})</p>
          {findings.length === 0 ? <p className="text-sm text-muted-foreground">No open findings.</p> : (
            <ul className="space-y-2">
              {findings.map((finding) => (
                <li key={finding.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <span>{finding.description} <Badge variant="outline" className="ml-1">{finding.severity}</Badge></span>
                  <Button size="sm" variant="outline" disabled={busyId === finding.id}
                    onClick={() => runAction(finding.id, () => db.rpc('resolve_compliance_finding_v1', { p_finding_id: finding.id }))}>
                    Resolve
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Pending approvals ({approvals.length})</p>
          {approvals.length === 0 ? <p className="text-sm text-muted-foreground">No pending approvals.</p> : (
            <ul className="space-y-2">
              {approvals.map((approval) => (
                <li key={approval.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <span>{approval.approval_type.replace(/_/g, ' ')} requested {new Date(approval.requested_at).toLocaleDateString()}</span>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busyId === approval.id}
                      onClick={() => runAction(approval.id, () => db.rpc('decide_compliance_approval_v1', { p_approval_id: approval.id, p_decision: 'approved', p_notes: null }))}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busyId === approval.id}
                      onClick={() => runAction(approval.id, () => db.rpc('decide_compliance_approval_v1', { p_approval_id: approval.id, p_decision: 'rejected', p_notes: null }))}>
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ComplianceDecisionsView({ buyerId }: ComplianceDecisionsViewProps) {
  const [subjectType, setSubjectType] = useState<SubjectType>('supplier');
  const [subjects, setSubjects] = useState<Record<SubjectType, SubjectOption[]>>({ supplier: [], facility: [], product: [] });
  const [subjectId, setSubjectId] = useState('');
  const [effectiveAt, setEffectiveAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<EvaluationResponse | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingSubjects(true);
      const { data: connections } = await supabase
        .from('buyer_supplier_connections')
        .select('supplier_id, suppliers(id, company_name)')
        .eq('buyer_id', buyerId)
        .eq('status', 'approved');

      const supplierIds = (connections || []).map((connection) => connection.supplier_id).filter(Boolean);
      const supplierOptions = (connections || []).flatMap((connection) => {
        const supplier = connection.suppliers as unknown as { id: string; company_name: string } | null;
        return supplier ? [{ id: supplier.id, label: supplier.company_name }] : [];
      });

      let facilities: Array<{ id: string; branch_name: string }> = [];
      let products: Array<{ id: string; item_name: string }> = [];
      if (supplierIds.length > 0) {
        const [facilityResult, productResult] = await Promise.all([
          supabase.from('company_branches').select('id, branch_name')
            .in('company_id', supplierIds).eq('company_type', 'supplier').eq('status', 'active'),
          supabase.from('supplier_items').select('id, item_name')
            .in('supplier_id', supplierIds).eq('is_active', true),
        ]);
        facilities = facilityResult.data || [];
        products = productResult.data || [];
      }

      if (!active) return;
      setSubjects({
        supplier: supplierOptions,
        facility: facilities.map((facility) => ({ id: facility.id, label: facility.branch_name })),
        product: products.map((product) => ({ id: product.id, label: product.item_name })),
      });
      setLoadingSubjects(false);
    };
    void load();
    return () => { active = false; };
  }, [buyerId]);

  useEffect(() => { setSubjectId(''); setResponse(null); }, [subjectType]);

  const sortedResults = useMemo(
    () => [...(response?.results || [])].sort((a, b) => outcomeSeverity[a.outcome] - outcomeSeverity[b.outcome]),
    [response],
  );

  const evaluate = async () => {
    if (!subjectId) {
      setError('Select a subject before evaluating compliance.');
      return;
    }
    setEvaluating(true);
    setError(null);
    setResponse(null);

    const correlationId = crypto.randomUUID();
    const { data, error: functionError } = await supabase.functions.invoke('evaluate-compliance-v1', {
      body: { buyer_id: buyerId, subject_type: subjectType, subject_id: subjectId, effective_at: effectiveAt, facts: {} },
      headers: { 'x-idempotency-key': crypto.randomUUID(), 'x-correlation-id': correlationId },
    });

    if (functionError || !data) setError(functionError?.message || 'Compliance evaluation failed.');
    else setResponse(data as EvaluationResponse);
    setEvaluating(false);
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /><h1 className="text-2xl font-semibold">Compliance Decisions</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">Computed compliance status, derived from verified evidence and requirement applicability - not a manually selected document status.</p>
        </div>

        <Tabs value={subjectType} onValueChange={(value) => setSubjectType(value as SubjectType)}>
          <TabsList>
            <TabsTrigger value="supplier">Supplier</TabsTrigger>
            <TabsTrigger value="facility">Facility</TabsTrigger>
            <TabsTrigger value="product">Product</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardHeader><CardTitle>Evaluate compliance</CardTitle><CardDescription>Select a subject and an evaluation date.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Select value={subjectId} onValueChange={setSubjectId} disabled={loadingSubjects}>
                <SelectTrigger><SelectValue placeholder={loadingSubjects ? 'Loading…' : 'Select subject'} /></SelectTrigger>
                <SelectContent>{subjects[subjectType].map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input type="date" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} />
            <Button onClick={evaluate} disabled={evaluating || loadingSubjects}>
              {evaluating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Evaluate compliance
            </Button>
          </CardContent>
        </Card>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Evaluation unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        {response && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {sortedResults.map((result) => (
                <DecisionCard key={`${result.framework_code}-${result.requirement_key}-${result.framework_version}`} result={result} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Evaluation {response.evaluation_id} · evaluator {response.evaluator_version} · correlation {response.correlation_id}</p>
          </div>
        )}

        <ActionItemsPanel buyerId={buyerId} />
      </div>
    </div>
  );
}
