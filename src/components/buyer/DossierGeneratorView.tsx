import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dossierPdfFileName, renderDossierPdf } from '@/services/DossierPDFService';

interface DossierGeneratorViewProps {
  buyerId: string;
  lockSupplierId?: string;   // workspace scope: fix subject to one supplier, hide pickers
}

type SubjectType = 'supplier' | 'facility' | 'product';

interface SubjectOption {
  id: string;
  label: string;
}

interface DossierStatement {
  decision_result_id: string;
  framework_code: string;
  framework_version: string;
  requirement_key: string;
  title: string;
  outcome: string;
  explanation: string;
  citation: string | null;
  evidence: Array<{ document_type: string | null; issuer: string | null; certificate_number: string | null; expiry_date: string | null; status: string }>;
}

interface DossierContentSnapshot {
  subject_type: SubjectType;
  subject_display_name: string;
  effective_at: string;
  generated_at: string;
  statements: DossierStatement[];
}

interface GenerateDossierResponse {
  dossier_id: string;
  version_id: string;
  version_number: number;
  idempotent_replay: boolean;
  content_hash: string;
  signature: string;
  correlation_id: string;
  content_snapshot: DossierContentSnapshot;
}

interface VerifyResponse {
  content_matches: boolean;
  signature_valid: boolean;
  audit_chain: { valid: boolean; broken_at_row_id: string | null; reason: string | null };
}

interface RegulatoryPack {
  pack_code: string;
  name: string;
  description: string;
}

