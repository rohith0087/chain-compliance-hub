import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBuyerSetup } from '@/hooks/useBuyerSetup';
import { useBuyerSupplierConnections } from '@/hooks/useBuyerSupplierConnections';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, FileText, AlertTriangle, FileBarChart, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { FindingsPanel } from '@/components/audit/FindingsPanel';
import { EvidencePanel } from '@/components/audit/EvidencePanel';

type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string };

const QUICK_PROMPTS = [
  'Draft an engagement plan for this client based on their industry and CARO 2020 + ISO 27001.',
  'List all missing or expired evidence for the active engagement.',
  'Generate a risk matrix from current evidence and findings.',
  'Draft 3 audit findings for the most critical gaps with framework references.',
  'Summarize this client\'s compliance posture in 5 bullet points.',
];

export default function AuditAssistantPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getBuyerProfile } = useBuyerSetup();
  const { toast } = useToast();

  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>('');
  const [engagementId, setEngagementId] = useState<string>('');
  const [engagements, setEngagements] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { connections, loading: connLoading } = useBuyerSupplierConnections(buyerId ?? undefined);

  useEffect(() => {
    (async () => {
      const p = await getBuyerProfile();
      if (p?.id) setBuyerId(p.id);
    })();
  }, [user]);

  useEffect(() => {
    if (!clientId || !buyerId) { setEngagements([]); setEngagementId(''); return; }
    supabase.from('document_requests')
      .select('id, title, status, due_date, created_at')
      .eq('buyer_id', buyerId).eq('supplier_id', clientId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEngagements(data ?? []));
  }, [clientId, buyerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  const activeClient = useMemo(() => connections.find(c => c.supplier_id === clientId)?.supplier, [connections, clientId]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: 'user', content: text };
    const assistantMsg: ChatMsg = { id: crypto.randomUUID(), role: 'assistant', content: '' };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, assistantMsg]);
    setInput('');
    setStreaming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ id: m.id, role: m.role, parts: [{ type: 'text', text: m.content }] })),
          clientId: clientId || undefined,
          engagementId: engagementId || undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === 'text-delta' && evt.delta) {
              acc += evt.delta;
              setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: acc } : m));
            } else if (evt.type === 'tool-input-available' && evt.toolName) {
              acc += `\n\n_🔧 Using ${evt.toolName}..._\n`;
              setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: acc } : m));
            }
          } catch { /* ignore non-JSON */ }
        }
      }
    } catch (e: any) {
      toast({ title: 'AI error', description: e.message || 'Failed to stream response', variant: 'destructive' });
      setMessages(prev => prev.filter(m => m.id !== assistantMsg.id));
    } finally {
      setStreaming(false);
    }
  };

  const generateReport = async () => {
    if (!clientId || !buyerId) {
      toast({ title: 'Pick a client first', variant: 'destructive' });
      return;
    }
    setGeneratingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-audit-report', {
        body: { buyerId, clientId, engagementId: engagementId || undefined },
      });
      if (error) throw error;
      if (data?.url) {
        setReportUrl(data.url);
        toast({ title: 'Report generated', description: `${data.findings ?? 0} findings included.` });
      }
    } catch (e: any) {
      toast({ title: 'Report failed', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}><ArrowLeft className="h-4 w-4" /></Button>
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="font-semibold">Audit Assistant</h1>
        {activeClient && <Badge variant="outline">{activeClient.company_name}</Badge>}
        {engagementId && <Badge variant="secondary">{engagements.find(e => e.id === engagementId)?.title}</Badge>}
      </header>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* LEFT */}
        <aside className="col-span-3 border-r p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Client</label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder={connLoading ? 'Loading…' : 'Select client'} /></SelectTrigger>
              <SelectContent>
                {connections.map(c => (
                  <SelectItem key={c.supplier_id} value={c.supplier_id}>{c.supplier?.company_name ?? 'Unknown'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Engagement</label>
            <Select value={engagementId} onValueChange={setEngagementId} disabled={!clientId}>
              <SelectTrigger><SelectValue placeholder={!clientId ? 'Pick a client first' : engagements.length ? 'Select engagement' : 'No engagements'} /></SelectTrigger>
              <SelectContent>
                {engagements.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="p-3 space-y-1">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Context</div>
            <div className="text-sm">{activeClient?.company_name ?? 'No client'}</div>
            <div className="text-xs text-muted-foreground">{activeClient?.industry ?? '—'}</div>
          </Card>

          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Quick prompts</div>
            <div className="space-y-1.5">
              {QUICK_PROMPTS.map((p, i) => (
                <button key={i} onClick={() => sendMessage(p)} disabled={streaming}
                  className="w-full text-left text-xs p-2 rounded border hover:bg-muted/50 transition disabled:opacity-50">
                  {p}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER chat */}
        <main className="col-span-6 flex flex-col border-r">
          <ScrollArea className="flex-1 p-6" ref={scrollRef as any}>
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-16">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary/40" />
                <p className="text-sm">Pick a client and ask anything — engagement planning, evidence gaps, findings, Indian + global audit frameworks.</p>
              </div>
            )}
            <div className="space-y-4 max-w-2xl mx-auto">
              {messages.map(m => (
                <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
                  <div className={m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%]'
                    : 'prose prose-sm dark:prose-invert max-w-none'}>
                    {m.role === 'assistant' ? <ReactMarkdown>{m.content || '_Thinking…_'}</ReactMarkdown> : m.content}
                  </div>
                </div>
              ))}
              {streaming && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Streaming…</div>}
            </div>
          </ScrollArea>
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={clientId ? 'Ask the Audit Assistant…' : 'Pick a client to start…'}
                rows={2} className="resize-none" disabled={streaming} />
              <Button onClick={() => sendMessage(input)} disabled={!input.trim() || streaming} size="icon">
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </main>

        {/* RIGHT */}
        <aside className="col-span-3 overflow-y-auto">
          <Tabs defaultValue="evidence" className="h-full flex flex-col">
            <TabsList className="m-2">
              <TabsTrigger value="evidence" className="text-xs"><FileText className="h-3 w-3 mr-1" />Evidence</TabsTrigger>
              <TabsTrigger value="findings" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Findings</TabsTrigger>
              <TabsTrigger value="report" className="text-xs"><FileBarChart className="h-3 w-3 mr-1" />Report</TabsTrigger>
            </TabsList>
            <TabsContent value="evidence" className="flex-1 px-3 pb-3 mt-0">
              {clientId ? <EvidencePanel buyerId={buyerId!} clientId={clientId} engagementId={engagementId || undefined} /> : <Skeleton className="h-40" />}
            </TabsContent>
            <TabsContent value="findings" className="flex-1 px-3 pb-3 mt-0">
              {clientId ? <FindingsPanel supplierId={clientId} engagementId={engagementId || undefined} /> : <p className="text-xs text-muted-foreground p-2">Select a client.</p>}
            </TabsContent>
            <TabsContent value="report" className="flex-1 px-3 pb-3 mt-0 space-y-2">
              <Button onClick={generateReport} disabled={!clientId || generatingReport} className="w-full">
                {generatingReport ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileBarChart className="h-4 w-4 mr-2" />}
                Generate Audit Report (PDF)
              </Button>
              {reportUrl && (
                <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <Card className="p-3 hover:bg-muted/50 transition cursor-pointer">
                    <div className="text-sm font-medium">📄 Latest audit report</div>
                    <div className="text-xs text-muted-foreground">Click to open in new tab</div>
                  </Card>
                </a>
              )}
              <p className="text-xs text-muted-foreground p-2">Report includes: cover, executive summary, scope &amp; methodology, all saved findings (with framework refs), and evidence appendix.</p>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
