import { AlertTriangle, CheckCircle2, Clock3, FileSearch, Lock, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export type ReuseChoice = 'use_existing' | 'ask_supplier' | 'request_new' | 'cancel_duplicate' | 'create';

export interface RequestPreflightResult {
  client_key: string;
  supplier_id: string;
  document_type: string;
  match: {
    evidence_version_id?: string | null;
    qualification: 'eligible' | 'potential' | 'ineligible';
    visibility: 'full' | 'availability_only' | 'none';
    reasons: string[];
    expires_on?: string | null;
    score?: number | null;
  };
}

export interface RequestReuseResolution {
  choice: ReuseChoice;
  reasonCode?: string;
  reasonNotes?: string;
}

interface Props {
  results: RequestPreflightResult[];
  suppliers: Array<{ id: string; company_name: string }>;
  resolutions: Record<string, RequestReuseResolution>;
  onResolutionChange: (clientKey: string, value: RequestReuseResolution) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
}

const REASONS = [
  ['renewal_required', 'Renewal required'], ['expires_soon', 'Existing evidence expires soon'],
  ['incorrect_information', 'Incorrect information'], ['different_product', 'Different product'],
  ['different_facility', 'Different facility'], ['different_jurisdiction', 'Different jurisdiction'],
  ['independent_verification', 'Independent verification required'], ['regulatory_period_changed', 'Regulatory period changed'],
  ['suspected_change', 'Suspected document change'], ['other', 'Other'],
] as const;

const reasonLabel = (reason: string) => reason.replace(/_/g, ' ');

export default function RequestReusePreflightStep({ results, suppliers, resolutions, onResolutionChange, onBack, onSubmit, loading }: Props) {
  const invalid = results.some((result) => resolutions[result.client_key]?.choice === 'request_new' && !resolutions[result.client_key]?.reasonCode);
  return (
    <div className="space-y-5">
      <Alert>
        <FileSearch className="h-4 w-4" />
        <AlertTitle>Existing evidence check</AlertTitle>
        <AlertDescription>
          We checked each supplier and document before sending. Nothing is reused automatically; review each recommendation below.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {results.map((result) => {
          const supplier = suppliers.find((item) => item.id === result.supplier_id);
          const resolution = resolutions[result.client_key] || { choice: 'create' as const };
          const match = result.match;
          const noMatch = match.reasons?.includes('no_match');
          return (
            <Card key={result.client_key}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{result.document_type}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{supplier?.company_name || 'Supplier'}</p>
                  </div>
                  {noMatch ? <Badge variant="outline"><FileSearch className="mr-1 h-3 w-3" />No match</Badge>
                    : match.qualification === 'eligible' ? <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 className="mr-1 h-3 w-3" />Eligible</Badge>
                    : match.qualification === 'potential' ? <Badge className="bg-amber-100 text-amber-800"><Clock3 className="mr-1 h-3 w-3" />Needs supplier action</Badge>
                    : <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />New version needed</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!noMatch && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    {match.visibility === 'availability_only' && <p className="mb-2 flex items-center gap-2"><Lock className="h-4 w-4" />A possible match exists. Details remain private until the supplier shares it.</p>}
                    {match.expires_on && <p>Expires {new Date(match.expires_on).toLocaleDateString()}</p>}
                    <p className="mt-1 text-muted-foreground">{(match.reasons || []).map(reasonLabel).join(' · ') || 'All reuse checks passed'}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>How should this request be handled?</Label>
                  <Select value={resolution.choice} onValueChange={(choice: ReuseChoice) => onResolutionChange(result.client_key, { ...resolution, choice })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {match.qualification === 'eligible' && match.evidence_version_id && <SelectItem value="use_existing">Use existing evidence</SelectItem>}
                      {!noMatch && <SelectItem value="ask_supplier">Ask supplier to share existing evidence</SelectItem>}
                      {!noMatch && <SelectItem value="request_new">Request a new version anyway</SelectItem>}
                      {!noMatch && <SelectItem value="cancel_duplicate">Cancel duplicate request</SelectItem>}
                      <SelectItem value="create">Create a normal request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {resolution.choice === 'request_new' && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Reason for requesting another version *</Label>
                      <Select value={resolution.reasonCode || ''} onValueChange={(reasonCode) => onResolutionChange(result.client_key, { ...resolution, reasonCode })}>
                        <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
                        <SelectContent>{REASONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Additional context</Label>
                      <Textarea value={resolution.reasonNotes || ''} onChange={(event) => onResolutionChange(result.client_key, { ...resolution, reasonNotes: event.target.value })} placeholder="Tell the supplier what changed or what is required." />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {invalid && <p className="text-sm text-destructive">Select a reason for every request that intentionally asks for a new version.</p>}
      <div className="flex justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="button" disabled={loading || invalid} onClick={onSubmit}>
          {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}Confirm and send
        </Button>
      </div>
    </div>
  );
}
