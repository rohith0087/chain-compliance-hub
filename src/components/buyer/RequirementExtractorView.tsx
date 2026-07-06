import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, Sparkles, Upload, Wand2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  reviewCardContainerClass,
  reviewPageSubtitleClass,
  reviewPageTitleClass,
} from '@/components/documents/buyerReviewDesignSystem';

interface RequirementExtractorViewProps {
  buyerId: string;
}

interface DraftRow {
  id: string;
  source_name: string;
  requirement_statement: string;
  suggested_document_type: string | null;
  suggested_evidence_name: string | null;
  responsible_party: string | null;
  rationale: string | null;
  source_quote: string | null;
  ai_confidence: number | null;
  status: 'proposed' | 'accepted' | 'dismissed';
  created_at: string;
}

export default function RequirementExtractorView({ buyerId }: RequirementExtractorViewProps) {
  const [sourceName, setSourceName] = useState('');
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [tab, setTab] = useState<'proposed' | 'accepted' | 'dismissed'>('proposed');
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: loadError } = await (supabase as any).from('requirement_extraction_drafts')
        .select('*').eq('buyer_id', buyerId).eq('status', tab).order('created_at', { ascending: false }).limit(200);
      if (loadError) throw loadError;
      setDrafts((data || []) as DraftRow[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load drafts');
    } finally {
      setLoading(false);
    }
  }, [buyerId, tab]);

  useEffect(() => { void load(); }, [load]);

  const runExtraction = async () => {
    if (text.trim().length < 40) {
      toast.error('Paste at least a paragraph of the spec/standard to extract from.');
      return;
    }
    await invokeExtraction({ text });
  };

  const invokeExtraction = async (payload: { text?: string; storage_bucket?: string; storage_path?: string; mime_type?: string | null }) => {
    setExtracting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('extract-requirements-v1', {
        body: { buyer_id: buyerId, source_name: sourceName.trim() || 'Uploaded document', ...payload },
      });
      if (fnError) throw fnError;
      const count = (data as { extracted_count: number })?.extracted_count ?? 0;
      toast.success(`AI extracted ${count} requirement draft${count === 1 ? '' : 's'} for review.`);
      setText('');
      setTab('proposed');
      await load();
    } catch (extractError) {
      toast.error(extractError instanceof Error ? extractError.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast.error('File is too large (max 15MB).'); return; }
    if (!sourceName.trim()) setSourceName(file.name);
    setExtracting(true);
    try {
      const path = `spec-uploads/${buyerId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('compliance-documents').upload(path, file, {
        contentType: file.type || 'application/octet-stream', upsert: false,
      });
      if (upErr) throw upErr;
      await invokeExtraction({ storage_bucket: 'compliance-documents', storage_path: path, mime_type: file.type || null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
      setExtracting(false);
    }
  };

  const decide = async (draft: DraftRow, status: 'accepted' | 'dismissed') => {
    setActing(draft.id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any).from('requirement_extraction_drafts')
        .update({ status, decided_at: new Date().toISOString() }).eq('id', draft.id);
      if (updateError) throw updateError;
      await load();
    } catch (decideError) {
      toast.error(decideError instanceof Error ? decideError.message : 'Update failed');
    } finally {
      setActing(null);
    }
  };

  const sources = useMemo(() => [...new Set(drafts.map((d) => d.source_name))], [drafts]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={reviewPageTitleClass}>
          <Wand2 className="mr-2 inline h-7 w-7 text-primary" />
          Requirement Extractor
        </h1>
        <p className={reviewPageSubtitleClass}>
          Paste a customer specification, standard, or internal policy. AI drafts discrete,
          supplier-facing requirements with the evidence each needs — you review every one before it counts.
        </p>
      </div>

      <div className={`${reviewCardContainerClass} space-y-3 p-4`}>
        <Input
          placeholder="Source name (e.g. 'Acme Foods Supplier Spec 2026')"
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
        />
        <Textarea
          placeholder="Paste the spec / standard / policy text here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-40"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{text.length.toLocaleString()} characters · paste text or upload a PDF · AI proposes, you decide</span>
          <div className="flex gap-2">
            <label>
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv,application/pdf,text/plain"
                className="hidden"
                disabled={extracting}
                onChange={(e) => { void onFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
              />
              <Button variant="outline" asChild disabled={extracting}>
                <span className="cursor-pointer"><Upload className="mr-2 h-4 w-4" /> Upload document</span>
              </Button>
            </label>
            <Button onClick={() => void runExtraction()} disabled={extracting}>
              {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Extract requirements
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'proposed' | 'accepted' | 'dismissed')}>
        <TabsList>
          <TabsTrigger value="proposed">To review</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {sources.length > 1 && (
            <p className="text-xs text-muted-foreground">From {sources.length} sources</p>
          )}
          {drafts.map((draft) => (
            <div key={draft.id} className={`${reviewCardContainerClass} p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">{draft.source_name}</Badge>
                    {draft.responsible_party && <Badge variant="secondary" className="text-xs">{draft.responsible_party}</Badge>}
                    {draft.ai_confidence != null && (
                      <span className="text-xs text-muted-foreground">confidence {(Number(draft.ai_confidence) * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  <p className="mt-1 font-medium">{draft.requirement_statement}</p>
                  <p className="text-sm text-muted-foreground">
                    Evidence: {draft.suggested_evidence_name ?? draft.suggested_document_type ?? '—'}
                    {draft.suggested_document_type && <span className="ml-1 font-mono text-xs">({draft.suggested_document_type})</span>}
                  </p>
                  {draft.rationale && <p className="mt-1 text-xs text-muted-foreground">Why: {draft.rationale}</p>}
                  {draft.source_quote && <p className="mt-1 border-l-2 border-muted pl-2 text-xs italic text-muted-foreground">“{draft.source_quote}”</p>}
                </div>
                {draft.status === 'proposed' && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" disabled={acting === draft.id} onClick={() => void decide(draft, 'accepted')}>
                      <Check className="mr-1 h-4 w-4" /> Accept
                    </Button>
                    <Button size="sm" variant="ghost" disabled={acting === draft.id} onClick={() => void decide(draft, 'dismissed')}>
                      <X className="mr-1 h-4 w-4" /> Dismiss
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {drafts.length === 0 && (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              {tab === 'proposed' ? 'No drafts to review. Paste a document above and extract.' : `No ${tab} drafts.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
