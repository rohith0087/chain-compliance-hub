/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { FileCheck2, HelpCircle, LockKeyhole, RefreshCw, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useCanonicalEvidenceFeature } from '@/hooks/useCanonicalEvidenceFeature';
import { toast } from 'sonner';

interface Props {
  request: any;
  onResolved: () => void;
  onUploadNew: () => void;
}

interface EvidenceOption {
  id: string;
  expiry_date: string | null;
  record: { display_name: string; canonical_document_type: string } | null;
  jurisdiction?:string|null;standards?:string[];covered_product_ids?:string[];covered_facility_ids?:string[];
  evidence_attestations?: Array<{attestation_type:string;outcome:string;organization_id:string;created_at:string}>;
  evidence_validation_runs?: Array<{status:string;created_at:string}>;
}

export default function SupplierEvidenceReusePanel({ request, onResolved, onUploadNew }: Props) {
  const { enabled } = useCanonicalEvidenceFeature(request.supplier_id, 'supplier');
  const requestStandardsKey=JSON.stringify(request.required_standards_snapshot||[]);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<EvidenceOption[]>([]);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !enabled) return;
    const load = async () => {
      const client = supabase as any;
      const { data, error } = await client.from('evidence_versions')
        .select('id,expiry_date,jurisdiction,standards,covered_product_ids,covered_facility_ids,record:evidence_records!inner(display_name,canonical_document_type),evidence_attestations(attestation_type,outcome,organization_id,created_at),evidence_validation_runs(status,created_at)')
        .eq('lifecycle_status', 'current').eq('record.supplier_id', request.supplier_id)
        .order('expiry_date', { ascending: false });
      if (error) toast.error('Could not load reusable evidence');
      else {const threshold=new Date();threshold.setHours(0,0,0,0);threshold.setDate(threshold.getDate()+(request.minimum_remaining_validity_days??90));const compact=String(request.document_type||'').toLowerCase().replace(/[^a-z0-9]+/g,'');const aliases:Record<string,string>={sds:'sds',safetydatasheet:'sds',safetydatasheetssds:'sds',materialsafetydatasheet:'sds',msds:'sds',isocertificate:'iso_certificate',iso9001certificate:'iso_certificate',iso9001certification:'iso_certificate',insurancecertificate:'insurance_certificate',certificateofinsurance:'insurance_certificate',coa:'coa',certificateofanalysis:'coa',businesslicense:'business_license',businesslicence:'business_license',testreport:'test_report',laboratorytestreport:'test_report'};const expectedType=aliases[compact]||String(request.document_type||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');setOptions((data||[]).filter((version:any)=>{
        const latestValidation=[...(version.evidence_validation_runs||[])].sort((a:any,b:any)=>String(b.created_at).localeCompare(String(a.created_at)))[0];
        const supplierVerified=[...(version.evidence_attestations||[])].sort((a:any,b:any)=>String(b.created_at).localeCompare(String(a.created_at))).find((row:any)=>row.organization_id===request.supplier_id&&['supplier_verification','rejection'].includes(row.attestation_type));
        const scopeMatches=request.evidence_subject_type==='product'?(version.covered_product_ids||[]).includes(request.evidence_subject_id):request.evidence_subject_type==='facility'?(version.covered_facility_ids||[]).includes(request.evidence_subject_id):true;
        const jurisdictionMatches=!request.evidence_jurisdiction||String(version.jurisdiction||'').toLowerCase()===String(request.evidence_jurisdiction).toLowerCase();const standardsMatch=(JSON.parse(requestStandardsKey) as string[]).every((standard:string)=>(version.standards||[]).includes(standard));
        return version.record?.canonical_document_type===expectedType&&scopeMatches&&jurisdictionMatches&&standardsMatch&&latestValidation?.status==='passed'&&supplierVerified?.attestation_type==='supplier_verification'&&supplierVerified?.outcome==='accepted'&&(!version.expiry_date||new Date(version.expiry_date)>=threshold);
      }));}
    };
    void load();
  }, [open,enabled,request.supplier_id,request.document_type,request.minimum_remaining_validity_days,request.evidence_subject_type,request.evidence_subject_id,request.evidence_jurisdiction,requestStandardsKey]);

  if (!enabled || !['match_available', 'awaiting_supplier_consent'].includes(request.fulfillment_status)) return null;

  const resolve = async (action: string, evidenceVersionId?: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('resolve-document-request-v1', {
        body: { request_id: request.id, action, evidence_version_id: evidenceVersionId || null, reason: reason || null },
      });
      if (error) throw error;
      toast.success(action === 'submit_existing' ? 'Existing evidence submitted without another upload' : 'Buyer notified');
      setOpen(false);
      onResolved();
    } catch (error: any) {
      toast.error(error.message || 'Could not resolve this request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Alert className="mx-6 mb-4 border-blue-200 bg-blue-50/60">
        <LockKeyhole className="h-4 w-4 text-blue-700" />
        <AlertTitle>Existing evidence may satisfy this request</AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p>The buyer cannot see your evidence until you choose to share it. You can reuse a valid version, upload a newer version, or ask why it was requested again.</p>
          {request.request_reason_code && (
            <p className="rounded bg-white/70 p-2"><strong>Buyer’s reason:</strong> {request.request_reason_code.replace(/_/g, ' ')}{request.request_reason_notes ? ` — ${request.request_reason_notes}` : ''}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setOpen(true)}><FileCheck2 className="mr-2 h-4 w-4" />Submit existing evidence</Button>
            <Button size="sm" variant="outline" onClick={() => { void resolve('upload_new_version'); onUploadNew(); }}><Upload className="mr-2 h-4 w-4" />Upload newer version</Button>
            <Button size="sm" variant="outline" onClick={() => void resolve('ask_clarification')}><HelpCircle className="mr-2 h-4 w-4" />Ask for clarification</Button>
            <Button size="sm" variant="ghost" onClick={() => void resolve('decline_sharing')}>Decline sharing</Button>
          </div>
        </AlertDescription>
      </Alert>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit existing evidence</DialogTitle>
            <DialogDescription>The buyer receives access for matching compliance use until this evidence expires or you revoke access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Evidence version</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger><SelectValue placeholder="Select current verified evidence" /></SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.record?.display_name || 'Evidence'}{option.expiry_date ? ` · expires ${new Date(option.expiry_date).toLocaleDateString()}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Message to buyer</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional context about this evidence" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!selected || loading} onClick={() => void resolve('submit_existing', selected)}>
              {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}Share and submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
