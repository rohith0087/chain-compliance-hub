import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardCheck, Loader2, Share2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import CanonicalEvidenceSharingView from './CanonicalEvidenceSharingView';
import { useCanonicalEvidenceFeature } from '@/hooks/useCanonicalEvidenceFeature';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EvidenceSharingViewProps {
  supplierId: string;
}

type ClaimStatus = 'extracted' | 'verified' | 'rejected' | 'superseded';

interface EvidenceClaim {
  id: string;
  document_type: string | null;
  status: ClaimStatus;
  issuer: string | null;
  certificate_number: string | null;
  expiry_date: string | null;
}

interface ConnectedBuyer {
  id: string;
  company_name: string;
}

interface EvidenceSharingGrant {
  id: string;
  granted_to_organization_id: string;
  claim_id: string | null;
  document_type: string | null;
  purpose: string;
  status: 'active' | 'revoked';
  expires_at: string | null;
  granted_at: string;
}

interface AuditLogEntry {
  id: string;
  grant_id: string;
  event_type: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

const statusConfig: Record<ClaimStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  extracted: { label: 'Needs review', icon: ClipboardCheck, className: 'border-amber-200 bg-amber-50 text-amber-800' },
  verified: { label: 'Verified', icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'border-slate-200 bg-slate-50 text-slate-700' },
  superseded: { label: 'Superseded', icon: XCircle, className: 'border-slate-200 bg-slate-50 text-slate-500' },
};

const PURPOSE_OPTIONS = [
  { value: 'compliance_decision', label: 'Compliance decision' },
  { value: 'audit_review', label: 'Audit review' },
  { value: 'due_diligence', label: 'Due diligence' },
] as const;

