import { useState } from 'react';
import {
  Building2, CheckCircle2, AlertTriangle, ShieldCheck, MapPin, CalendarClock, Search,
  Factory, Package, XCircle, Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { reviewCardContainerClass } from '@/components/documents/buyerReviewDesignSystem';

// Static demo dataset — a facility-level compliance matrix for a food supply chain.
// No backend yet; this is the "what it looks like fully loaded" view for demos.
type Cell = 'compliant' | 'issue' | 'not_produced';
interface Facility {
  id: string; name: string; supplier: string; location: string; type: string;
  certs: string[]; audit: { label: string; state: 'passed' | 'due' | 'finding' }; score: number;
  items: Record<string, Cell>;
}

const ITEMS = ['Tomato Paste', 'Almond Butter', 'Frozen Peas', 'Olive Oil', 'Cane Sugar', 'Whey Protein'];

const FACILITIES: Facility[] = [
  { id: 'f1', name: 'Cedar Valley Processing', supplier: 'Test Supplier', location: 'Fresno, CA', type: 'Processing', certs: ['SQF', 'HACCP', 'ISO 22000'], audit: { label: 'Passed · Apr 2026', state: 'passed' }, score: 96,
    items: { 'Tomato Paste': 'compliant', 'Frozen Peas': 'compliant', 'Olive Oil': 'compliant', 'Almond Butter': 'not_produced', 'Cane Sugar': 'not_produced', 'Whey Protein': 'not_produced' } },
  { id: 'f2', name: 'Riverside Cold Storage', supplier: 'Logic Foods', location: 'Modesto, CA', type: 'Cold storage', certs: ['BRCGS', 'HACCP'], audit: { label: 'Due in 12 days', state: 'due' }, score: 82,
    items: { 'Frozen Peas': 'compliant', 'Whey Protein': 'issue', 'Tomato Paste': 'not_produced', 'Almond Butter': 'not_produced', 'Olive Oil': 'not_produced', 'Cane Sugar': 'not_produced' } },
  { id: 'f3', name: 'Gulfport Packaging', supplier: 'Voot Foods', location: 'Gulfport, MS', type: 'Packaging', certs: ['SQF'], audit: { label: 'Finding open', state: 'finding' }, score: 61,
    items: { 'Almond Butter': 'issue', 'Cane Sugar': 'compliant', 'Tomato Paste': 'not_produced', 'Frozen Peas': 'not_produced', 'Olive Oil': 'not_produced', 'Whey Protein': 'not_produced' } },
  { id: 'f4', name: 'Harvest Mills', supplier: 'Onboarding Test', location: 'Wichita, KS', type: 'Milling', certs: ['ISO 22000', 'HACCP'], audit: { label: 'Passed · Jan 2026', state: 'passed' }, score: 91,
    items: { 'Cane Sugar': 'compliant', 'Whey Protein': 'compliant', 'Tomato Paste': 'not_produced', 'Almond Butter': 'not_produced', 'Frozen Peas': 'not_produced', 'Olive Oil': 'not_produced' } },
  { id: 'f5', name: 'Coastal Oils Refinery', supplier: 'Voot Foods', location: 'Savannah, GA', type: 'Refining', certs: ['SQF', 'HACCP'], audit: { label: 'Due in 28 days', state: 'due' }, score: 88,
    items: { 'Olive Oil': 'compliant', 'Tomato Paste': 'not_produced', 'Almond Butter': 'not_produced', 'Frozen Peas': 'not_produced', 'Cane Sugar': 'not_produced', 'Whey Protein': 'not_produced' } },
];

const AUDIT_TONE: Record<string, string> = {
  passed: 'bg-emerald-600/15 text-emerald-600', due: 'bg-amber-500/15 text-amber-600', finding: 'bg-red-600/15 text-red-600',
};
const AUDIT_ICON = { passed: CheckCircle2, due: Clock, finding: AlertTriangle } as const;

function Kpi({ icon: Icon, value, label, tone }: { icon: typeof Building2; value: string; label: string; tone?: string }) {
  return (
    <div className={`${reviewCardContainerClass} p-4`}>
      <Icon className={`h-5 w-5 ${tone ?? 'text-muted-foreground'}`} />
      <p className={`mt-2 text-3xl font-semibold ${tone ?? ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function FacilityMatrixDemo() {
  const [q, setQ] = useState('');
  const facilities = FACILITIES.filter((f) =>
    !q.trim() || [f.name, f.supplier, f.location, ...f.certs].join(' ').toLowerCase().includes(q.toLowerCase()));

  const certified = FACILITIES.filter((f) => f.audit.state === 'passed').length;
  const auditsDue = FACILITIES.filter((f) => f.audit.state === 'due').length;
  const findings = FACILITIES.filter((f) => f.audit.state === 'finding').length;

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Factory className="h-6 w-6 text-primary" /> Facility Compliance Matrix
          </h1>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-muted-foreground">Demo dataset</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Building2} value={String(FACILITIES.length)} label="Facilities in network" />
          <Kpi icon={ShieldCheck} value={`${certified}/${FACILITIES.length}`} label="Audit-current" tone="text-emerald-600" />
          <Kpi icon={CalendarClock} value={String(auditsDue)} label="Audits due < 30 days" tone="text-amber-600" />
          <Kpi icon={AlertTriangle} value={String(findings)} label="Open findings" tone="text-red-600" />
        </div>

        {/* Facility × item production matrix */}
        <div className={`${reviewCardContainerClass} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Production &amp; compliance grid</p>
              <p className="text-xs text-muted-foreground">Which items are produced where — and whether that facility is compliant to make them.</p>
            </div>
            <div className="relative max-w-xs">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search facilities…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="sticky left-0 bg-card p-3 font-medium">Facility</th>
                  {ITEMS.map((it) => <th key={it} className="p-3 text-center font-medium">{it}</th>)}
                </tr>
              </thead>
              <tbody>
                {facilities.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="sticky left-0 bg-card p-3">
                      <p className="font-medium text-foreground">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.supplier} · {f.location}</p>
                    </td>
                    {ITEMS.map((it) => {
                      const cell = f.items[it];
                      return (
                        <td key={it} className="p-3 text-center">
                          {cell === 'compliant' ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                            : cell === 'issue' ? <XCircle className="mx-auto h-4 w-4 text-red-500" />
                            : <span className="text-muted-foreground/30">·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-border p-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Produced &amp; compliant</span>
            <span className="inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5 text-red-500" /> Produced, compliance issue</span>
            <span className="inline-flex items-center gap-1"><span className="text-muted-foreground/40">·</span> Not produced here</span>
          </div>
        </div>

        {/* Facility cards */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {facilities.map((f) => {
            const AIcon = AUDIT_ICON[f.audit.state];
            const scoreTone = f.score >= 85 ? 'text-emerald-600' : f.score >= 70 ? 'text-amber-600' : 'text-red-600';
            const produced = Object.values(f.items).filter((c) => c !== 'not_produced').length;
            return (
              <div key={f.id} className={`${reviewCardContainerClass} p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{f.name}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{f.location} · {f.type}</p>
                  </div>
                  <span className={`text-xl font-semibold ${scoreTone}`}>{f.score}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {f.certs.map((c) => <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>)}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
                  <Badge className={`gap-1 ${AUDIT_TONE[f.audit.state]}`}><AIcon className="h-3 w-3" />{f.audit.label}</Badge>
                  <span className="inline-flex items-center gap-1 text-muted-foreground"><Package className="h-3 w-3" />{produced} item{produced !== 1 ? 's' : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
