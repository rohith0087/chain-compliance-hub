/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, FileCheck2, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as any;

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
    <div className="h-[calc(100vh-80px)] overflow-y-auto p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Evidence Review</h1><p className="mt-1 text-sm text-muted-foreground">Verify cited facts and approve their use from one workspace. Verification and buyer acceptance remain separate audit events.</p></div><Card className="min-w-[310px]"><CardContent className="flex items-end gap-3 p-4"><div className="flex-1 space-y-1"><Label htmlFor="four-eyes">Require two reviewers</Label><div className="flex items-center gap-2"><Switch id="four-eyes" checked={fourEyes} onCheckedChange={setFourEyes}/><Input className="w-24" type="number" min={0} max={3650} value={minimumValidityDays} onChange={(event)=>setMinimumValidityDays(Number(event.target.value))}/><span className="text-xs text-muted-foreground">valid days</span></div></div><Button size="sm" variant="outline" disabled={busy} onClick={()=>void savePolicy()}>Save policy</Button></CardContent></Card></div>
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        {!selected ? <Card><CardContent className="p-8 text-center text-muted-foreground">No evidence is waiting for review.</CardContent></Card> : (
          <div className="grid gap-4 xl:grid-cols-[280px_1fr_360px]">
            <div className="space-y-2">{items.map((item) => (
              <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-md border p-3 text-left ${selected.id === item.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                <p className="font-medium">{item.record?.display_name || item.request?.document_type}</p><p className="mt-1 text-xs text-muted-foreground">{item.request?.title}</p>
                <Badge variant="outline" className="mt-2">{item.qualification}</Badge>
              </button>
            ))}</div>

            <div className="space-y-4">
              <Card><CardHeader><CardTitle>{selected.record?.display_name || selected.request?.document_type}</CardTitle><CardDescription>Request: {selected.request?.title} · due {selected.request?.due_date || 'not set'}</CardDescription></CardHeader>
                <CardContent>{previewUrl ? <iframe title="Evidence source document" src={previewUrl} className="h-[520px] w-full rounded-md border" /> : <div className="flex h-64 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">Preview unavailable</div>}</CardContent>
              </Card>
              {selected.request?.request_reason_code && <Alert><FileCheck2 className="h-4 w-4" /><AlertTitle>Why this was requested again</AlertTitle><AlertDescription>{selected.request.request_reason_code.replace(/_/g,' ')}{selected.request.request_reason_notes ? ` — ${selected.request.request_reason_notes}` : ''}</AlertDescription></Alert>}
            </div>

            <div className="space-y-4">
              <Card><CardHeader><CardTitle className="text-base">Extracted evidence</CardTitle><CardDescription>Every value remains linked to its source page and quote.</CardDescription></CardHeader><CardContent className="space-y-4">
                {fields.length === 0 ? <p className="text-sm text-muted-foreground">No structured fields were extracted.</p> : fields.map((field) => {
                  const value = edits[field.field_name] ?? String(field.normalized_value ?? field.raw_value ?? '');
                  return <div key={field.id} className="space-y-1.5"><div className="flex justify-between gap-2"><Label>{field.field_name.replace(/_/g,' ')}</Label>{field.confidence != null && <span className="text-xs text-muted-foreground">{Math.round(field.confidence * 100)}%</span>}</div>
                    <Input value={value} onChange={(event) => setEdits((current) => ({ ...current, [field.field_name]: event.target.value }))} />
                    {(field.source_page || field.source_quote) && <p className="text-xs text-muted-foreground">{field.source_page ? `Page ${field.source_page}` : ''}{field.source_quote ? ` — “${field.source_quote}”` : ''}</p>}</div>;
                })}
                {missingFields.map((fieldName) => <div key={fieldName} className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/50 p-3"><Label>{fieldName.replace(/_/g,' ')} *</Label><Input value={edits[fieldName] || ''} onChange={(event) => setEdits((current) => ({...current,[fieldName]:event.target.value}))} placeholder="Required before verification"/><p className="text-xs text-amber-800">This required field was not extracted. Enter it only after checking the source document.</p></div>)}
              </CardContent></Card>

              <Card><CardHeader><CardTitle className="text-base">Safeguards and impact</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span>Validation</span><Badge variant={validationResults.some((row) => row.outcome === 'failed') ? 'destructive' : 'outline'}>{validationResults.length ? `${validationResults.length} rule result(s)` : 'No failures'}</Badge></div>
                <div className="flex items-center justify-between"><span>Existing attestations</span><span>{attestations.length}</span></div>
                <div className="flex items-center justify-between"><span>Affected requirements</span><span>{requirementLinks.length}</span></div>
              </CardContent></Card>
              <div className="space-y-2"><Label>Reviewer notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes for the audit history" /></div>
              <Button className="w-full" onClick={() => void (approvalTask ? approveVerified() : submitReview())} disabled={busy || validationResults.some((row) => row.outcome === 'failed')}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}{approvalTask?'Approve as second reviewer':'Verify evidence and approve submission'}
              </Button>
              {previewUrl && <Button variant="outline" className="w-full" asChild><a href={previewUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open source in new tab</a></Button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
