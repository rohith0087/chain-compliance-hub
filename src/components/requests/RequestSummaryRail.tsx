import { useEffect, useState } from 'react';
import { Flag, CalendarIcon, FileText, Loader2, Sparkles } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  cardClass,
  cardPadClass,
  sectionLabelClass,
  mutedBodyClass,
  inlineIconClass,
} from '@/design/system';
import { ComplianceDocument } from './ComplianceDocuments';
import { suggestConfig, draftMessage, type ConfigSuggestion } from '@/lib/requestAiAssist';

interface RequestSummaryRailProps {
  entityType: string;
  buyerId?: string;
  selectedDocuments: ComplianceDocument[];
  formData: {
    suppliers: string[];
    priority: string;
    dueDate: string;
    notes: string;
  };
  onFormDataChange: (field: string, value: string) => void;
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
};

/**
 * The persistent right rail shown while building a request (steps 1–2): a live
 * summary of what's being requested plus real AI guidance (priority / due-date /
 * drafted instructions). All AI calls fail soft via `@/lib/requestAiAssist`.
 */
export default function RequestSummaryRail({
  entityType,
  buyerId,
  selectedDocuments,
  formData,
  onFormDataChange,
}: RequestSummaryRailProps) {
  const [aiSuggestion, setAiSuggestion] = useState<ConfigSuggestion | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [draftingNotes, setDraftingNotes] = useState(false);

  const docTitles = selectedDocuments.map((d) => d.title);
  const hasDocs = selectedDocuments.length > 0;

  useEffect(() => {
    if (!buyerId || selectedDocuments.length === 0) { setAiSuggestion(null); return; }
    let cancelled = false;
    setGuidanceLoading(true);
    suggestConfig(buyerId, entityType, docTitles, formData.suppliers.length || 1).then((result) => {
      if (cancelled) return;
      if (result) setAiSuggestion(result);
      setGuidanceLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerId, entityType, selectedDocuments.length]);

  const applyPriority = () => { if (aiSuggestion) onFormDataChange('priority', aiSuggestion.priority); };
  const applyDueDate = () => {
    if (!aiSuggestion) return;
    onFormDataChange('dueDate', format(addDays(new Date(), aiSuggestion.dueInDays), 'yyyy-MM-dd'));
  };
  const draftInstructions = async () => {
    if (!buyerId) return;
    setDraftingNotes(true);
    const result = await draftMessage(buyerId, entityType, docTitles, formData.priority, formData.dueDate || null);
    if (result?.message) onFormDataChange('notes', result.message);
    setDraftingNotes(false);
  };

  const rows: Array<[string, string]> = [
    ['Entity type', entityType],
    ['Documents', String(selectedDocuments.length)],
    ['Recipients', String(formData.suppliers.length)],
    ['Priority', PRIORITY_LABEL[formData.priority] ?? '—'],
    ['Due date', formData.dueDate ? format(new Date(formData.dueDate), 'MMM d, yyyy') : 'Not set'],
  ];

  return (
    <div className="space-y-4">
      {/* Live request summary */}
      <div className={`${cardClass} ${cardPadClass}`}>
        <p className={sectionLabelClass}>Request summary</p>
        <dl className="mt-3 space-y-2.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-small text-muted-foreground">{label}</dt>
              <dd className="text-small font-medium text-foreground text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* AI guidance */}
      <div className={`${cardClass} ${cardPadClass}`}>
        <div className="flex items-center gap-2">
          <Sparkles className={`${inlineIconClass} text-primary`} />
          <p className={sectionLabelClass}>AI guidance</p>
        </div>

        <p className={`${mutedBodyClass} mt-3 text-small`}>
          {!hasDocs
            ? 'Select documents to get a suggested priority, due date, and supplier message.'
            : guidanceLoading
              ? `Analyzing ${entityType} requirements…`
              : aiSuggestion?.rationale || 'These documents are commonly requested during supplier onboarding.'}
        </p>

        {hasDocs && !guidanceLoading && aiSuggestion && (
          <p className="mt-2 text-small text-foreground">
            Suggested <span className="font-medium capitalize">{aiSuggestion.priority}</span> priority,
            due within <span className="font-medium">{aiSuggestion.dueInDays}</span> days.
          </p>
        )}

        <div className="mt-4 space-y-2">
          <Button
            variant="outline" size="sm"
            onClick={applyPriority}
            disabled={guidanceLoading || !aiSuggestion}
            className="w-full justify-start"
          >
            <Flag className={`${inlineIconClass} mr-2`} /> Apply suggested priority
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={applyDueDate}
            disabled={guidanceLoading || !aiSuggestion}
            className="w-full justify-start"
          >
            <CalendarIcon className={`${inlineIconClass} mr-2`} /> Apply suggested due date
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={draftInstructions}
            disabled={draftingNotes || !buyerId || !hasDocs}
            className="w-full justify-start"
          >
            {draftingNotes ? <Loader2 className={`${inlineIconClass} mr-2 animate-spin`} /> : <FileText className={`${inlineIconClass} mr-2`} />}
            Draft supplier instructions
          </Button>
        </div>
      </div>
    </div>
  );
}
