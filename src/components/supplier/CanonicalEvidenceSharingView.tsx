/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, FileCheck2, LockKeyhole, RefreshCw, Share2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as any;

export default function CanonicalEvidenceSharingView({ supplierId }: { supplierId: string }) {
  const [versions, setVersions] = useState<any[]>([]); const [buyers, setBuyers] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]); const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [verificationVersion, setVerificationVersion] = useState<any>(null); const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedBuyer, setSelectedBuyer] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [{ data: versionRows }, { data: connections }, { data: grantRows }] = await Promise.all([
      db.from('evidence_versions').select('id,expiry_date,lifecycle_status,document_asset_id,record:evidence_records!inner(id,display_name,canonical_document_type,supplier_id),asset:document_assets(storage_bucket,storage_path),evidence_attestations(attestation_type,outcome,organization_id),evidence_validation_runs(status,completeness,created_at,evidence_validation_results(rule_code,outcome,message,details)),evidence_field_observations(field_name,normalized_value,raw_value,source_page,source_quote,confidence,created_at)').eq('record.supplier_id',supplierId).eq('lifecycle_status','current'),
      db.from('buyer_supplier_connections').select('buyer_id,buyers:buyer_id(id,company_name)').eq('supplier_id',supplierId).eq('status','approved'),
      db.from('evidence_sharing_grants').select('*').eq('owner_organization_id',supplierId).order('granted_at',{ascending:false}),
    ]);
    setVersions(versionRows || []); setBuyers((connections || []).map((row:any) => row.buyers)); setGrants(grantRows || []);
  }, [supplierId]);
  useEffect(() => { void load(); }, [load]);

  const share = async () => {
    if (!selectedVersion || !selectedBuyer) return; setBusy(true);
    const { error } = await db.rpc('grant_canonical_evidence_access_v1',{p_supplier_id:supplierId,p_buyer_id:selectedBuyer,p_evidence_version_id:selectedVersion.id,p_purpose:'compliance_decision'});
    setBusy(false); if (error) toast.error(error.message); else { toast.success('Evidence shared until expiry or revocation'); setSelectedVersion(null); setSelectedBuyer(''); await load(); }
  };
  const revoke = async (grantId:string) => { const { error } = await db.rpc('revoke_evidence_access_v1',{p_grant_id:grantId}); if(error) toast.error(error.message); else {toast.success('Access revoked'); await load();} };
  const openVerification = async (version:any) => { setVerificationVersion(version); setPreviewUrl(null); if(version.asset?.storage_path){const {data}=await supabase.storage.from(version.asset.storage_bucket||'compliance-documents').createSignedUrl(version.asset.storage_path,3600);setPreviewUrl(data?.signedUrl||null);} };
  const verify = async () => { if(!verificationVersion)return;setBusy(true);const {error}=await db.rpc('attest_supplier_evidence_v1',{p_evidence_version_id:verificationVersion.id,p_notes:'Supplier reviewed the source document, extracted fields, and validation results.'});setBusy(false);if(error)toast.error(error.message);else{toast.success('Evidence verified and ready for permissioned reuse');setVerificationVersion(null);await load();} };

  return <div className="h-[calc(100vh-80px)] overflow-y-auto p-6"><div className="mx-auto max-w-6xl space-y-6">
    <div><h1 className="text-2xl font-semibold">Evidence Sharing</h1><p className="mt-1 text-sm text-muted-foreground">Share one verified canonical version with connected buyers. Access ends at expiry or when you revoke it.</p></div>
    <Card><CardHeader><CardTitle>Your canonical evidence</CardTitle><CardDescription>Only current verified versions can be shared.</CardDescription></CardHeader><CardContent className="space-y-3">
      {versions.length===0?<p className="text-sm text-muted-foreground">No canonical evidence versions yet.</p>:versions.map((version)=>{const verified=(version.evidence_attestations||[]).some((a:any)=>a.outcome==='accepted'&&a.attestation_type==='supplier_verification'&&a.organization_id===supplierId);const latestValidation=[...(version.evidence_validation_runs||[])].sort((a:any,b:any)=>String(b.created_at).localeCompare(String(a.created_at)))[0];return <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><p className="font-medium">{version.record?.display_name}</p><p className="text-xs text-muted-foreground">{version.record?.canonical_document_type}{version.expiry_date?` · expires ${new Date(version.expiry_date).toLocaleDateString()}`:''}</p></div><div className="flex items-center gap-2">{verified?<Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 className="mr-1 h-3 w-3"/>Verified</Badge>:<Badge variant="outline">Needs verification</Badge>}{!verified&&<Button size="sm" variant="outline" disabled={latestValidation?.status!=='passed'} onClick={()=>void openVerification(version)}><FileCheck2 className="mr-2 h-4 w-4"/>Review & verify</Button>}<Button size="sm" disabled={!verified} onClick={()=>setSelectedVersion(version)}><Share2 className="mr-2 h-4 w-4"/>Share</Button></div></div>})}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Active and past grants</CardTitle></CardHeader><CardContent className="space-y-2">{grants.length===0?<p className="text-sm text-muted-foreground">No sharing grants yet.</p>:grants.map((grant)=><div key={grant.id} className="flex items-center justify-between rounded-md border p-3 text-sm"><div><p>{buyers.find((b:any)=>b?.id===grant.granted_to_organization_id)?.company_name||'Connected buyer'}</p><p className="text-xs text-muted-foreground">{grant.status}{grant.expires_at?` · until ${new Date(grant.expires_at).toLocaleDateString()}`:''}</p></div>{grant.status==='active'&&<Button size="sm" variant="outline" onClick={()=>void revoke(grant.id)}><XCircle className="mr-2 h-4 w-4"/>Revoke</Button>}</div>)}</CardContent></Card>
    <Dialog open={Boolean(selectedVersion)} onOpenChange={(open)=>!open&&setSelectedVersion(null)}><DialogContent><DialogHeader><DialogTitle>Share verified evidence</DialogTitle><DialogDescription><LockKeyhole className="mr-1 inline h-4 w-4"/>The buyer receives only this evidence version for matching compliance purposes.</DialogDescription></DialogHeader><div className="space-y-2"><Label>Connected buyer</Label><Select value={selectedBuyer} onValueChange={setSelectedBuyer}><SelectTrigger><SelectValue placeholder="Select buyer"/></SelectTrigger><SelectContent>{buyers.filter(Boolean).map((buyer:any)=><SelectItem key={buyer.id} value={buyer.id}>{buyer.company_name}</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button variant="outline" onClick={()=>setSelectedVersion(null)}>Cancel</Button><Button disabled={!selectedBuyer||busy} onClick={()=>void share()}>{busy&&<RefreshCw className="mr-2 h-4 w-4 animate-spin"/>}Share evidence</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(verificationVersion)} onOpenChange={(open)=>!open&&setVerificationVersion(null)}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Verify canonical evidence</DialogTitle><DialogDescription>Compare the extracted facts with the source. This supplier attestation makes the version reusable; it does not approve it for a buyer.</DialogDescription></DialogHeader>{verificationVersion&&<div className="space-y-4">{previewUrl&&<Button variant="outline" asChild><a href={previewUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4"/>Open source document</a></Button>}<div className="rounded-md border">{(verificationVersion.evidence_field_observations||[]).length===0?<p className="p-3 text-sm text-muted-foreground">No structured fields are available.</p>:(verificationVersion.evidence_field_observations||[]).map((field:any)=><div key={field.field_name} className="border-b p-3 last:border-b-0"><p className="text-sm font-medium">{field.field_name.replace(/_/g,' ')}</p><p className="text-sm">{String(field.normalized_value??field.raw_value??'')}</p>{(field.source_page||field.source_quote)&&<p className="mt-1 text-xs text-muted-foreground">{field.source_page?`Page ${field.source_page}`:''}{field.source_quote?` — “${field.source_quote}”`:''}</p>}</div>)}</div></div>}<DialogFooter><Button variant="outline" onClick={()=>setVerificationVersion(null)}>Cancel</Button><Button disabled={busy} onClick={()=>void verify()}>{busy&&<RefreshCw className="mr-2 h-4 w-4 animate-spin"/>}Verify evidence</Button></DialogFooter></DialogContent></Dialog>
  </div></div>;
}
