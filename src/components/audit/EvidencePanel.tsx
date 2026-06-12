import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface Props { buyerId: string; clientId: string; engagementId?: string; }

export function EvidencePanel({ buyerId, clientId, engagementId }: Props) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      let q = supabase.from('document_uploads')
        .select('id, document_name, file_name, status, expiration_date, document_requests!inner(supplier_id, buyer_id, title)')
        .eq('document_requests.supplier_id', clientId)
        .eq('document_requests.buyer_id', buyerId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (engagementId) q = q.eq('request_id', engagementId);
      const { data } = await q;
      if (active) { setDocs(data ?? []); setLoading(false); }
    })();
    return () => { active = false; };
  }, [buyerId, clientId, engagementId]);

  if (loading) return <p className="text-xs text-muted-foreground p-2">Loading…</p>;
  if (docs.length === 0) return <p className="text-xs text-muted-foreground p-2">No evidence yet.</p>;

  const today = new Date();
  return (
    <div className="space-y-2">
      {docs.map((d: any) => {
        let exp: { label: string; tone: string } | null = null;
        if (d.expiration_date) {
          const days = Math.ceil((new Date(d.expiration_date).getTime() - today.getTime()) / 86400000);
          if (days < 0) exp = { label: `Expired ${Math.abs(days)}d`, tone: 'destructive' };
          else if (days <= 30) exp = { label: `${days}d left`, tone: 'warning' };
        }
        return (
          <Card key={d.id} className="p-2 space-y-1">
            <div className="text-xs font-medium truncate">{d.document_name || d.file_name}</div>
            <div className="flex items-center gap-1 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
              {exp && <Badge variant={exp.tone === 'destructive' ? 'destructive' : 'secondary'} className="text-[10px]">{exp.label}</Badge>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
