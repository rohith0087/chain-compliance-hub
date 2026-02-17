import { AlertTriangle, XCircle, AlertCircle } from 'lucide-react';
import { COASubmission } from './coaDemoData';

interface COAFlagsBannerProps {
  submissions: COASubmission[];
}

export function COAFlagsBanner({ submissions }: COAFlagsBannerProps) {
  const criticalFlags = submissions.filter(s => s.pass_fail === 'fail');
  const warningFlags = submissions.filter(s => s.pass_fail === 'partial');

  if (criticalFlags.length === 0 && warningFlags.length === 0) return null;

  return (
    <div className="space-y-2">
      {criticalFlags.length > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {criticalFlags.length} COA{criticalFlags.length > 1 ? 's' : ''} failed
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {criticalFlags.map(s => s.supplier_name).join(', ')} — critical analytes exceeded specifications
            </p>
          </div>
        </div>
      )}
      {warningFlags.length > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {warningFlags.length} COA{warningFlags.length > 1 ? 's' : ''} partially passed
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {warningFlags.map(s => s.supplier_name).join(', ')} — some analytes flagged for review
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
