import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { COAAnalyteResult } from './coaDemoData';

interface COAComparisonTableProps {
  results: COAAnalyteResult[];
}

const statusConfig = {
  pass: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100 text-green-700 border-green-300', label: 'Pass' },
  fail: { icon: XCircle, color: 'text-destructive', bg: 'bg-red-100 text-red-700 border-red-300', label: 'Fail' },
  flagged: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Flagged' },
  unknown_analyte: { icon: HelpCircle, color: 'text-blue-500', bg: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Unknown' },
};

export function COAComparisonTable({ results }: COAComparisonTableProps) {
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-10">Status</TableHead>
            <TableHead>Analyte</TableHead>
            <TableHead>Raw Value</TableHead>
            <TableHead>Normalized</TableHead>
            <TableHead>Spec Range</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Flag Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r) => {
            const cfg = statusConfig[r.status];
            const Icon = cfg.icon;
            return (
              <TableRow key={r.id} className={r.status === 'fail' ? 'bg-destructive/5' : ''}>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </TooltipTrigger>
                    <TooltipContent>{cfg.label}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="font-medium">{r.analyte_name}</TableCell>
                <TableCell>
                  <span className="text-muted-foreground">{r.raw_value} {r.raw_unit !== '-' ? r.raw_unit : ''}</span>
                  {r.is_censored && (
                    <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">{r.censored_type}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.numeric_value !== null ? (
                    <span className="font-mono text-sm">{r.numeric_value} {r.normalized_unit}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                  {r.conversion_notes && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground ml-1 inline" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{r.conversion_notes}</TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>
                  {r.spec_max !== null || r.spec_min !== null ? (
                    <span className="font-mono text-xs">
                      {r.spec_min !== null ? `${r.spec_min}` : '—'} – {r.spec_max !== null ? `${r.spec_max}` : '—'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">No spec</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.normalized_method ? (
                    <span className="text-xs font-mono">{r.normalized_method}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.flag_reason ? (
                    <span className="text-xs text-muted-foreground">{r.flag_reason}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
