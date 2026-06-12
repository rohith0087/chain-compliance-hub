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
import {
  ArrowLeft, Send, FileText, AlertTriangle, FileBarChart, Loader2,
  Compass, FileSearch, ShieldAlert, FilePlus, ListChecks, Download,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { FindingsPanel } from '@/components/audit/FindingsPanel';
import { EvidencePanel } from '@/components/audit/EvidencePanel';
import auditLogo from '@/assets/audit-assistant-logo.png';

type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string };

const QUICK_PROMPTS = [
  {
    icon: Compass,
    title: 'Engagement plan',
    desc: 'Draft a plan mapped to CARO 2020 + ISO 27001 for this client.',
    prompt: 'Draft an engagement plan for this client based on their industry and CARO 2020 + ISO 27001.',
  },
  {
    icon: FileSearch,
    title: 'Evidence gaps',
    desc: 'List missing or expired documents for the active engagement.',
    prompt: 'List all missing or expired evidence for the active engagement.',
  },
  {
    icon: ShieldAlert,
    title: 'Risk matrix',
    desc: 'Generate a risk matrix from current evidence and findings.',
    prompt: 'Generate a risk matrix from current evidence and findings.',
  },
  {
    icon: FilePlus,
    title: 'Draft findings',
    desc: 'Write 3 findings for the most critical gaps with clause refs.',
    prompt: 'Draft 3 audit findings for the most critical gaps with framework references.',
  },
  {
    icon: ListChecks,
    title: 'Compliance posture',
    desc: 'Summarize this client\u2019s posture in 5 concise bullets.',
    prompt: "Summarize this client's compliance posture in 5 bullet points.",
  },
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
  const [reportAt, setReportAt] = useState<Date | null>(null);
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
  const activeEngagement = useMemo(() => engagements.find(e => e.id === engagementId), [engagements, engagementId]);

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
              acc += `\n\n_Using ${evt.toolName}\u2026_\n`;
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
        setReportAt(new Date());
        toast({ title: 'Report generated', description: `${data.findings ?? 0} findings included.` });
      }
    } catch (e: any) {
      toast({ title: 'Report failed', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-muted/30">
      {/* HEADER */}
      <header className="h-14 border-b bg-card px-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <img src={auditLogo} alt="Audit Assistant" width={28} height={28} className="rounded-md" />
          <div>
            <h1 className="text-sm font-semibold leading-tight">Audit Assistant</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">Plan, review &amp; report</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {activeClient && (
            <Badge variant="outline" className="font-normal">
              {activeClient.company_name}
            </Badge>
          )}
          {activeEngagement && (
            <Badge variant="secondary" className="font-normal">
              {activeEngagement.title}
            </Badge>
          )}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* LEFT */}
        <aside className="col-span-3 border-r bg-card overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Client</label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-9"><SelectValue placeholder={connLoading ? 'Loading\u2026' : 'Select client'} /></SelectTrigger>
                <SelectContent>
                  {connections.map(c => (
                    <SelectItem key={c.supplier_id} value={c.supplier_id}>{c.supplier?.company_name ?? 'Unknown'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Engagement</label>
              <Select value={engagementId} onValueChange={setEngagementId} disabled={!clientId}>
                <SelectTrigger className="h-9"><SelectValue placeholder={!clientId ? 'Pick a client first' : engagements.length ? 'Select engagement' : 'No engagements'} /></SelectTrigger>
                <SelectContent>
                  {engagements.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeClient && (
              <Card className="p-3 space-y-2 bg-muted/40 border-dashed">
                <div className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Context</div>
                <div className="text-sm font-medium">{activeClient.company_name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {activeClient.industry && <Badge variant="outline" className="text-[10px] font-normal">{activeClient.industry}</Badge>}
                  {activeEngagement?.status && <Badge variant="secondary" className="text-[10px] font-normal capitalize">{activeEngagement.status}</Badge>}
                </div>
              </Card>
            )}

            <div className="pt-2">
              <div className="mb-2">
                <div className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wide">Suggested actions</div>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">Tap to run with the selected context.</p>
              </div>
              <div className="space-y-1.5">
                {QUICK_PROMPTS.map(({ icon: Icon, title, desc, prompt }, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt)}
                    disabled={streaming || !clientId}
                    className="group w-full text-left p-2.5 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-accent/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/15">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold leading-tight">{title}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER */}
        <main className="col-span-6 flex flex-col bg-background">
          <ScrollArea className="flex-1" ref={scrollRef as any}>
            <div className="px-8 py-6">
              {messages.length === 0 ? (
                <div className="max-w-xl mx-auto text-center py-12">
                  <img src={auditLogo} alt="" width={72} height={72} className="mx-auto mb-4 opacity-90" />
                  <h2 className="text-lg font-semibold">How can I help with this audit?</h2>
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                    Pick a client, then ask about engagement planning, evidence gaps, findings, or Indian &amp; global audit frameworks.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 justify-center">
                    {QUICK_PROMPTS.slice(0, 3).map((p, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(p.prompt)}
                        disabled={!clientId}
                        className="text-xs px-3 py-1.5 rounded-full border bg-card hover:border-primary/40 hover:bg-accent/30 transition disabled:opacity-40"
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5 max-w-2xl mx-auto">
                  {messages.map(m => (
                    <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
                      {m.role === 'user' ? (
                        <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%] text-sm">
                          {m.content}
                        </div>
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{m.content || '_Thinking\u2026_'}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ))}
                  {streaming && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t bg-card p-3">
            <div className="max-w-2xl mx-auto">
              {activeClient && (
                <div className="text-[11px] text-muted-foreground mb-1.5 px-1">
                  Asking about <span className="font-medium text-foreground">{activeClient.company_name}</span>
                  {activeEngagement && <> &middot; <span className="font-medium text-foreground">{activeEngagement.title}</span></>}
                </div>
              )}
              <div className="relative">
                <Textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  placeholder={clientId ? 'Ask the Audit Assistant\u2026' : 'Pick a client to start\u2026'}
                  rows={2}
                  className="resize-none pr-12 rounded-xl"
                  disabled={streaming}
                />
                <Button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || streaming}
                  size="icon"
                  className="absolute bottom-2 right-2 h-8 w-8 rounded-lg"
                >
                  {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5 px-1">Enter to send, Shift+Enter for new line</div>
            </div>
          </div>
        </main>

        {/* RIGHT */}
        <aside className="col-span-3 border-l bg-card overflow-hidden flex flex-col">
          <Tabs defaultValue="evidence" className="h-full flex flex-col">
            <div className="p-3 border-b">
              <TabsList className="grid grid-cols-3 w-full h-9">
                <TabsTrigger value="evidence" className="text-xs gap-1"><FileText className="h-3 w-3" />Evidence</TabsTrigger>
                <TabsTrigger value="findings" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Findings</TabsTrigger>
                <TabsTrigger value="report" className="text-xs gap-1"><FileBarChart className="h-3 w-3" />Report</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TabsContent value="evidence" className="px-3 pb-3 mt-3">
                {clientId ? <EvidencePanel buyerId={buyerId!} clientId={clientId} engagementId={engagementId || undefined} /> : (
                  <div className="text-xs text-muted-foreground p-3 text-center">Select a client to view evidence.</div>
                )}
              </TabsContent>
              <TabsContent value="findings" className="px-3 pb-3 mt-3">
                {clientId ? <FindingsPanel supplierId={clientId} engagementId={engagementId || undefined} /> : (
                  <div className="text-xs text-muted-foreground p-3 text-center">Select a client to view findings.</div>
                )}
              </TabsContent>
              <TabsContent value="report" className="px-3 pb-3 mt-3 space-y-3">
                <Card className="p-4 space-y-3">
                  <div>
                    <div className="text-sm font-semibold">Audit report</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Cover, executive summary, scope, all saved findings with framework refs, and evidence appendix.
                    </p>
                  </div>
                  <Button onClick={generateReport} disabled={!clientId || generatingReport} className="w-full" size="sm">
                    {generatingReport ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileBarChart className="h-4 w-4 mr-2" />}
                    Generate PDF
                  </Button>
                </Card>

                {reportUrl && (
                  <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <Card className="p-3 hover:bg-accent/30 transition cursor-pointer flex items-center gap-3">
                      <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Download className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">Latest report</div>
                        <div className="text-[11px] text-muted-foreground">
                          {reportAt ? reportAt.toLocaleString() : 'Open in new tab'}
                        </div>
                      </div>
                    </Card>
                  </a>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
