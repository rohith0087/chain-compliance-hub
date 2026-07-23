import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { FileText, Users, Flag, CalendarIcon, MessageSquare, Paperclip, Sparkles, Loader2, Check, Copy } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ComplianceDocument } from './ComplianceDocuments';
import SampleDocumentUpload from './SampleDocumentUpload';
import { Button } from '@/components/ui/button';
import { draftMessage } from '@/lib/requestAiAssist';
import {
  cardClass,
  cardPadClass,
  sectionLabelClass,
  mutedBodyClass,
  pillClass,
  pillAccentClass,
  inlineIconClass,
} from '@/design/system';

interface ReviewFormData {
  suppliers: string[];
  priority: string;
  dueDate: string;
  notes: string;
}

interface RequestReviewStepProps {
  selectedDocuments: ComplianceDocument[];
  formData: ReviewFormData;
  buyerId?: string;
  entityType?: string;
  sampleDocument: SampleDocumentSelection;
  setSampleDocument: (sample: SampleDocumentSelection) => void;
}

interface LibraryDocumentSelection {
  id: string;
  document_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
}

interface SampleDocumentSelection {
  file?: File;
  libraryDoc?: LibraryDocumentSelection;
  source: 'device' | 'library' | null;
}

const FALLBACK_MESSAGE = 'Please upload the latest valid certificates with clearly visible scopes and expiration dates.';

/**
 * Compact AI panel for the review step's right column (where the summary rail
 * sits on steps 1–2): the what-you're-about-to-send recap plus the AI-drafted
 * supplier message with Regenerate / Copy. Fails soft to a static default.
 */
