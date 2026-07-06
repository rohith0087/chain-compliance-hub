/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, FileCheck2, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  QUALIFICATION_BADGE_CONFIG,
  reviewCardContainerClass,
  reviewSectionHeaderClass,
} from '@/components/documents/buyerReviewDesignSystem';

const db = supabase as any;

type PreviewKind = 'image' | 'pdf' | 'office' | 'unsupported';

function getPreviewKind(asset: any): PreviewKind {
  const mime = String(asset?.mime_type || '').toLowerCase();
  const name = String(asset?.original_file_name || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return 'image';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    mime.includes('msword') || mime.includes('officedocument') || mime === 'application/vnd.ms-excel' || mime === 'application/vnd.ms-powerpoint'
    || /\.(docx?|xlsx?|pptx?)$/.test(name)
  ) return 'office';
  return 'unsupported';
}

interface Props { buyerId: string }
interface ReviewItem {
  id: string; request_id: string; evidence_version_id: string; relation: string; qualification: string;
  request?: any; version?: any; record?: any; asset?: any;
}
interface FieldRow { id: string; field_name: string; normalized_value: unknown; raw_value: unknown; source_page: number | null; source_quote: string | null; confidence: number | null }

export default function CanonicalEvidenceReviewWorkspace({ buyerId }: Props) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [validationResults, setValidationResults] = useState<any[]>([]);
  const [attestations, setAttestations] = useState<any[]>([]);
  const [requirementLinks, setRequirementLinks] = useState<any[]>([]);
  const [approvalTask, setApprovalTask] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fourEyes, setFourEyes] = useState(false);
  const [minimumValidityDays, setMinimumValidityDays] = useState(90);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data: links, error: linksError } = await db.from('request_evidence_links')
      .select('id,request_id,evidence_version_id,relation,qualification,document_requests!inner(id,title,document_type,status,fulfillment_status,buyer_id,supplier_id,due_date,request_reason_code,request_reason_notes)')
      .eq('document_requests.buyer_id', buyerId).in('relation', ['candidate','offered','submitted']).order('created_at', { ascending: false });
    if (linksError) { setError('Unable to load the canonical review queue.'); setLoading(false); return; }
    const rows: ReviewItem[] = [];
    for (const link of links || []) {
      const { data: version } = await db.from('evidence_versions')
        .select('*,record:evidence_records(*),asset:document_assets(*)').eq('id', link.evidence_version_id).maybeSingle();
      rows.push({ ...link, request: link.document_requests, version, record: version?.record, asset: version?.asset });
    }
    setItems(rows); setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id || null); setLoading(false);
  }, [buyerId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(()=>{const loadPolicy=async()=>{const {data}=await db.from('evidence_review_policies').select('require_four_eyes,default_minimum_validity_days').eq('buyer_id',buyerId).maybeSingle();if(data){setFourEyes(Boolean(data.require_four_eyes));setMinimumValidityDays(data.default_minimum_validity_days??90);}};void loadPolicy();},[buyerId]);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0] || null, [items, selectedId]);
  const previewKind = useMemo(() => getPreviewKind(selected?.asset), [selected]);
  const missingFields = useMemo(() => {
    const values = validationResults.flatMap((row) => Array.isArray(row.details?.missing_fields) ? row.details.missing_fields : []);
    return [...new Set(values.filter((value): value is string => typeof value === 'string'))].filter((name) => !fields.some((field) => field.field_name === name));
  }, [validationResults, fields]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    const loadDetail = async () => {
      const [{ data: observations }, { data: runs }, { data: attest }, { data: requirements }, { data: tasks }] = await Promise.all([
        db.from('evidence_field_observations').select('*').eq('evidence_version_id', selected.evidence_version_id).order('created_at', { ascending: false }),
        db.from('evidence_validation_runs').select('id,status,completeness,evidence_validation_results(*)').eq('evidence_version_id', selected.evidence_version_id).order('created_at', { ascending: false }),
        db.from('evidence_attestations').select('*').eq('evidence_version_id', selected.evidence_version_id).order('created_at', { ascending: false }),
        db.from('requirement_evidence_links').select('*').eq('evidence_version_id', selected.evidence_version_id).eq('buyer_id', buyerId),
        db.from('compliance_tasks').select('*').eq('buyer_id',buyerId).eq('request_id',selected.request_id).eq('evidence_version_id',selected.evidence_version_id).eq('task_type','approval').in('status',['open','in_progress']).order('created_at',{ascending:false}).limit(1),
      ]);
      if (!active) return;
      const latestByField = new Map<string, FieldRow>();
      (observations || []).forEach((row: FieldRow) => { if (!latestByField.has(row.field_name)) latestByField.set(row.field_name, row); });
      setFields([...latestByField.values()]); setValidationResults(runs?.[0]?.evidence_validation_results || []);
      setAttestations(attest || []); setRequirementLinks(requirements || []); setApprovalTask(tasks?.[0]||null); setEdits({}); setNotes(''); setPreviewUrl(null);
      if (selected.asset?.storage_path) {
        const { data } = await supabase.storage.from(selected.asset.storage_bucket || 'compliance-documents').createSignedUrl(selected.asset.storage_path, 3600);
        if (active) setPreviewUrl(data?.signedUrl || null);
      }
    };
    void loadDetail(); return () => { active = false; };
  }, [selected, buyerId]);

  const submitReview = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const corrections = Object.entries(edits).filter(([, value]) => value.trim() !== '').map(([fieldName, value]) => {
        const field = fields.find((item) => item.field_name === fieldName);
        return { field_name: fieldName, value, normalized_value: value, source_page: field?.source_page || undefined, source_quote: field?.source_quote || undefined };
      });
      const { data, error: reviewError } = await supabase.functions.invoke('review-evidence-v2', {
        body: { request_id: selected.request_id, evidence_version_id: selected.evidence_version_id, corrections, approve: true, notes: notes || null },
      });
      if (reviewError) throw reviewError;
      toast.success(data?.four_eyes_required ? 'Evidence verified and sent for final approval' : 'Evidence verified and submission approved');
      await load();
    } catch (reviewError: any) { toast.error(reviewError.message || 'Review could not be completed'); }
    finally { setBusy(false); }
  };
  const approveVerified = async () => { if(!approvalTask)return;setBusy(true);try{const {error:approvalError}=await db.rpc('approve_verified_evidence_v1',{p_task_id:approvalTask.id,p_notes:notes||null});if(approvalError)throw approvalError;toast.success('Verified evidence approved by the second reviewer');await load();}catch(approvalError:any){toast.error(approvalError.message||'Final approval could not be completed');}finally{setBusy(false);} };
  const savePolicy=async()=>{setBusy(true);const {error:policyError}=await db.rpc('set_evidence_review_policy_v1',{p_buyer_id:buyerId,p_require_four_eyes:fourEyes,p_default_minimum_validity_days:minimumValidityDays,p_document_type_overrides:{}});setBusy(false);if(policyError)toast.error(policyError.message);else toast.success('Evidence review policy updated');};

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading review workspace…</div>;
  return (
    <div className="flex h-[calc(100vh-80px)] flex-col overflow-hidden bg-card p-4">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex flex-shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-bold leading-none text-foreground">Evidence Review</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Verify cited facts and approve their use from one workspace. Verification and buyer acceptance remain separate audit events.</p>
          </div>
          <div className={`min-w-[310px] p-3 ${reviewCardContainerClass}`}>
            <div className="flex items-end gap-3"><div className="flex-1 space-y-1"><Label htmlFor="four-eyes" className={reviewSectionHeaderClass}>Require two reviewers</Label><div className="flex items-center gap-2"><Switch id="four-eyes" checked={fourEyes} onCheckedChange={setFourEyes}/><Input className="w-24" type="number" min={0} max={3650} value={minimumValidityDays} onChange={(event)=>setMinimumValidityDays(Number(event.target.value))}/><span className="text-xs text-muted-foreground">valid days</span></div></div><Button size="sm" variant="outline" className="rounded-[10px]" disabled={busy} onClick={()=>void savePolicy()}>Save policy</Button></div>
          </div>
        </div>
        {error && <Alert variant="destructive" className="flex-shrink-0"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        {!selected ? <div className={`p-8 text-center text-muted-foreground ${reviewCardContainerClass}`}>No evidence is waiting for review.</div> : (
          <div className="grid flex-1 gap-4 overflow-hidden xl:grid-cols-[280px_1fr_360px]">
            <div className="space-y-2 overflow-y-auto pr-1">{items.map((item) => {
              const qualConfig = QUALIFICATION_BADGE_CONFIG[item.qualification] || QUALIFICATION_BADGE_CONFIG.potential;
              const QualIcon = qualConfig.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-[12px] border p-3 text-left transition-colors ${selected.id === item.id ? 'border-[#2563EB] bg-[#EAF1FF]' : 'border-border bg-card hover:bg-muted/50'}`}
                >
                  <p className="font-medium text-foreground">{item.record?.display_name || item.request?.document_type}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.request?.title}</p>
                  <span className={`mt-2 inline-flex items-center gap-1 rounded-full border-0 px-2 py-0.5 text-[12px] font-medium ${qualConfig.className}`}>
                    <QualIcon className="h-3 w-3" />{qualConfig.label}
                  </span>
                </button>
              );
            })}</div>

            <div className="space-y-4 overflow-y-auto pr-1">
              <div className={reviewCardContainerClass}>
                <div className="border-b border-border p-4">
                  <p className="text-base font-semibold text-foreground">{selected.record?.display_name || selected.request?.document_type}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Request: {selected.request?.title} · due {selected.request?.due_date || 'not set'}</p>
                </div>
                <div className="p-4">
                  {!previewUrl ? (
                    <div className="flex h-64 items-center justify-center rounded-[12px] border border-border bg-muted/50 text-sm text-muted-foreground">Preview unavailable</div>
                  ) : previewKind === 'image' ? (
                    <img src={previewUrl} alt="Evidence source document" className="h-[60vh] w-full rounded-[12px] border border-border object-contain bg-muted/50" />
                  ) : previewKind === 'office' ? (
                    <iframe title="Evidence source document" src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`} className="h-[60vh] w-full rounded-[12px] border border-border" />
                  ) : previewKind === 'pdf' ? (
                    <iframe title="Evidence source document" src={previewUrl} className="h-[60vh] w-full rounded-[12px] border border-border" />
                  ) : (
                    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-[12px] border border-border bg-muted/50 text-sm text-muted-foreground">
                      <p>This file type can't be previewed inline.</p>
                      <a href={previewUrl} download className="inline-flex items-center gap-1 text-[#2563EB] hover:underline"><Download className="h-3.5 w-3.5" />Download to view</a>
                    </div>
                  )}
                </div>
              </div>
              {selected.request?.request_reason_code && <Alert><FileCheck2 className="h-4 w-4" /><AlertTitle>Why this was requested again</AlertTitle><AlertDescription>{selected.request.request_reason_code.replace(/_/g,' ')}{selected.request.request_reason_notes ? ` — ${selected.request.request_reason_notes}` : ''}</AlertDescription></Alert>}
            </div>

            <div className="space-y-4 overflow-y-auto pr-1">
              <div className={reviewCardContainerClass}>
                <div className="border-b border-border p-4">
                  <p className="text-base font-semibold text-foreground">Extracted evidence</p>
                  <p className="mt-1 text-sm text-muted-foreground">Every value remains linked to its source page and quote.</p>
                </div>
                <div className="space-y-4 p-4">
                {fields.length === 0 ? <p className="text-sm text-muted-foreground">No structured fields were extracted.</p> : fields.map((field) => {
                  const value = edits[field.field_name] ?? String(field.normalized_value ?? field.raw_value ?? '');
                  return <div key={field.id} className="space-y-1.5"><div className="flex justify-between gap-2"><Label className={reviewSectionHeaderClass}>{field.field_name.replace(/_/g,' ')}</Label>{field.confidence != null && <span className="text-xs text-muted-foreground">{Math.round(field.confidence * 100)}%</span>}</div>
                    <Input className="rounded-[10px] border-border" value={value} onChange={(event) => setEdits((current) => ({ ...current, [field.field_name]: event.target.value }))} />
                    {(field.source_page || field.source_quote) && <p className="text-xs text-muted-foreground">{field.source_page ? `Page ${field.source_page}` : ''}{field.source_quote ? ` — “${field.source_quote}”` : ''}</p>}</div>;
                })}
                {missingFields.map((fieldName) => <div key={fieldName} className="space-y-1.5 rounded-[12px] border border-amber-200 bg-amber-50/50 p-3"><Label>{fieldName.replace(/_/g,' ')} *</Label><Input className="rounded-[10px]" value={edits[fieldName] || ''} onChange={(event) => setEdits((current) => ({...current,[fieldName]:event.target.value}))} placeholder="Required before verification"/><p className="text-xs text-amber-800">This required field was not extracted. Enter it only after checking the source document.</p></div>)}
                </div>
              </div>

              <div className={reviewCardContainerClass}>
                <div className="border-b border-border p-4"><p className="text-base font-semibold text-foreground">Safeguards and impact</p></div>
                <div className="space-y-3 p-4 text-sm">
                <div className="flex items-center justify-between"><span className="text-foreground/80">Validation</span><span className={`rounded-full border-0 px-2 py-0.5 text-[12px] font-medium ${validationResults.some((row) => row.outcome === 'failed') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{validationResults.length ? `${validationResults.length} rule result(s)` : 'No failures'}</span></div>
                <div className="flex items-center justify-between"><span className="text-foreground/80">Existing attestations</span><span className="text-foreground">{attestations.length}</span></div>
                <div className="flex items-center justify-between"><span className="text-foreground/80">Affected requirements</span><span className="text-foreground">{requirementLinks.length}</span></div>
                </div>
              </div>
              <div className="space-y-2"><Label className={reviewSectionHeaderClass}>Reviewer notes</Label><Textarea className="rounded-[10px] border-border" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes for the audit history" /></div>
              <Button
                className="w-full rounded-[10px] bg-[#10B981] text-white hover:bg-[#059669]"
                onClick={() => void (approvalTask ? approveVerified() : submitReview())}
                disabled={busy || validationResults.some((row) => row.outcome === 'failed')}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}{approvalTask?'Approve as second reviewer':'Verify evidence and approve submission'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
