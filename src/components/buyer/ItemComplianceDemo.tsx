import { useState } from 'react';
import {
  Package, CheckCircle2, AlertTriangle, FlaskConical, ShieldCheck, Search, XCircle, Clock, Leaf,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { reviewCardContainerClass } from '@/components/documents/buyerReviewDesignSystem';

// Static demo dataset — product/SKU-level compliance for a food catalog. No
// backend yet; this is the fully-loaded view for demos.
type Status = 'compliant' | 'at_risk' | 'noncompliant';
interface Item {
  id: string; sku: string; name: string; category: string; supplier: string;
  frameworks: string[]; allergens: string[]; coa: 'current' | 'expiring' | 'missing';
  status: Status; met: number; total: number; note: string;
}

const ITEMS: Item[] = [
  { id: 'i1', sku: 'TP-1001', name: 'Organic Tomato Paste', category: 'Ingredient', supplier: 'Test Supplier', frameworks: ['SQF', 'FSMA 204'], allergens: [], coa: 'current', status: 'compliant', met: 8, total: 8, note: 'All specs met; COA valid to 2027.' },
  { id: 'i2', sku: 'AB-2043', name: 'Roasted Almond Butter', category: 'Ingredient', supplier: 'Voot Foods', frameworks: ['SQF', 'HACCP'], allergens: ['Tree nuts'], coa: 'expiring', status: 'at_risk', met: 6, total: 8, note: 'COA expires in 9 days; aflatoxin retest pending.' },
  { id: 'i3', sku: 'FP-3300', name: 'Frozen Sweet Peas', category: 'Frozen', supplier: 'Logic Foods', frameworks: ['BRCGS', 'HACCP'], allergens: [], coa: 'current', status: 'compliant', met: 7, total: 7, note: 'Cold-chain verified; no deviations.' },
  { id: 'i4', sku: 'OO-1188', name: 'Extra-Virgin Olive Oil', category: 'Oil', supplier: 'Voot Foods', frameworks: ['SQF'], allergens: [], coa: 'current', status: 'compliant', met: 6, total: 6, note: 'Authenticity panel passed.' },
  { id: 'i5', sku: 'WP-5521', name: 'Whey Protein Concentrate', category: 'Powder', supplier: 'Logic Foods', frameworks: ['ISO 22000', 'HACCP'], allergens: ['Milk'], coa: 'missing', status: 'noncompliant', met: 4, total: 8, note: 'No current COA on file; micro results outstanding.' },
  { id: 'i6', sku: 'CS-0090', name: 'Cane Sugar (Fine)', category: 'Ingredient', supplier: 'Onboarding Test', frameworks: ['ISO 22000'], allergens: [], coa: 'current', status: 'compliant', met: 5, total: 5, note: 'Within spec; heavy-metals clear.' },
];

const STATUS = {
  compliant: { tone: 'text-emerald-600', bg: 'bg-emerald-600/15 text-emerald-600', icon: CheckCircle2, label: 'Compliant' },
  at_risk: { tone: 'text-amber-600', bg: 'bg-amber-500/15 text-amber-600', icon: AlertTriangle, label: 'At risk' },
  noncompliant: { tone: 'text-red-600', bg: 'bg-red-600/15 text-red-600', icon: XCircle, label: 'Non-compliant' },
} as const;
const COA = {
  current: { bg: 'bg-emerald-600/15 text-emerald-600', label: 'COA current', icon: FlaskConical },
  expiring: { bg: 'bg-amber-500/15 text-amber-600', label: 'COA expiring', icon: Clock },
  missing: { bg: 'bg-red-600/15 text-red-600', label: 'COA missing', icon: XCircle },
} as const;

function Kpi({ icon: Icon, value, label, tone }: { icon: typeof Package; value: string; label: string; tone?: string }) {
  return (
    <div className={`${reviewCardContainerClass} p-4`}>
      <Icon className={`h-5 w-5 ${tone ?? 'text-muted-foreground'}`} />
      <p className={`mt-2 text-3xl font-semibold ${tone ?? ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function ItemComplianceDemo() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Status>('all');

  const items = ITEMS.filter((it) =>
    (status === 'all' || it.status === status) &&
    (!q.trim() || [it.name, it.sku, it.supplier, it.category, ...it.frameworks].join(' ').toLowerCase().includes(q.toLowerCase())));

  const compliant = ITEMS.filter((i) => i.status === 'compliant').length;
  const atRisk = ITEMS.filter((i) => i.status === 'at_risk').length;
  const coaIssues = ITEMS.filter((i) => i.coa !== 'current').length;

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Package className="h-6 w-6 text-primary" /> Item &amp; Product Compliance
          </h1>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-muted-foreground">Demo dataset</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Package} value={String(ITEMS.length)} label="Active SKUs" />
          <Kpi icon={ShieldCheck} value={`${compliant}/${ITEMS.length}`} label="Fully compliant" tone="text-emerald-600" />
          <Kpi icon={AlertTriangle} value={String(atRisk)} label="At risk" tone="text-amber-600" />
          <Kpi icon={FlaskConical} value={String(coaIssues)} label="COA attention" tone="text-red-600" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search SKU, product, supplier…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="compliant">Compliant</SelectItem>
              <SelectItem value="at_risk">At risk</SelectItem>
              <SelectItem value="noncompliant">Non-compliant</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">{items.length} of {ITEMS.length} items</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {items.map((it) => {
            const S = STATUS[it.status]; const C = COA[it.coa];
            const SIcon = S.icon; const CIcon = C.icon;
            const pct = it.total > 0 ? (it.met / it.total) * 100 : 0;
            return (
              <div key={it.id} className={`${reviewCardContainerClass} p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{it.sku}</span>
                      <Badge variant="outline" className="text-[10px]">{it.category}</Badge>
                    </div>
                    <p className="mt-0.5 truncate font-semibold text-foreground">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{it.supplier}</p>
                  </div>
                  <Badge className={`gap-1 ${S.bg}`}><SIcon className="h-3 w-3" />{S.label}</Badge>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${it.status === 'compliant' ? 'bg-emerald-500' : it.status === 'at_risk' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{it.met}/{it.total} specs met · {it.note}</p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                  {it.frameworks.map((f) => <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>)}
                  <Badge className={`gap-1 text-[10px] ${C.bg}`}><CIcon className="h-3 w-3" />{C.label}</Badge>
                  {it.allergens.length > 0
                    ? it.allergens.map((a) => <Badge key={a} className="gap-1 bg-orange-500/15 text-[10px] text-orange-600"><Leaf className="h-3 w-3" />{a}</Badge>)
                    : <Badge variant="outline" className="text-[10px] text-muted-foreground">Allergen-free</Badge>}
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed p-10 text-center text-muted-foreground">No items match these filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}