export const ReviewAiSummaryPanel = ({
  selectedDocuments,
  formData,
  buyerId,
  entityType = 'General Supplier',
}: {
  selectedDocuments: ComplianceDocument[];
  formData: ReviewFormData;
  buyerId?: string;
  entityType?: string;
}) => {
  const daysUntilDue = formData.dueDate ? differenceInDays(new Date(formData.dueDate), new Date()) : null;

  const [aiMessage, setAiMessage] = useState<string>('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadMessage = async () => {
    if (!buyerId) return;
    setMessageLoading(true);
    const result = await draftMessage(
      buyerId,
      entityType,
      selectedDocuments.map((d) => d.title),
      formData.priority,
      formData.dueDate || null,
    );
    setAiMessage(result?.message || '');
    setMessageLoading(false);
  };

  useEffect(() => {
    if (!buyerId || selectedDocuments.length === 0) return;
    let cancelled = false;
    setMessageLoading(true);
    draftMessage(buyerId, entityType, selectedDocuments.map((d) => d.title), formData.priority, formData.dueDate || null)
      .then((result) => {
        if (cancelled) return;
        setAiMessage(result?.message || '');
        setMessageLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerId, entityType, selectedDocuments.length]);

  const suggestedMessage = aiMessage || FALLBACK_MESSAGE;

  const copySummary = async () => {
    const summary =
      `Request: ${selectedDocuments.length} document(s) from ${formData.suppliers.length} supplier(s), ` +
      `${formData.priority} priority${formData.dueDate ? `, due ${format(new Date(formData.dueDate), 'MMM d, yyyy')}` : ''}.\n\n` +
      `Message: ${suggestedMessage}`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className={`${cardClass} ${cardPadClass} space-y-3`}>
      <div className="flex items-center gap-2">
        <Sparkles className={`${inlineIconClass} text-primary`} />
        <p className={sectionLabelClass}>AI summary</p>
      </div>

      <p className={`${mutedBodyClass} text-small`}>
        You are about to request{' '}
        <span className="font-medium text-foreground">{selectedDocuments.length} document{selectedDocuments.length === 1 ? '' : 's'}</span> from{' '}
        <span className="font-medium text-foreground">{formData.suppliers.length} supplier{formData.suppliers.length === 1 ? '' : 's'}</span> at{' '}
        <span className="font-medium capitalize text-foreground">{formData.priority}</span> priority
        {daysUntilDue ? <>, due in <span className="font-medium text-foreground">{daysUntilDue}</span> days.</> : ', with no due date.'}
      </p>

      <div className="border-t border-border pt-3">
        <p className="text-caption font-medium uppercase tracking-[0.06em] text-muted-foreground">Suggested message</p>
        <p className="mt-1.5 text-small text-foreground/90">
          {messageLoading ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting…
            </span>
          ) : (
            suggestedMessage
          )}
        </p>
      </div>

      <div className="space-y-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={loadMessage}
          disabled={messageLoading || !buyerId}
          className="w-full justify-start"
        >
          {messageLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
          Regenerate message
        </Button>
        <Button variant="outline" size="sm" onClick={copySummary} className="w-full justify-start">
          {copied ? <Check className="mr-2 h-3.5 w-3.5 text-success" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy summary'}
        </Button>
      </div>
    </div>
  );
};

const RequestReviewStep = ({
  selectedDocuments,
  formData,
  buyerId,
  sampleDocument,
  setSampleDocument
}: RequestReviewStepProps) => {

  // Inline preview for a device-uploaded reference sample (we hold the File
  // object, so no storage round-trip is needed).
  const devicePreviewUrl = useMemo(() => {
    if (sampleDocument?.source === 'device' && sampleDocument.file) {
      return URL.createObjectURL(sampleDocument.file);
    }
    return null;
  }, [sampleDocument]);

  useEffect(() => {
    return () => { if (devicePreviewUrl) URL.revokeObjectURL(devicePreviewUrl); };
  }, [devicePreviewUrl]);

  const sampleName = sampleDocument?.source === 'device'
    ? sampleDocument.file?.name
    : sampleDocument?.libraryDoc?.document_name;
  const sampleMime = (sampleDocument?.source === 'device'
    ? sampleDocument.file?.type
    : sampleDocument?.libraryDoc?.mime_type) || '';
  const isImage = sampleMime.startsWith('image/');
  const isPdf = sampleMime === 'application/pdf';

  const detailCells: Array<{ icon: typeof Users; label: string; value: ReactNode }> = [
    { icon: Users, label: 'Suppliers', value: `${formData.suppliers.length} selected` },
    { icon: Flag, label: 'Priority', value: <span className="capitalize">{formData.priority}</span> },
    { icon: CalendarIcon, label: 'Due date', value: formData.dueDate ? format(new Date(formData.dueDate), 'MMM d, yyyy') : 'Not set' },
  ];

  return (
    <div className="space-y-4">

      {/* Selected documents */}
      <div className={cardClass}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <p className={sectionLabelClass}>Selected documents</p>
          <span className={pillAccentClass}>{selectedDocuments.length} selected</span>
        </div>
        <div className={cardPadClass}>
          <div className="flex flex-wrap gap-2">
            {selectedDocuments.map(doc => (
              <span key={doc.id} className={`${pillClass} gap-1.5`}>
                <FileText className="h-3 w-3" />
                {doc.title}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Recipients & details */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-border px-5 py-3.5">
          <p className={sectionLabelClass}>Recipients &amp; details</p>
        </div>
        <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
          {detailCells.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex-1 p-5">
              <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                <Icon className={inlineIconClass} />
                <span className="text-caption font-medium">{label}</span>
              </div>
              <div className="text-body font-semibold text-foreground">{value}</div>
            </div>
          ))}
          <div className="flex-[1.5] p-5">
            <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
              <MessageSquare className={inlineIconClass} />
              <span className="text-caption font-medium">Instructions</span>
            </div>
            <div className="line-clamp-2 text-small text-foreground/90">
              {formData.notes || 'No additional instructions provided.'}
            </div>
          </div>
        </div>
      </div>

      {/* Reference sample */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Paperclip className={`${inlineIconClass} text-muted-foreground`} />
          <p className={sectionLabelClass}>Reference sample <span className="font-normal normal-case tracking-normal">(optional)</span></p>
        </div>
        <div className={`${cardPadClass} space-y-4`}>
          {buyerId && (
            <SampleDocumentUpload
              buyerId={buyerId}
              currentSample={sampleDocument}
              onSampleChange={setSampleDocument}
            />
          )}

          {/* Inline preview so buyers can confirm the right reference before sending. */}
          {sampleName && (
            <div className="overflow-hidden rounded-control border border-border">
              <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-small font-medium text-foreground">{sampleName}</span>
                </div>
                <span className="shrink-0 text-caption text-muted-foreground">Reference preview</span>
              </div>
              {devicePreviewUrl && isImage ? (
                <img src={devicePreviewUrl} alt={sampleName} className="max-h-[320px] w-full bg-background object-contain" />
              ) : devicePreviewUrl && isPdf ? (
                <object data={devicePreviewUrl} type="application/pdf" className="h-[360px] w-full bg-background">
                  <div className="p-4 text-small text-muted-foreground">Preview unavailable — {sampleName}</div>
                </object>
              ) : (
                <div className="flex items-center gap-2 p-4 text-small text-muted-foreground">
                  <FileText className={inlineIconClass} />
                  {sampleDocument?.source === 'library'
                    ? 'Selected from library — preview opens after the request is created.'
                    : 'No inline preview for this file type.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default RequestReviewStep;
