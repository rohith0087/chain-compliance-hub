import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Share2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  OUTCOME_BADGE_CONFIG,
  reviewCardContainerClass,
  reviewPageSubtitleClass,
  reviewPageTitleClass,
  reviewSectionHeaderClass,
} from '@/components/documents/buyerReviewDesignSystem';

interface ComplianceDecisionsViewProps {
  buyerId: string;
  lockSupplierId?: string;   // workspace scope: fix subject to one supplier, hide pickers
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

const outcomeSeverity: Record<ComplianceOutcome, number> = {
  noncompliant: 0, expired: 1, missing: 2, requested: 3, submitted: 4,
  under_review: 5, conditional: 6, compliant: 7, not_applicable: 8,
};

// Phase 3 tables are intentionally not added to generated types until the migration is approved.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// evaluate-compliance-v1 appends this exact sentence to a decision result's
// persisted explanation whenever it relied on a claim shared by the
// supplier (via an evidence_sharing_grants grant) rather than evidence the
// buyer originated directly -- matching it here avoids a separate response
// field that wouldn't survive into compliance_current_status reads later.
const SHARED_EVIDENCE_MARKER = 'evidence shared by the supplier under an active sharing grant';

function DecisionCard({ result }: { result: DecisionResult }) {
  const config = OUTCOME_BADGE_CONFIG[result.outcome];
  const Icon = config.icon;
  const includesSharedEvidence = result.explanation.includes(SHARED_EVIDENCE_MARKER);
  return (
    <div className={reviewCardContainerClass}>
      <div className="space-y-2 border-b border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">{result.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{result.framework_code} · {result.framework_version}</p>
          </div>
          <div className="flex items-center gap-2">
            {includesSharedEvidence && (
              <span className="inline-flex items-center gap-1 rounded-full border-0 bg-violet-50 px-2 py-0.5 text-[12px] font-medium text-violet-800">
                <Share2 className="h-3.5 w-3.5" />Shared by supplier
              </span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full border-0 px-2 py-0.5 text-[12px] font-medium ${config.className}`}>
              <Icon className="h-3.5 w-3.5" />{config.label}
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-2 p-4 text-sm">
        <p className="text-muted-foreground">{result.explanation}</p>
        {result.evidence_claim_ids.length > 0 && (
          <p className="text-xs text-muted-foreground">{result.evidence_claim_ids.length} evidence claim(s) considered</p>
        )}
      </div>
    </div>
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
    <div className={reviewCardContainerClass}>
      <div className="border-b border-border p-4">
        <p className="text-base font-semibold text-foreground">Action items</p>
        <p className="mt-1 text-sm text-muted-foreground">Open tasks, findings, and approvals for this organization.</p>
      </div>
      <div className="space-y-4 p-4">
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        <div>
          <p className={`mb-2 ${reviewSectionHeaderClass}`}>Tasks ({tasks.length})</p>
          {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No open tasks.</p> : (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-[12px] border border-border p-3 text-sm">
                  <span className="text-foreground">{task.title} <span className="text-xs text-muted-foreground">({task.task_type}{task.due_date ? `, due ${task.due_date}` : ''})</span></span>
                  <Button size="sm" variant="outline" className="rounded-[10px] border-border" disabled={busyId === task.id}
                    onClick={() => runAction(task.id, () => db.rpc('complete_compliance_task_v1', { p_task_id: task.id }))}>
                    Complete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className={`mb-2 ${reviewSectionHeaderClass}`}>Findings ({findings.length})</p>
          {findings.length === 0 ? <p className="text-sm text-muted-foreground">No open findings.</p> : (
            <ul className="space-y-2">
              {findings.map((finding) => (
                <li key={finding.id} className="flex items-center justify-between gap-2 rounded-[12px] border border-border p-3 text-sm">
                  <span className="text-foreground">{finding.description} <span className="ml-1 inline-flex items-center rounded-full border-0 bg-muted px-2 py-0.5 text-[12px] font-medium text-muted-foreground">{finding.severity}</span></span>
                  <Button size="sm" variant="outline" className="rounded-[10px] border-border" disabled={busyId === finding.id}
                    onClick={() => runAction(finding.id, () => db.rpc('resolve_compliance_finding_v1', { p_finding_id: finding.id }))}>
                    Resolve
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className={`mb-2 ${reviewSectionHeaderClass}`}>Pending approvals ({approvals.length})</p>
          {approvals.length === 0 ? <p className="text-sm text-muted-foreground">No pending approvals.</p> : (
            <ul className="space-y-2">
              {approvals.map((approval) => (
                <li key={approval.id} className="flex items-center justify-between gap-2 rounded-[12px] border border-border p-3 text-sm">
                  <span className="text-foreground">{approval.approval_type.replace(/_/g, ' ')} requested {new Date(approval.requested_at).toLocaleDateString()}</span>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="rounded-[10px] bg-[#10B981] text-white hover:bg-[#059669]" disabled={busyId === approval.id}
                      onClick={() => runAction(approval.id, () => db.rpc('decide_compliance_approval_v1', { p_approval_id: approval.id, p_decision: 'approved', p_notes: null }))}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-[10px] border-[#FCA5A5] bg-card text-[#DC2626] hover:bg-[#FEF2F2]" disabled={busyId === approval.id}
                      onClick={() => runAction(approval.id, () => db.rpc('decide_compliance_approval_v1', { p_approval_id: approval.id, p_decision: 'rejected', p_notes: null }))}>
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ComplianceDecisionsView({ buyerId, lockSupplierId }: ComplianceDecisionsViewProps) {
  const [subjectType, setSubjectType] = useState<SubjectType>('supplier');
  const [subjects, setSubjects] = useState<Record<SubjectType, SubjectOption[]>>({ supplier: [], facility: [], product: [] });
  const [subjectId, setSubjectId] = useState(lockSupplierId ?? '');
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

  useEffect(() => { if (!lockSupplierId) { setSubjectId(''); setResponse(null); } }, [subjectType, lockSupplierId]);

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
    <div className="h-[calc(100vh-80px)] overflow-y-auto bg-card p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /><h1 className={reviewPageTitleClass}>Compliance Decisions</h1></div>
          <p className={`mt-1 ${reviewPageSubtitleClass}`}>Computed compliance status, derived from verified evidence and requirement applicability - not a manually selected document status.</p>
        </div>

        {!lockSupplierId && (
          <Tabs value={subjectType} onValueChange={(value) => setSubjectType(value as SubjectType)}>
            <TabsList>
              <TabsTrigger value="supplier">Supplier</TabsTrigger>
              <TabsTrigger value="facility">Facility</TabsTrigger>
              <TabsTrigger value="product">Product</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className={reviewCardContainerClass}>
          <div className="border-b border-border p-4">
            <p className="text-base font-semibold text-foreground">Evaluate compliance</p>
            <p className="mt-1 text-sm text-muted-foreground">{lockSupplierId ? 'Pick an evaluation date and compute this supplier’s status.' : 'Select a subject and an evaluation date.'}</p>
          </div>
          <div className={`grid gap-4 p-4 ${lockSupplierId ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
            {!lockSupplierId && (
              <div className="space-y-2">
                <Select value={subjectId} onValueChange={setSubjectId} disabled={loadingSubjects}>
                  <SelectTrigger className="rounded-[10px] border-border"><SelectValue placeholder={loadingSubjects ? 'Loading…' : 'Select subject'} /></SelectTrigger>
                  <SelectContent>{subjects[subjectType].map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Input className="rounded-[10px] border-border" type="date" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} />
            <Button className="rounded-[10px] bg-[#10B981] text-white hover:bg-[#059669]" onClick={evaluate} disabled={evaluating || loadingSubjects}>
              {evaluating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Evaluate compliance
            </Button>
          </div>
        </div>

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
