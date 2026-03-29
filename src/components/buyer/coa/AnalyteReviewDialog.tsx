import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { COAAnalyteResult } from './coaDemoData';

export interface AnalyteNote {
  isFalsePositive: boolean;
  note: string;
  timestamp: string;
  analyteName: string;
  analyteId: string;
  submissionId: string;
  supplierName: string;
  submissionDate: string;
}

interface AnalyteReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analyte: COAAnalyteResult | null;
  existingNote?: AnalyteNote;
  onSave: (note: AnalyteNote) => void;
  supplierName: string;
  submissionId: string;
  submissionDate: string;
}

const statusDisplay = {
  pass: { icon: CheckCircle2, label: 'Pass', className: 'text-green-600' },
  fail: { icon: XCircle, label: 'Fail', className: 'text-destructive' },
  flagged: { icon: AlertTriangle, label: 'Flagged', className: 'text-amber-600' },
  unknown_analyte: { icon: HelpCircle, label: 'Unknown', className: 'text-blue-500' },
};

export function AnalyteReviewDialog({
  open,
  onOpenChange,
  analyte,
  existingNote,
  onSave,
  supplierName,
  submissionId,
  submissionDate,
}: AnalyteReviewDialogProps) {
  const [isFalsePositive, setIsFalsePositive] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (existingNote) {
      setIsFalsePositive(existingNote.isFalsePositive);
      setNote(existingNote.note);
    } else {
      setIsFalsePositive(false);
      setNote('');
    }
  }, [existingNote, analyte]);

  if (!analyte) return null;

  const status = statusDisplay[analyte.status];
  const StatusIcon = status.icon;

  const handleSave = () => {
    onSave({
      isFalsePositive,
      note,
      timestamp: new Date().toISOString(),
      analyteName: analyte.analyte_name,
      analyteId: analyte.id,
      submissionId,
      supplierName,
      submissionDate,
    });
    onOpenChange(false);
  };

  const specRange = analyte.spec_min !== null || analyte.spec_max !== null
    ? `${analyte.spec_min ?? '—'} – ${analyte.spec_max ?? '—'} ${analyte.normalized_unit}`
    : 'No spec';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Analyte Review</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context section */}
          <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-2">
            <div className="grid grid-cols-[80px_1fr] gap-y-1.5 text-sm">
              <span className="text-muted-foreground">Analyte</span>
              <span className="font-medium">{analyte.analyte_name}</span>

              <span className="text-muted-foreground">Value</span>
              <span className="font-mono text-xs">
                {analyte.raw_value} {analyte.raw_unit !== '-' ? analyte.raw_unit : ''}
                {analyte.numeric_value !== null && ` → ${analyte.numeric_value} ${analyte.normalized_unit}`}
              </span>

              <span className="text-muted-foreground">Spec</span>
              <span className="font-mono text-xs">{specRange}</span>

              <span className="text-muted-foreground">Status</span>
              <span className="flex items-center gap-1.5">
                <StatusIcon className={`h-3.5 w-3.5 ${status.className}`} />
                <span className="text-xs font-medium">{status.label}</span>
              </span>

              {analyte.normalized_method && (
                <>
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-mono text-xs">{analyte.normalized_method}</span>
                </>
              )}
            </div>

            {analyte.flag_reason && (
              <div className="pt-1.5 border-t border-border/40">
                <p className="text-xs text-muted-foreground">{analyte.flag_reason}</p>
              </div>
            )}
          </div>

          {/* False positive toggle */}
          <div className="space-y-1.5">
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                checked={isFalsePositive}
                onCheckedChange={(checked) => setIsFalsePositive(checked === true)}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium group-hover:text-foreground transition-colors">
                  Mark as False Positive
                </span>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  The AI flagged this incorrectly. This override will be recorded in the audit log.
                </p>
              </div>
            </label>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Note <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Textarea
              placeholder="Add context for this review decision..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none h-20 text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isFalsePositive && !note.trim()}
          >
            Save Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
