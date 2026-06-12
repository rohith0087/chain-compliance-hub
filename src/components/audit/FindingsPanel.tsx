import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuditFindings } from '@/hooks/useAuditFindings';

interface Props { supplierId: string; engagementId?: string; }

export function FindingsPanel({ supplierId, engagementId }: Props) {
  const { findings, loading, updateStatus, refetch } = useAuditFindings(supplierId);
  const [scoped, setScoped] = useState<any[]>([]);

  useEffect(() => {
    if (!engagementId) { setScoped(findings); return; }
    setScoped(findings.filter((f: any) => f.engagement_id === engagementId));
  }, [findings, engagementId]);

  useEffect(() => { refetch(); }, [supplierId, engagementId]);

  if (loading) return <p className="text-xs text-muted-foreground p-2">Loading…</p>;
  if (scoped.length === 0) return <p className="text-xs text-muted-foreground p-2">No findings yet. Ask the assistant to draft some.</p>;

  return (
    <div className="space-y-2">
      {scoped.map((f: any) => {
        const tone = f.severity === 'Critical' ? 'destructive' : f.severity === 'Major' ? 'default' : 'secondary';
        return (
          <Card key={f.id} className="p-2 space-y-1">
            <div className="flex items-center gap-1 flex-wrap">
              <Badge variant={tone as any} className="text-[10px]">{f.severity}</Badge>
              <Badge variant="outline" className="text-[10px]">{f.status}</Badge>
              {f.framework && <Badge variant="outline" className="text-[10px]">{f.framework}</Badge>}
            </div>
            <div className="text-xs font-medium">{f.title}</div>
            {f.recommendation && <div className="text-[11px] text-muted-foreground">→ {f.recommendation}</div>}
            <div className="flex gap-1 pt-1">
              {f.status !== 'Closed' && <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => updateStatus(f.id, 'Closed')}>Close</Button>}
              {f.status === 'Open' && <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => updateStatus(f.id, 'In Progress')}>In Progress</Button>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
