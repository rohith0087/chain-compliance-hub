import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchAllSuppliersRiskOverview, type SupplierRiskOverview } from '@/features/supplier-risk/scoreApi';

type Level = 'High' | 'Medium' | 'Low' | 'None';

function riskLevel(row: SupplierRiskOverview): Level {
  if (row.active_events > 0 && row.max_severity >= 0.8) return 'High';
  if (row.active_events > 0 && row.max_severity >= 0.5) return 'Medium';
  if (row.active_events > 0 || row.review_events > 0) return 'Low';
  return 'None';
}

function levelVariant(level: Level): 'destructive' | 'outline' | 'secondary' {
  if (level === 'High') return 'destructive';
  if (level === 'Medium') return 'outline';
  return 'secondary';
}

// Platform-wide supplier risk map — ALL suppliers, connected or not (admin only).
export function SuperAdminSupplierRisk() {
  const [rows, setRows] = useState<SupplierRiskOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllSuppliersRiskOverview()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const withRisk = rows.filter((r) => r.active_events > 0 || r.review_events > 0);
    const high = rows.filter((r) => riskLevel(r) === 'High').length;
    const review = rows.reduce((n, r) => n + r.review_events, 0);
    return { total: rows.length, withRisk: withRisk.length, high, review };
  }, [rows]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Suppliers" value={stats.total} />
        <Stat label="With risk signals" value={stats.withRisk} />
        <Stat label="High risk" value={stats.high} tone="text-red-600" />
        <Stat label="Pending review" value={stats.review} tone="text-amber-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All suppliers — external risk</CardTitle>
          <CardDescription>
            Platform-wide view across every supplier, regardless of buyer connection. Sorted by
            severity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Dimensions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const level = riskLevel(r);
                  return (
                    <TableRow key={r.supplier_id}>
                      <TableCell className="font-medium">{r.company_name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.industry ?? '—'}</TableCell>
                      <TableCell>
                        {level === 'None' ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge variant={levelVariant(level)}>{level}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{r.active_events || '—'}</TableCell>
                      <TableCell>{r.review_events || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.dimensions.length ? r.dimensions.join(', ') : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className={`text-3xl font-semibold ${tone ?? ''}`}>{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
