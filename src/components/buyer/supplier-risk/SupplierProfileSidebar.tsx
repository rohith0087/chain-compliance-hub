import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, Factory, CalendarDays, Clock, Bell, Settings, Download } from 'lucide-react';
import { SupplierRiskProfile } from './riskData';
import { generateSupplierRiskPDF } from '@/utils/generateSupplierRiskPDF';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceProfile } from '@/hooks/useWorkspaceProfile';

export function SupplierProfileSidebar({ supplier }: { supplier: SupplierRiskProfile }) {
  const { profile, user } = useAuth();
  const { t } = useWorkspaceProfile();
  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.supplier_profile}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{supplier.name}</p>
              <p className="text-xs text-muted-foreground">{supplier.industry}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {supplier.hq}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Factory className="h-3.5 w-3.5" /> {supplier.facilities} facilities
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Connected {supplier.connectedDate}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring Sources */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monitoring Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {supplier.monitoringSources.map(s => (
              <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
            <Clock className="h-3 w-3" /> Next refresh in: {supplier.nextRefresh}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <Bell className="h-3.5 w-3.5" /> Set Alerts
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <Settings className="h-3.5 w-3.5" /> Manage Thresholds
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => generateSupplierRiskPDF({
            supplier,
            userName: profile?.full_name || 'Unknown User',
            userEmail: user?.email || 'N/A',
          })}>
            <Download className="h-3.5 w-3.5" /> Download Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
