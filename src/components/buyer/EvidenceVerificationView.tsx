import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, Pencil, ShieldAlert, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import CanonicalEvidenceReviewWorkspace from './CanonicalEvidenceReviewWorkspace';
import { useCanonicalEvidenceFeature } from '@/hooks/useCanonicalEvidenceFeature';
import {
  reviewCardContainerClass,
  reviewPageSubtitleClass,
  reviewPageTitleClass,
} from '@/components/documents/buyerReviewDesignSystem';

interface EvidenceVerificationViewProps {
  buyerId: string;
}

type ClaimStatus = 'extracted' | 'verified' | 'rejected' | 'superseded';

interface EvidenceClaim {
  id: string;
  document_upload_id: string;
  supplier_id: string;
  document_type: string | null;
  status: ClaimStatus;
  issuer: string | null;
  certificate_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  standards: string[];
  covered_products: string[];
  covered_facilities: string[];
  source_page: number | null;
  source_text: string | null;
  confidence: number | null;
  extraction_model_version: string;
  is_duplicate_of: string | null;
  rejected_reason: string | null;
  created_at: string;
}

interface CorrectionEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
}

interface ConflictEntry {
  id: string;
  conflicting_claim_id: string;
  conflict_type: string;
  resolved: boolean;
}

const statusConfig: Record<ClaimStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  extracted: { label: 'Needs review', icon: ClipboardCheck, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  verified: { label: 'Verified', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-red-50 text-red-700 border-red-200' },
  superseded: { label: 'Superseded', icon: XCircle, className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const CORRECTABLE_FIELDS = ['issuer', 'certificate_number', 'issue_date', 'expiry_date', 'source_page'] as const;

// Phase 2 tables and RPCs are intentionally not added to generated types until the migration is approved.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function ClaimDetail({ claim, onActionComplete }: { claim: EvidenceClaim; onActionComplete: () => void }) {
  const [corrections, setCorrections] = useState<CorrectionEntry[]>([]);
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [{ data: correctionRows }, { data: conflictRows }] = await Promise.all([
        db.from('evidence_claim_corrections').select('*').eq('claim_id', claim.id).order('created_at', { ascending: false }),
        db.from('evidence_conflicts').select('*').eq('claim_id', claim.id),
      ]);
      if (!active) return;
      setCorrections(correctionRows || []);
      setConflicts(conflictRows || []);
    };
    void load();
    return () => { active = false; };
  }, [claim.id]);

  const unresolvedConflicts = conflicts.filter((conflict) => !conflict.resolved);

  const runAction = async (fn: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(true);
    setError(null);
    const { error: actionError } = await fn();
    setBusy(false);
    if (actionError) setError(actionError.message);
    else onActionComplete();
  };

  const verify = () => runAction(() => db.rpc('verify_evidence_claim_v1', { p_claim_id: claim.id }));
  const reject = () => {
    if (!rejectReason.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    void runAction(() => db.rpc('reject_evidence_claim_v1', { p_claim_id: claim.id, p_reason: rejectReason }));
  };
  const submitCorrection = () => {
    if (!editingField || !editReason.trim()) {
      setError('A reason is required to record a correction.');
      return;
    }
    void runAction(() => db.rpc('correct_evidence_claim_v1', {
      p_claim_id: claim.id, p_field_name: editingField, p_new_value: editValue, p_reason: editReason,
    })).then(() => { setEditingField(null); setEditValue(''); setEditReason(''); });
  };
  const resolveConflict = (conflictId: string, notes: string) =>
    runAction(() => db.rpc('resolve_evidence_conflict_v1', { p_conflict_id: conflictId, p_resolution_notes: notes }));

  const fields: Array<{ key: typeof CORRECTABLE_FIELDS[number]; label: string; value: string }> = [
    { key: 'issuer', label: 'Issuer', value: claim.issuer || '' },
    { key: 'certificate_number', label: 'Certificate number', value: claim.certificate_number || '' },
    { key: 'issue_date', label: 'Issue date', value: claim.issue_date || '' },
    { key: 'expiry_date', label: 'Expiry date', value: claim.expiry_date || '' },
    { key: 'source_page', label: 'Source page', value: claim.source_page?.toString() || '' },
  ];

  return (
    <div className="space-y-4">
      {claim.is_duplicate_of && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Possible duplicate</AlertTitle>
          <AlertDescription>This claim looks like a duplicate of an existing claim for the same supplier and certificate number.</AlertDescription>
        </Alert>
      )}
      {unresolvedConflicts.length > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Unresolved conflicts</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>This claim conflicts with another verified claim and cannot be verified until resolved.</p>
            {unresolvedConflicts.map((conflict) => (
              <div key={conflict.id} className="flex items-center justify-between gap-2 text-xs">
                <span>{conflict.conflict_type.replace(/_/g, ' ')}</span>
                <Button size="sm" variant="outline" onClick={() => resolveConflict(conflict.id, 'Reviewed by buyer')}>Mark resolved</Button>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              {field.label}
              <button type="button" onClick={() => { setEditingField(field.key); setEditValue(field.value); setEditReason(''); }} aria-label={`Correct ${field.label}`}>
                <Pencil className="h-3 w-3" />
              </button>
            </dt>
            <dd>{field.value || <span className="text-muted-foreground">Not extracted</span>}</dd>
          </div>
        ))}
        <div className="space-y-1"><dt className="text-xs font-medium text-muted-foreground">Standards</dt><dd>{claim.standards.join(', ') || '—'}</dd></div>
        <div className="space-y-1"><dt className="text-xs font-medium text-muted-foreground">Confidence</dt><dd>{claim.confidence != null ? `${Math.round(claim.confidence * 100)}%` : '—'}</dd></div>
      </dl>

      {claim.source_text && (
        <blockquote className="rounded-md border bg-muted/40 p-3 text-sm italic text-muted-foreground">"{claim.source_text}"</blockquote>
      )}

      {editingField && (
        <div className="rounded-[12px] border border-[#E5E7EB] bg-white">
          <div className="border-b border-[#E5E7EB] px-3 py-2"><p className="text-sm font-semibold text-[#111827]">Correct {editingField.replace(/_/g, ' ')}</p></div>
          <div className="space-y-2 p-3">
            <Input className="rounded-[10px] border-[#E5E7EB]" value={editValue} onChange={(event) => setEditValue(event.target.value)} placeholder="New value" />
            <Textarea className="rounded-[10px] border-[#E5E7EB]" value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Reason for this correction" />
            <div className="flex gap-2">
              <Button size="sm" className="rounded-[10px] bg-[#10B981] text-white hover:bg-[#059669]" onClick={submitCorrection} disabled={busy}>Save correction</Button>
              <Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => setEditingField(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {corrections.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Correction history</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {corrections.map((correction) => (
              <li key={correction.id}>{correction.field_name}: "{correction.old_value || '—'}" → "{correction.new_value}" — {correction.reason}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      {claim.status === 'extracted' && (
        <div className="flex flex-wrap items-end gap-2 border-t pt-3">
          <Button size="sm" onClick={verify} disabled={busy || unresolvedConflicts.length > 0}>
            {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Verify
          </Button>
          <Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Rejection reason" className="max-w-xs" />
          <Button size="sm" variant="destructive" onClick={reject} disabled={busy}>Reject</Button>
        </div>
      )}
      {claim.status === 'rejected' && claim.rejected_reason && (
        <p className="text-sm text-muted-foreground">Rejected: {claim.rejected_reason}</p>
      )}
    </div>
  );
}

function LegacyEvidenceVerificationView({ buyerId }: EvidenceVerificationViewProps) {
  const [claims, setClaims] = useState<EvidenceClaim[]>([]);
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | 'all'>('extracted');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await db.from('evidence_claims')
      .select('*').eq('buyer_id', buyerId).order('created_at', { ascending: false });
    if (loadError) setError('Unable to load evidence claims.');
    else setClaims(data || []);
    setLoading(false);
  }, [buyerId]);

  useEffect(() => { void load(); }, [load]);

  const filteredClaims = useMemo(
    () => (statusFilter === 'all' ? claims : claims.filter((claim) => claim.status === statusFilter)),
    [claims, statusFilter],
  );
  const selectedClaim = claims.find((claim) => claim.id === selectedClaimId) || filteredClaims[0] || null;

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto bg-white p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className={reviewPageTitleClass}>Evidence Verification</h1>
          <p className={`mt-1 ${reviewPageSubtitleClass}`}>
            Structured fields extracted from uploaded documents. Nothing here is authoritative until a reviewer verifies it.
          </p>
        </div>

        <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as ClaimStatus | 'all')}>
          <TabsList>
            <TabsTrigger value="extracted">Needs review</TabsTrigger>
            <TabsTrigger value="verified">Verified</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading evidence claims…</p>
        ) : filteredClaims.length === 0 ? (
          <p className="text-sm text-muted-foreground">No evidence claims in this category.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-2">
              {filteredClaims.map((claim) => {
                const config = statusConfig[claim.status];
                const Icon = config.icon;
                return (
                  <button
                    key={claim.id}
                    type="button"
                    onClick={() => setSelectedClaimId(claim.id)}
                    className={`w-full rounded-[12px] border p-3 text-left text-sm transition-colors ${selectedClaim?.id === claim.id ? 'border-[#2563EB] bg-[#EAF1FF]' : 'border-[#E5E7EB] bg-white hover:bg-gray-50/50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#111827]">{claim.document_type || claim.issuer || 'Unknown evidence'}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border-0 px-2 py-0.5 text-[12px] font-medium ${config.className}`}><Icon className="h-3 w-3" />{config.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      {claim.issuer || 'Unknown issuer'} · {claim.certificate_number || 'No certificate number'}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className={reviewCardContainerClass}>
              <div className="border-b border-[#E5E7EB] p-4">
                <p className="text-base font-semibold text-[#111827]">{selectedClaim?.document_type || selectedClaim?.issuer || 'Evidence claim'}</p>
                <p className="mt-1 text-sm text-[#6B7280]">Extraction model {selectedClaim?.extraction_model_version}</p>
              </div>
              <div className="p-4">
                {selectedClaim && <ClaimDetail claim={selectedClaim} onActionComplete={load} />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EvidenceVerificationView({ buyerId }: EvidenceVerificationViewProps) {
  const { enabled, loading } = useCanonicalEvidenceFeature(buyerId, 'buyer');
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading evidence workspace…</div>;
  if (enabled) return <CanonicalEvidenceReviewWorkspace buyerId={buyerId} />;
  return <LegacyEvidenceVerificationView buyerId={buyerId} />;
}
