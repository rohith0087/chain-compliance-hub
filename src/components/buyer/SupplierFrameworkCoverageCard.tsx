import { useEffect, useState } from 'react';
import { BookOpenCheck, ChevronRight, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  reviewCardContainerClass,
  reviewSectionHeaderClass,
} from '@/components/documents/buyerReviewDesignSystem';

interface CoverageRow {
  framework_code: string;
  supplier_id: string;
  supplier_name: string;
  total: number;
  compliant: number;
  gaps: number;
  pending: number;
}

interface Props {
  buyerId: string;
  supplierId: string;
  onOpenWorkspace?: () => void;
}

// Compact "which frameworks apply to this supplier and where they stand" card, for
// the supplier detail view — the same computed coverage the Frameworks matrix and
// the compliance workspace use (single source of truth), scoped to one supplier.
export default function SupplierFrameworkCoverageCard({ buyerId, supplierId, onOpenWorkspace }: Props) {
  const [rows, setRows] = useState<CoverageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).rpc('framework_coverage_v1', { p_buyer_id: buyerId });
        const filtered = ((data?.coverage ?? []) as CoverageRow[]).filter((r) => r.supplier_id === supplierId);
        if (active) setRows(filtered);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [buyerId, supplierId]);

  const totals = rows.reduce(
    (a, r) => ({ total: a.total + r.total, compliant: a.compliant + r.compliant, gaps: a.gaps + r.gaps }),
    { total: 0, compliant: 0, gaps: 0 },
  );
  const score = totals.total > 0 ? Math.round((totals.compliant / totals.total) * 100) : 0;

  return (
    <div className={reviewCardContainerClass}>
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className={reviewSectionHeaderClass}>Frameworks &amp; compliance</h3>
        </div>
        {totals.total > 0 && (
          <span className={`text-sm font-semibold ${score === 100 ? 'text-emerald-600' : totals.gaps > 0 ? 'text-red-600' : 'text-amber-600'}`}>{score}%</span>
        )}
      </div>

      <div className="px-4 pb-4">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading coverage…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No frameworks are active for this supplier yet. Activate one from Frameworks to start tracking coverage.
          </p>
        ) : (
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {rows.map((r) => {
              const fullyCompliant = r.gaps === 0 && r.pending === 0 && r.compliant === r.total;
              return (
                <div key={r.framework_code} className="flex items-center justify-between gap-2 rounded-[12px] border border-border px-3 py-2">
                  <span className="font-mono text-sm font-semibold text-primary">{r.framework_code}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{r.compliant}/{r.total} met</span>
                    {fullyCompliant
                      ? <Badge className="bg-emerald-600/15 text-emerald-600 hover:bg-emerald-600/15 text-xs"><ShieldCheck className="mr-1 h-3 w-3" />compliant</Badge>
                      : r.gaps > 0
                        ? <Badge className="bg-red-600/15 text-red-600 hover:bg-red-600/15 text-xs">{r.gaps} gap{r.gaps > 1 ? 's' : ''}</Badge>
                        : <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/15 text-xs">{r.pending} pending</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {onOpenWorkspace && rows.length > 0 && (
          <Button variant="outline" size="sm" className="mt-3 w-full rounded-[10px] border-border" onClick={onOpenWorkspace}>
            Open compliance workspace <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
