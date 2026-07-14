import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierPerformance } from '@/hooks/useSupplierPerformance';
import { useSupplierRiskFeature } from '@/hooks/useSupplierRiskFeature';
import { resolveBuyerId } from '@/features/supplier-risk/api';
import {
  SupplierRiskPanel,
  type ComplianceRisk,
} from '@/features/supplier-risk/SupplierRiskPanel';

export default function SupplierRiskDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');

  const { suppliers } = useSuppliers();
  const { performance } = useSupplierPerformance(buyerId ?? undefined);
  const { enabled, loading: flagLoading } = useSupplierRiskFeature(buyerId ?? undefined);

  useEffect(() => {
    if (user) void resolveBuyerId(user.id).then(setBuyerId);
  }, [user]);

  const compliance: ComplianceRisk | null = useMemo(() => {
    const row = performance.find((p) => p.supplier_id === selected);
    if (!row) return null;
    return {
      compliance_score: row.compliance_score,
      risk_level: row.risk_level,
      risk_score: row.risk_score,
    };
  }, [performance, selected]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/supplier-risk/policy')}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Risk policy
          </Button>
        </div>

        <h1 className="text-2xl font-semibold">Supplier risk</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          External risk intelligence shown alongside your existing compliance risk.
        </p>

        {flagLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !enabled ? (
          <p className="text-sm text-muted-foreground">
            This feature is not enabled for your organization yet.
          </p>
        ) : (
          <>
            <div className="mb-6 max-w-sm space-y-2">
              <label className="text-sm font-medium">Supplier</label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a supplier…" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected ? (
              <SupplierRiskPanel
                buyerId={buyerId}
                supplierId={selected}
                compliance={compliance}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Select a supplier to view its risk.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
