import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, FileQuestion, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  RequirementEvaluationResponseV1,
  RequirementEvaluationResultV1,
  SubjectType,
} from '@/features/requirements/contracts';

interface RequirementEngineViewProps {
  buyerId: string;
  onNavigateToDocuments: (documentType?: string) => void;
}

interface SubjectOption {
  id: string;
  label: string;
  supplierId: string;
}

type BooleanChoice = 'unknown' | 'yes' | 'no';

const outcomeConfig = {
  applies: { label: 'Applies', icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  does_not_apply: { label: 'Does not apply', icon: XCircle, className: 'border-slate-200 bg-slate-50 text-slate-700' },
  indeterminate: { label: 'Needs information', icon: FileQuestion, className: 'border-amber-200 bg-amber-50 text-amber-800' },
} as const;

function toBoolean(value: BooleanChoice): boolean | undefined {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return undefined;
}

function RequirementCard({ result, onNavigateToDocuments }: {
  result: RequirementEvaluationResultV1;
  onNavigateToDocuments: (documentType?: string) => void;
}) {
  const config = outcomeConfig[result.outcome];
  const Icon = config.icon;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{result.title}</CardTitle>
            <CardDescription>{result.framework_code} · {result.framework_version}</CardDescription>
            <CardDescription>Effective {result.effective_from || 'legacy/live'}{result.effective_to ? ` through ${result.effective_to}` : ''}</CardDescription>
          </div>
          <Badge variant="outline" className={config.className}>
            <Icon className="mr-1 h-3.5 w-3.5" />{config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">{result.explanation}</p>
        {result.missing_inputs.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
            Missing inputs: {result.missing_inputs.join(', ')}
          </div>
        )}
        {Object.keys(result.matched_facts).length > 0 && (
          <div>
            <p className="mb-1 font-medium">Matched inputs</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {Object.entries(result.matched_facts).map(([key, value]) => (
                <div key={key} className="contents"><dt>{key}</dt><dd>{String(value)}</dd></div>
              ))}
            </dl>
          </div>
        )}
        {result.required_evidence.length > 0 && (
          <div>
            <p className="mb-2 font-medium">Required evidence</p>
            <div className="flex flex-wrap gap-2">
              {result.required_evidence.map((evidence) => (
                <Button key={`${evidence.document_type}-${evidence.name}`} variant="outline" size="sm" onClick={() => onNavigateToDocuments(evidence.document_type)}>
                  {evidence.name}
                </Button>
              ))}
            </div>
          </div>
        )}
        {(result.citation || result.source_url) && (
          <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
            {result.citation && <span>{result.citation}</span>}
            {result.source_url && (
              <a href={result.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center text-primary hover:underline">
                Official source <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RequirementEngineView({ buyerId, onNavigateToDocuments }: RequirementEngineViewProps) {
  const [subjectType, setSubjectType] = useState<SubjectType>('supplier');
  const [subjects, setSubjects] = useState<Record<SubjectType, SubjectOption[]>>({ supplier: [], facility: [], product: [] });
  const [subjectId, setSubjectId] = useState('');
  const [effectiveAt, setEffectiveAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [destinationCountry, setDestinationCountry] = useState('US');
  const [isChildrenProduct, setIsChildrenProduct] = useState<BooleanChoice>('unknown');
  const [intendedUserAgeMax, setIntendedUserAgeMax] = useState('');
  const [isCpscProduct, setIsCpscProduct] = useState<BooleanChoice>('unknown');
  const [isSubjectToRule, setIsSubjectToRule] = useState<BooleanChoice>('unknown');
  const [applicableRuleIds, setApplicableRuleIds] = useState('');
  const [importStatus, setImportStatus] = useState<'unknown' | 'domestic' | 'imported'>('unknown');
  const [entryMode, setEntryMode] = useState<'unknown' | 'general' | 'foreign_trade_zone'>('unknown');
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<RequirementEvaluationResponseV1 | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingSubjects(true);
      const { data: connections, error: connectionError } = await supabase
        .from('buyer_supplier_connections')
        .select('supplier_id, suppliers(id, company_name)')
        .eq('buyer_id', buyerId)
        .eq('status', 'approved');
      if (connectionError) {
        if (active) {
          setError('Unable to load connected suppliers.');
          setLoadingSubjects(false);
        }
        return;
      }

      const supplierIds = (connections || []).map((connection) => connection.supplier_id).filter(Boolean);
      const supplierOptions = (connections || []).flatMap((connection) => {
        const supplier = connection.suppliers as unknown as { id: string; company_name: string } | null;
        return supplier ? [{ id: supplier.id, label: supplier.company_name, supplierId: supplier.id }] : [];
      });

      let facilities: Array<{ id: string; branch_name: string; company_id: string }> = [];
      let products: Array<{ id: string; item_name: string; supplier_id: string }> = [];
      if (supplierIds.length > 0) {
        const [facilityResult, productResult] = await Promise.all([
          supabase.from('company_branches').select('id, branch_name, company_id')
            .in('company_id', supplierIds).eq('company_type', 'supplier').eq('status', 'active'),
          supabase.from('supplier_items').select('id, item_name, supplier_id')
            .in('supplier_id', supplierIds).eq('is_active', true),
        ]);
        if (facilityResult.error || productResult.error) {
          if (active) {
            setError('Unable to load supplier facilities and products.');
            setLoadingSubjects(false);
          }
          return;
        }
        facilities = facilityResult.data || [];
        products = productResult.data || [];
      }

      if (!active) return;
      setSubjects({
        supplier: supplierOptions,
        facility: facilities.map((facility) => ({ id: facility.id, label: facility.branch_name, supplierId: facility.company_id })),
        product: products.map((product) => ({ id: product.id, label: product.item_name, supplierId: product.supplier_id })),
      });
      setLoadingSubjects(false);
    };
    void load();
    return () => { active = false; };
  }, [buyerId]);

  useEffect(() => {
    setSubjectId('');
    setResponse(null);
  }, [subjectType]);

  const groupedResults = useMemo(() => ({
    applies: response?.results.filter((result) => result.outcome === 'applies') || [],
    indeterminate: response?.results.filter((result) => result.outcome === 'indeterminate') || [],
    does_not_apply: response?.results.filter((result) => result.outcome === 'does_not_apply') || [],
  }), [response]);

  const evaluate = async () => {
    if (!subjectId) {
      setError('Select a subject before evaluating requirements.');
      return;
    }
    setEvaluating(true);
    setError(null);
    setResponse(null);

    const facts = Object.fromEntries(Object.entries({
      destination_country: destinationCountry || undefined,
      is_children_product: toBoolean(isChildrenProduct),
      intended_user_age_max: intendedUserAgeMax === '' ? undefined : Number(intendedUserAgeMax),
      consumer_product_under_cpsc: toBoolean(isCpscProduct),
      subject_to_cpsc_rule: toBoolean(isSubjectToRule),
      applicable_rule_ids: applicableRuleIds.trim()
        ? applicableRuleIds.split(',').map((value) => value.trim()).filter(Boolean)
        : undefined,
      domestic_import_status: importStatus === 'unknown' ? undefined : importStatus,
      import_entry_mode: entryMode === 'unknown' ? undefined : entryMode,
    }).filter(([, value]) => value !== undefined));

    const correlationId = crypto.randomUUID();
    const { data, error: functionError } = await supabase.functions.invoke('evaluate-requirements-v1', {
      body: { buyer_id: buyerId, subject_type: subjectType, subject_id: subjectId, effective_at: effectiveAt, facts },
      headers: { 'x-idempotency-key': crypto.randomUUID(), 'x-correlation-id': correlationId },
    });

    if (functionError || !data) setError(functionError?.message || 'Requirement evaluation failed.');
    else setResponse(data as RequirementEvaluationResponseV1);
    setEvaluating(false);
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /><h1 className="text-2xl font-semibold">Requirement Engine</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">Deterministic, versioned applicability results. Draft regulatory content is excluded until human review and publication.</p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Development preview</AlertTitle>
          <AlertDescription>Existing onboarding and document-request workflows remain authoritative. This view does not create or change requests.</AlertDescription>
        </Alert>

        <Card>
          <CardHeader><CardTitle>Evaluate applicability</CardTitle><CardDescription>Select a supplier, facility, or product and provide authoritative facts.</CardDescription></CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2"><Label>Subject type</Label><Select value={subjectType} onValueChange={(value) => setSubjectType(value as SubjectType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="supplier">Supplier</SelectItem><SelectItem value="facility">Facility</SelectItem><SelectItem value="product">Product</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Subject</Label><Select value={subjectId} onValueChange={setSubjectId} disabled={loadingSubjects}><SelectTrigger><SelectValue placeholder={loadingSubjects ? 'Loading…' : 'Select subject'} /></SelectTrigger><SelectContent>{subjects[subjectType].map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Evaluation date</Label><Input type="date" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} /></div>
            <div className="space-y-2"><Label>Destination country</Label><Input value={destinationCountry} maxLength={2} onChange={(event) => setDestinationCountry(event.target.value.toUpperCase())} /></div>
            <div className="space-y-2"><Label>Children's product classification</Label><Select value={isChildrenProduct} onValueChange={(value) => setIsChildrenProduct(value as BooleanChoice)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Unknown</SelectItem><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Maximum intended user age</Label><Input type="number" min={0} max={120} value={intendedUserAgeMax} onChange={(event) => setIntendedUserAgeMax(event.target.value)} placeholder="Unknown" /></div>
            <div className="space-y-2"><Label>Consumer product under CPSC</Label><Select value={isCpscProduct} onValueChange={(value) => setIsCpscProduct(value as BooleanChoice)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Unknown</SelectItem><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Subject to a CPSC rule</Label><Select value={isSubjectToRule} onValueChange={(value) => setIsSubjectToRule(value as BooleanChoice)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Unknown</SelectItem><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Applicable rule identifiers</Label><Input value={applicableRuleIds} onChange={(event) => setApplicableRuleIds(event.target.value)} placeholder="16 CFR 1110, comma-separated" /></div>
            <div className="space-y-2"><Label>Domestic or imported</Label><Select value={importStatus} onValueChange={(value) => setImportStatus(value as typeof importStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Unknown</SelectItem><SelectItem value="domestic">Domestic</SelectItem><SelectItem value="imported">Imported</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Import entry mode</Label><Select value={entryMode} onValueChange={(value) => setEntryMode(value as typeof entryMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Unknown</SelectItem><SelectItem value="general">General entry</SelectItem><SelectItem value="foreign_trade_zone">Foreign Trade Zone</SelectItem></SelectContent></Select></div>
            <div className="flex items-end"><Button className="w-full" onClick={evaluate} disabled={evaluating || loadingSubjects}>{evaluating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Evaluate requirements</Button></div>
          </CardContent>
        </Card>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Evaluation unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        {response && (
          <div className="space-y-8">
            {(['applies', 'indeterminate', 'does_not_apply'] as const).map((outcome) => (
              <section key={outcome} className="space-y-3">
                <h2 className="text-lg font-semibold">{outcomeConfig[outcome].label} ({groupedResults[outcome].length})</h2>
                {groupedResults[outcome].length === 0
                  ? <p className="text-sm text-muted-foreground">No requirements in this category.</p>
                  : <div className="grid gap-4 lg:grid-cols-2">{groupedResults[outcome].map((result) => <RequirementCard key={`${result.framework_code}-${result.requirement_key}-${result.framework_version}`} result={result} onNavigateToDocuments={onNavigateToDocuments} />)}</div>}
              </section>
            ))}
            <p className="text-xs text-muted-foreground">Evaluation {response.evaluation_id} · evaluator {response.evaluator_version} · correlation {response.correlation_id}</p>
          </div>
        )}
      </div>
    </div>
  );
}
