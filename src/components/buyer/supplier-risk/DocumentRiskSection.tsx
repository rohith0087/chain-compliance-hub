import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { DocumentItem } from './riskData';

const statusBadge = (s: string) => {
  if (s === 'Approved') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (s === 'Pending') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300';
};

export function DocumentRiskSection({ documents, subscore }: { documents: DocumentItem[]; subscore: number }) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Document Risk
          </CardTitle>
          <Badge variant="outline" className="font-semibold">{subscore}/100</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {documents.map((d, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
              <span className="text-sm">{d.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{d.expiryDate}</span>
                <Badge className={`text-xs border-0 ${statusBadge(d.status)}`}>{d.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
