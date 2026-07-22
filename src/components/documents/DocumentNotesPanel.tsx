/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as any;

interface NoteRow {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

function initials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email ?? '??').slice(0, 2).toUpperCase();
}

function avatarColor(authorId: string): string {
  const palette = [
    'bg-primary/15 text-primary',
    'bg-primary/15 text-primary',
    'bg-success/15 text-success',
    'bg-warning/15 text-warning',
    'bg-danger/15 text-danger',
    'bg-primary/15 text-primary',
    'bg-fuchsia-100 text-fuchsia-700',
  ];
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) hash = (hash * 31 + authorId.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export interface DocumentNotesPanelProps {
  documentId: string;
}

export default function DocumentNotesPanel({ documentId }: DocumentNotesPanelProps) {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from('document_request_notes')
      .select('id, body, created_at, author_id, profiles(full_name, email)')
      .eq('request_id', documentId)
      .order('created_at', { ascending: true });
    if (error) {
      toast.error('Could not load notes');
    } else {
      setNotes(data ?? []);
    }
    setLoading(false);
  }, [documentId]);

  useEffect(() => { void load(); }, [load]);

  // Scroll to bottom when notes load or new note arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes.length]);

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await db.from('document_request_notes').insert({
        request_id: documentId,
        author_id: user.id,
        body,
      });
      if (error) throw error;
      setDraft('');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Could not save note');
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="flex w-[360px] flex-shrink-0 flex-col border-l border-border bg-card">
      {/* Panel header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
        <StickyNote className="h-4 w-4 text-warning" />
        <p className="text-body font-bold text-foreground">Notes</p>
        {notes.length > 0 && (
          <span className="ml-auto rounded-full bg-warning/15 px-2 py-0.5 text-micro font-semibold text-warning">
            {notes.length}
          </span>
        )}
      </div>

      {/* Notes feed */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <StickyNote className="h-5 w-5 text-warning" />
            </div>
            <p className="text-small font-medium text-foreground/80">No notes yet</p>
            <p className="text-caption text-muted-foreground/70">Add the first note to keep a record of observations or decisions.</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-border p-4 pb-2">
            {notes.map((note) => {
              const name = note.profiles?.full_name ?? null;
              const email = note.profiles?.email ?? null;
              const ini = initials(name, email);
              const color = avatarColor(note.author_id);
              return (
                <div key={note.id} className="group flex gap-3 py-4 first:pt-0">
                  {/* Avatar */}
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-caption font-bold ${color}`}>
                    {ini}
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* Name + time */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-small font-semibold text-foreground truncate">{name || email || 'Unknown'}</span>
                      <span className="flex-shrink-0 text-micro text-muted-foreground/70">{relativeTime(note.created_at)}</span>
                    </div>
                    {/* Body */}
                    <p className="mt-1 text-small leading-[1.5] text-foreground/80 whitespace-pre-wrap break-words">{note.body}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Compose area */}
      <div className="border-t border-border p-3">
        <div className="relative rounded-[12px] border border-border bg-muted transition-colors focus-within:border-warning focus-within:bg-card focus-within:shadow-[0_0_0_3px_rgba(251,191,36,0.12)]">
          <Textarea
            placeholder="Add a note… (⌘↵ to send)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            maxLength={2000}
            className="resize-none rounded-[12px] border-0 bg-transparent px-3 pt-3 pb-10 text-small text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-0 shadow-none"
          />
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
            {draft.length > 0 && (
              <span className="text-micro text-muted-foreground/70 tabular-nums">{draft.length}/2000</span>
            )}
            <Button
              size="icon"
              className="h-7 w-7 rounded-[8px] bg-warning text-white hover:bg-warning disabled:opacity-40"
              disabled={!draft.trim() || submitting}
              onClick={() => void submit()}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
