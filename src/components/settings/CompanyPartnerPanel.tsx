import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Handshake, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PartnerInfo { partner_id: string; partner_name: string; assigned_at: string; }
interface PartnerActivity {
  id: string; partner_name: string | null; actor_name: string | null; target_name: string | null;
  action: string; detail: Record<string, unknown>; created_at: string;
}

const humanize = (s: string) => s.replace(/_/g, ' ');

// Customer-facing transparency: shows which reseller manages this org and a log
// of the actions that partner has taken. Renders nothing if no partner is assigned.
export function CompanyPartnerPanel({ companyId, companyType }: { companyId: string; companyType: 'buyer' | 'supplier' }) {
  const [info, setInfo] = useState<PartnerInfo | null>(null);
  const [activity, setActivity] = useState<PartnerActivity[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    Promise.all([
      client.rpc('company_partner_info', { p_company_id: companyId, p_company_type: companyType }),
      client.rpc('company_partner_activity', { p_company_id: companyId, p_company_type: companyType, p_limit: 50 }),
    ]).then(([i, a]) => {
      if (!active) return;
      setInfo((i.data ?? [])[0] ?? null);
      setActivity((a.data ?? []) as PartnerActivity[]);
      setLoaded(true);
    });
    return () => { active = false; };
  }, [companyId, companyType]);

  if (!loaded || (!info && activity.length === 0)) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Handshake className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Managed by a partner</CardTitle>
        </div>
        <CardDescription>
          {info
            ? <>Your account is managed by <span className="font-medium text-foreground">{info.partner_name}</span>, a TraceR2C partner, since {new Date(info.assigned_at).toLocaleDateString()}. Everything they do on your behalf is logged below.</>
            : 'A history of partner actions on your organization.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No partner actions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{a.actor_name || a.partner_name || 'Partner'}</span>{' '}
                    <Badge variant="outline" className="mx-1 text-[10px]">{humanize(a.action)}</Badge>
                    {a.target_name && <span className="text-muted-foreground">· {a.target_name}</span>}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />{new Date(a.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
