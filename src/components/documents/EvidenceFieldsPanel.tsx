/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { reviewSectionHeaderClass } from './buyerReviewDesignSystem';

const db = supabase as any;

interface FieldRow { id: string; field_name: string; normalized_value: unknown; raw_value: unknown; source_page: number | null; source_quote: string | null; confidence: number | null }
interface ValidationResultRow { rule_code: string; outcome: string; severity: string; message: string; details: any }
interface AttestationRow { id: string; attestation_type: string; outcome: string; actor_id: string | null; notes: string | null; created_at: string }

interface EvidenceFieldsPanelProps {
  documentId?: string;
  onVisibilityChange?: (visible: boolean) => void;
}

const ATTESTATION_LABEL: Record<string, string> = {
  system_validation: 'Auto-Verified',
  buyer_verification: 'Verified',
  buyer_acceptance: 'Approved',
  supplier_verification: 'Verified by supplier',
  rejection: 'Rejected',
};

function confidenceClass(confidence: number | null): string {
  if (confidence == null) return 'bg-muted text-muted-foreground border-border';
  if (confidence >= 0.9) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (confidence >= 0.7) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

export default function EvidenceFieldsPanel({ documentId, onVisibilityChange }: EvidenceFieldsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<{ id: string; evidence_version_id: string } | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResultRow[]>([]);
  const [attestations, setAttestations] = useState<AttestationRow[]>([]);
  const [approvalTask, setApprovalTask] = useState<{ id: string } | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!documentId) { setLoading(false); onVisibilityChange?.(false); return; }
    setLoading(true);
    const { data: linkRow } = await db.from('request_evidence_links')
      .select('id,evidence_version_id')
      .eq('request_id', documentId)
      .in('relation', ['candidate', 'offered', 'submitted', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!linkRow) {
      const { data: recentUpload } = await db.from('document_uploads')
        .select('id,created_at')
        .eq('request_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const recentlyUploaded = recentUpload && Date.now() - new Date(recentUpload.created_at).getTime() < 2 * 60 * 1000;
      setPending(Boolean(recentlyUploaded));
      setLink(null);
      setLoading(false);
      onVisibilityChange?.(Boolean(recentlyUploaded));
      return;
    }

    setLink(linkRow);
    setPending(false);
    const [{ data: observations }, { data: runs }, { data: attest }, { data: tasks }] = await Promise.all([
      db.from('evidence_field_observations').select('*').eq('evidence_version_id', linkRow.evidence_version_id).order('created_at', { ascending: false }),
      db.from('evidence_validation_runs').select('id,status,evidence_validation_results(*)').eq('evidence_version_id', linkRow.evidence_version_id).order('created_at', { ascending: false }).limit(1),
      db.from('evidence_attestations').select('*').eq('evidence_version_id', linkRow.evidence_version_id).order('created_at', { ascending: false }),
      db.from('compliance_tasks').select('id').eq('request_id', documentId).eq('evidence_version_id', linkRow.evidence_version_id).eq('task_type', 'approval').in('status', ['open', 'in_progress']).order('created_at', { ascending: false }).limit(1),
    ]);
    const latestByField = new Map<string, FieldRow>();
    (observations || []).forEach((row: FieldRow) => { if (!latestByField.has(row.field_name)) latestByField.set(row.field_name, row); });
    setFields([...latestByField.values()]);
    setValidationResults(runs?.[0]?.evidence_validation_results || []);
    setAttestations(attest || []);
    setApprovalTask(tasks?.[0] || null);
    setEdits({});
    setLoading(false);
    onVisibilityChange?.(true);
  }, [documentId, onVisibilityChange]);

  useEffect(() => { void load(); }, [load]);

  const missingFields = useMemo(() => {
    const values = validationResults.flatMap((row) => Array.isArray(row.details?.missing_fields) ? row.details.missing_fields : []);
    return [...new Set(values.filter((value): value is string => typeof value === 'string'))].filter((name) => !fields.some((field) => field.field_name === name));
  }, [validationResults, fields]);

  const latestAttestation = attestations[0] || null;
  const hasValidationFailure = validationResults.some((row) => row.outcome === 'failed' || row.outcome === 'needs_review');

  const submitReview = async () => {
    if (!link) return;
    setBusy(true);
    try {
      const corrections = Object.entries(edits).filter(([, value]) => value.trim() !== '').map(([fieldName, value]) => {
        const field = fields.find((item) => item.field_name === fieldName);
        return { field_name: fieldName, value, normalized_value: value, source_page: field?.source_page || undefined, source_quote: field?.source_quote || undefined };
      });
      const { data, error } = await supabase.functions.invoke('review-evidence-v2', {
        body: { request_id: documentId, evidence_version_id: link.evidence_version_id, corrections, approve: true, notes: null },
      });
      if (error) throw error;
      toast.success(data?.four_eyes_required ? 'Evidence verified and sent for final approval' : 'Evidence verified and submission approved');
      await load();
    } catch (error: any) { toast.error(error.message || 'Review could not be completed'); }
    finally { setBusy(false); }
  };

  const approveAsSecondReviewer = async () => {
    if (!approvalTask) return;
    setBusy(true);
    try {
      const { error } = await db.rpc('approve_verified_evidence_v1', { p_task_id: approvalTask.id, p_notes: null });
      if (error) throw error;
      toast.success('Verified evidence approved by the second reviewer');
      await load();
    } catch (error: any) { toast.error(error.message || 'Final approval could not be completed'); }
    finally { setBusy(false); }
  };

  if (loading) {
    return (
      <div className="flex w-[360px] flex-shrink-0 items-center justify-center border-l border-border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!link) {
    if (!pending) return null;
    return (
      <div className="w-[360px] flex-shrink-0 overflow-y-auto border-l border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Extraction in progress…</p>
      </div>
    );
  }

  return (
    <div className="w-[360px] flex-shrink-0 overflow-y-auto border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Sparkles className="h-4 w-4 text-violet-600" />
        <p className="text-[15px] font-bold text-foreground">Extracted Evidence</p>
      </div>
      <div className="space-y-4 p-4">
        {latestAttestation ? (
          <div className="rounded-[10px] border border-border bg-muted/50 p-3">
            <p className="text-sm font-semibold text-foreground">{ATTESTATION_LABEL[latestAttestation.attestation_type] || latestAttestation.attestation_type}</p>
            {latestAttestation.notes && <p className="mt-1 text-xs text-muted-foreground">{latestAttestation.notes}</p>}
          </div>
        ) : null}

        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No structured fields were extracted.</p>
        ) : (
          fields.map((field) => {
            const value = edits[field.field_name] ?? String(field.normalized_value ?? field.raw_value ?? '');
            return (
              <div key={field.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className={reviewSectionHeaderClass}>{field.field_name.replace(/_/g, ' ')}</Label>
                  {field.confidence != null && (
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${confidenceClass(field.confidence)}`}>
                      {Math.round(field.confidence * 100)}%
                    </span>
                  )}
                </div>
                {latestAttestation ? (
                  <p className="text-sm text-foreground/80">{value || '—'}</p>
                ) : (
                  <Input
                    className="h-9 rounded-[10px] border-border text-sm"
                    value={value}
                    onChange={(event) => setEdits((current) => ({ ...current, [field.field_name]: event.target.value }))}
                  />
                )}
                {(field.source_page || field.source_quote) && (
                  <p className="text-xs text-muted-foreground">{field.source_page ? `Page ${field.source_page}` : ''}{field.source_quote ? ` — "${field.source_quote}"` : ''}</p>
                )}
              </div>
            );
          })
        )}

        {!latestAttestation && missingFields.map((fieldName) => (
          <div key={fieldName} className="space-y-1.5 rounded-[10px] border border-amber-200 bg-amber-50/50 p-3">
            <Label className="text-sm">{fieldName.replace(/_/g, ' ')} *</Label>
            <Input
              className="h-9 rounded-[10px] text-sm"
              value={edits[fieldName] || ''}
              onChange={(event) => setEdits((current) => ({ ...current, [fieldName]: event.target.value }))}
              placeholder="Required before verification"
            />
            <p className="text-xs text-amber-800">This required field was not extracted. Enter it only after checking the source document.</p>
          </div>
        ))}

        {!latestAttestation && hasValidationFailure && (
          <div className="flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50/50 p-3 text-xs text-red-700">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{validationResults.find((row) => row.outcome === 'failed' || row.outcome === 'needs_review')?.message || 'Validation issues need correction before this can be verified.'}</span>
          </div>
        )}

        {!latestAttestation && (
          <Button
            className="w-full rounded-[10px] bg-[#10B981] text-white hover:bg-[#059669]"
            onClick={() => void (approvalTask ? approveAsSecondReviewer() : submitReview())}
            disabled={busy}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {approvalTask ? 'Approve as second reviewer' : 'Verify evidence and approve'}
          </Button>
        )}
      </div>
    </div>
  );
}