// Phase 4 tables and RPCs are intentionally not added to generated types until the migration is approved.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function ShareDialog({
  supplierId,
  connectedBuyers,
  preselectedClaim,
  onClose,
  onShared,
}: {
  supplierId: string;
  connectedBuyers: ConnectedBuyer[];
  preselectedClaim: EvidenceClaim | null;
  onClose: () => void;
  onShared: () => void;
}) {
  const [buyerId, setBuyerId] = useState('');
  const [purpose, setPurpose] = useState<string>('compliance_decision');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = async () => {
    if (!buyerId) {
      setError('Select a buyer to share with.');
      return;
    }
    if (!preselectedClaim) {
      setError('No evidence claim selected.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcError } = await db.rpc('grant_evidence_access_v1', {
      p_owner_organization_id: supplierId,
      p_granted_to_buyer_id: buyerId,
      p_claim_id: preselectedClaim.id,
      p_document_type: null,
      p_purpose: purpose,
      p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
    setBusy(false);
    if (rpcError) setError(rpcError.message);
    else onShared();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share evidence</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sharing {preselectedClaim?.document_type || preselectedClaim?.issuer || 'this evidence'} ({preselectedClaim?.certificate_number || 'no certificate number'}).
          </p>
          <div className="space-y-2">
            <Label>Buyer</Label>
            <Select value={buyerId} onValueChange={setBuyerId}>
              <SelectTrigger><SelectValue placeholder="Select a connected buyer" /></SelectTrigger>
              <SelectContent>
                {connectedBuyers.map((buyer) => (
                  <SelectItem key={buyer.id} value={buyer.id}>{buyer.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Purpose</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PURPOSE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only "Compliance decision" grants feed the buyer's automated compliance outcomes. Other purposes make the evidence visible without affecting decisions.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Expires (optional)</Label>
            <Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </div>
          {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={share} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LegacyEvidenceSharingView({ supplierId }: EvidenceSharingViewProps) {
  const [claims, setClaims] = useState<EvidenceClaim[]>([]);
  const [connectedBuyers, setConnectedBuyers] = useState<ConnectedBuyer[]>([]);
  const [grants, setGrants] = useState<EvidenceSharingGrant[]>([]);
  const [buyerNames, setBuyerNames] = useState<Record<string, string>>({});
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [shareTarget, setShareTarget] = useState<EvidenceClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: claimRows, error: claimsError },
      { data: connectionRows, error: connectionsError },
      { data: grantRows, error: grantsError },
      { data: auditRows, error: auditError },
    ] = await Promise.all([
      db.from('evidence_claims').select('id, document_type, status, issuer, certificate_number, expiry_date')
        .eq('supplier_id', supplierId).eq('status', 'verified').order('created_at', { ascending: false }),
      db.from('buyer_supplier_connections').select('buyer_id, buyers:buyer_id(id, company_name)')
        .eq('supplier_id', supplierId).eq('status', 'approved'),
      db.from('evidence_sharing_grants').select('*').eq('owner_organization_id', supplierId).order('granted_at', { ascending: false }),
      db.from('evidence_sharing_audit_log').select('*').eq('organization_id', supplierId)
        .order('occurred_at', { ascending: false }).limit(50),
    ]);

    if (claimsError || connectionsError || grantsError || auditError) {
      setError('Unable to load evidence sharing data.');
      setLoading(false);
      return;
    }

    setClaims(claimRows || []);
    const buyers = (connectionRows || [])
      .map((row: { buyers: ConnectedBuyer | null }) => row.buyers)
      .filter((buyer: ConnectedBuyer | null): buyer is ConnectedBuyer => Boolean(buyer));
    setConnectedBuyers(buyers);
    setBuyerNames(Object.fromEntries(buyers.map((buyer) => [buyer.id, buyer.company_name])));
    setGrants(grantRows || []);
    setAuditLog(auditRows || []);
    setLoading(false);
  }, [supplierId]);

  useEffect(() => { void load(); }, [load]);

  const revoke = async (grantId: string) => {
    setActionError(null);
    const { error: rpcError } = await db.rpc('revoke_evidence_access_v1', { p_grant_id: grantId });
    if (rpcError) setActionError(rpcError.message);
    else void load();
  };

  const sortedClaims = useMemo(() => claims, [claims]);

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Evidence Sharing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your verified evidence with connected buyers instead of re-uploading it for each one. You control who sees what, and you can revoke access at any time.
          </p>
        </div>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        {actionError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{actionError}</AlertDescription></Alert>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Your evidence</CardTitle>
                <CardDescription>Evidence extracted from documents you've uploaded.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {sortedClaims.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No evidence claims yet.</p>
                ) : sortedClaims.map((claim) => {
                  const config = statusConfig[claim.status];
                  const Icon = config.icon;
                  return (
                    <div key={claim.id} className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{claim.document_type || claim.issuer || 'Unknown evidence'}</span>
                          <Badge variant="outline" className={config.className}><Icon className="mr-1 h-3 w-3" />{config.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {claim.issuer || 'Unknown issuer'} · {claim.certificate_number || 'No certificate number'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={connectedBuyers.length === 0}
                        onClick={() => setShareTarget(claim)}
                      >
                        <Share2 className="mr-1 h-3 w-3" />Share
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active and past grants</CardTitle>
                <CardDescription>Who you've shared evidence with.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {grants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sharing grants yet.</p>
                ) : grants.map((grant) => (
                  <div key={grant.id} className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
                    <div>
                      <p className="font-medium">{buyerNames[grant.granted_to_organization_id] || 'Unknown buyer'}</p>
                      <p className="text-xs text-muted-foreground">
                        {grant.document_type ? `All "${grant.document_type}" evidence` : 'A specific document'} · {grant.purpose.replace(/_/g, ' ')}
                        {grant.expires_at ? ` · expires ${new Date(grant.expires_at).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={grant.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}>
                        {grant.status === 'active' ? 'Active' : 'Revoked'}
                      </Badge>
                      {grant.status === 'active' && (
                        <Button size="sm" variant="destructive" onClick={() => revoke(grant.id)}>Revoke</Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sharing audit log</CardTitle>
                <CardDescription>A complete history of grants created, revoked, and actually used in a buyer's decision.</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sharing activity yet.</p>
                ) : (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {auditLog.map((entry) => (
                      <li key={entry.id}>
                        {new Date(entry.occurred_at).toLocaleString()} — {entry.event_type}
                        {entry.event_type === 'accessed' && typeof entry.metadata?.requirement_key === 'string'
                          ? ` (used for ${entry.metadata.requirement_key})`
                          : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {shareTarget && (
          <ShareDialog
            supplierId={supplierId}
            connectedBuyers={connectedBuyers}
            preselectedClaim={shareTarget}
            onClose={() => setShareTarget(null)}
            onShared={() => { setShareTarget(null); void load(); }}
          />
        )}
      </div>
    </div>
  );
}

export default function EvidenceSharingView({ supplierId }: EvidenceSharingViewProps) {
  const { enabled, loading } = useCanonicalEvidenceFeature(supplierId, 'supplier');
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading evidence sharing…</div>;
  if (enabled) return <CanonicalEvidenceSharingView supplierId={supplierId} />;
  return <LegacyEvidenceSharingView supplierId={supplierId} />;
}