// Phase 5 tables/RPCs are intentionally not added to generated types until the migration is approved.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DossierGeneratorView({ buyerId, lockSupplierId }: DossierGeneratorViewProps) {
  const [subjectType, setSubjectType] = useState<SubjectType>('supplier');
  const [subjects, setSubjects] = useState<Record<SubjectType, SubjectOption[]>>({ supplier: [], facility: [], product: [] });
  const [subjectId, setSubjectId] = useState(lockSupplierId ?? '');
  const [effectiveAt, setEffectiveAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [savingRetention, setSavingRetention] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateDossierResponse | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [retainUntil, setRetainUntil] = useState('');
  const [legalHold, setLegalHold] = useState(false);
  const [packs, setPacks] = useState<RegulatoryPack[]>([]);
  const [generatingPack, setGeneratingPack] = useState<string | null>(null);
  const [packResult, setPackResult] = useState<{ pack_code: string; validation_status: string; validation_errors: string[] } | null>(null);

  const loadSubjects = useCallback(async () => {
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

    setSubjects({
      supplier: supplierOptions,
      facility: facilities.map((facility) => ({ id: facility.id, label: facility.branch_name })),
      product: products.map((product) => ({ id: product.id, label: product.item_name })),
    });
    setLoadingSubjects(false);
  }, [buyerId]);

  useEffect(() => { void loadSubjects(); }, [loadSubjects]);
  useEffect(() => { if (!lockSupplierId) { setSubjectId(''); setResult(null); setVerifyResult(null); } }, [subjectType, lockSupplierId]);

  useEffect(() => {
    let active = true;
    const loadPacks = async () => {
      const { data } = await db.from('regulatory_packs').select('pack_code, name, description');
      if (active) setPacks(data || []);
    };
    void loadPacks();
    return () => { active = false; };
  }, []);

  const generate = async () => {
    if (!subjectId) {
      setError('Select a subject before generating a dossier.');
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    setVerifyResult(null);

    const correlationId = crypto.randomUUID();
    const { data, error: functionError } = await supabase.functions.invoke('generate-dossier-v1', {
      body: { buyer_id: buyerId, subject_type: subjectType, subject_id: subjectId, effective_at: effectiveAt },
      headers: { 'x-idempotency-key': crypto.randomUUID(), 'x-correlation-id': correlationId },
    });

    if (functionError || !data) setError(functionError?.message || 'Dossier generation failed.');
    else setResult(data as GenerateDossierResponse);
    setGenerating(false);
  };

  const verify = async () => {
    if (!result) return;
    setVerifying(true);
    setError(null);
    const { data, error: functionError } = await supabase.functions.invoke('verify-dossier-signature-v1', {
      body: { dossier_id: result.dossier_id, version_id: result.version_id },
    });
    if (functionError || !data) setError(functionError?.message || 'Signature verification failed.');
    else setVerifyResult(data as VerifyResponse);
    setVerifying(false);
  };

  const download = () => {
    if (!result) return;
    const input = {
      dossierId: result.dossier_id,
      versionNumber: result.version_number,
      contentHash: result.content_hash,
      signature: result.signature,
      contentSnapshot: result.content_snapshot,
    };
    downloadBlob(renderDossierPdf(input), dossierPdfFileName(input));
  };

  const saveRetention = async () => {
    if (!result) return;
    setSavingRetention(true);
    setError(null);
    const { error: rpcError } = await db.rpc('set_dossier_retention_v1', {
      p_dossier_id: result.dossier_id,
      p_retain_until: retainUntil || null,
      p_legal_hold: legalHold,
    });
    if (rpcError) setError(rpcError.message);
    setSavingRetention(false);
  };

  const generatePack = async (packCode: string) => {
    if (!result) return;
    setGeneratingPack(packCode);
    setError(null);
    setPackResult(null);
    const { data, error: functionError } = await supabase.functions.invoke('generate-regulatory-pack-v1', {
      body: { pack_code: packCode, dossier_version_id: result.version_id },
    });
    if (functionError || !data) setError(functionError?.message || 'Regulatory pack generation failed.');
    else setPackResult(data as { pack_code: string; validation_status: string; validation_errors: string[] });
    setGeneratingPack(null);
  };

  const sortedStatements = useMemo(() => result?.content_snapshot.statements || [], [result]);

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /><h1 className="text-2xl font-semibold">Compliance Dossiers</h1></div>

        {!lockSupplierId && (
          <Tabs value={subjectType} onValueChange={(value) => setSubjectType(value as SubjectType)}>
            <TabsList>
              <TabsTrigger value="supplier">Supplier</TabsTrigger>
              <TabsTrigger value="facility">Facility</TabsTrigger>
              <TabsTrigger value="product">Product</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <Card>
          <CardHeader><CardTitle>Generate dossier</CardTitle><CardDescription>{lockSupplierId ? 'Pick an effective date and generate a signed dossier for this supplier.' : 'Select a subject and an effective date.'}</CardDescription></CardHeader>
          <CardContent className={`grid gap-4 ${lockSupplierId ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
            {!lockSupplierId && (
              <Select value={subjectId} onValueChange={setSubjectId} disabled={loadingSubjects}>
                <SelectTrigger><SelectValue placeholder={loadingSubjects ? 'Loading…' : 'Select subject'} /></SelectTrigger>
                <SelectContent>{subjects[subjectType].map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Input type="date" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} />
            <Button onClick={generate} disabled={generating || loadingSubjects}>
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Generate dossier
            </Button>
          </CardContent>
        </Card>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        {result && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Version {result.version_number}{result.idempotent_replay ? ' (replayed)' : ''}</CardTitle>
                <CardDescription className="break-all">SHA-256 {result.content_hash}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={download}><FileText className="mr-1 h-3.5 w-3.5" />Download PDF</Button>
                <Button size="sm" variant="outline" disabled={verifying} onClick={verify}>
                  {verifying && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Verify signature
                </Button>
                {verifyResult && (
                  <Badge variant="outline" className={verifyResult.signature_valid && verifyResult.audit_chain.valid
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}>
                    {verifyResult.signature_valid && verifyResult.audit_chain.valid
                      ? <><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Verified</>
                      : <><XCircle className="mr-1 h-3.5 w-3.5" />Verification failed</>}
                  </Badge>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {sortedStatements.map((statement) => (
                <Card key={`${statement.framework_code}-${statement.requirement_key}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{statement.title}</CardTitle>
                    <CardDescription>{statement.framework_code} · {statement.framework_version} · {statement.outcome.replace(/_/g, ' ')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p>{statement.explanation}</p>
                    {statement.evidence.length > 0 && <p className="text-xs">{statement.evidence.length} evidence item(s)</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle>Retention</CardTitle><CardDescription>Controls apply to the dossier as a whole.</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="space-y-2"><Label>Retain until</Label><Input type="date" value={retainUntil} onChange={(event) => setRetainUntil(event.target.value)} /></div>
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox id="legal-hold" checked={legalHold} onCheckedChange={(checked) => setLegalHold(checked === true)} />
                  <Label htmlFor="legal-hold">Legal hold</Label>
                </div>
                <Button size="sm" variant="outline" disabled={savingRetention} onClick={saveRetention}>Save retention</Button>
              </CardContent>
            </Card>

            {packs.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Regulatory packs</CardTitle><CardDescription>Generate a market-specific submission package from this dossier version.</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {packs.map((pack) => (
                    <div key={pack.pack_code} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span>{pack.name}</span>
                      <Button size="sm" variant="outline" disabled={generatingPack === pack.pack_code} onClick={() => generatePack(pack.pack_code)}>
                        {generatingPack === pack.pack_code && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Generate
                      </Button>
                    </div>
                  ))}
                  {packResult && (
                    <Alert variant={packResult.validation_status === 'valid' ? 'default' : 'destructive'}>
                      <AlertDescription>
                        {packResult.pack_code}: {packResult.validation_status}
                        {packResult.validation_errors.length > 0 && ` — ${packResult.validation_errors.join('; ')}`}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
