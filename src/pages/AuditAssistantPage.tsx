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
  Compass, FileSearch, ShieldAlert, FilePlus, ListChecks, Download, ListTodo,
  PanelRightClose, PanelRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import { FindingsPanel } from '@/components/audit/FindingsPanel';
import { EvidencePanel } from '@/components/audit/EvidencePanel';
import auditLogo from '@/assets/audit-assistant-logo.png';

// Framer motion variants
const easeOut = [0.16, 1, 0.3, 1] as const;
const fadeInUp = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } }
};
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } }
};

type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string };

const QUICK_PROMPTS = [
  {
    icon: ListTodo,
    title: 'Pending Tasks Today',
    desc: 'Get a neatly organized list of pending items and deadlines.',
    prompt: 'What are all the pending tasks today? Please give me a neatly displayed, prioritized list of all pending document requests, missing evidence, and open findings. Use a clear markdown structure with status indicators (like emojis or checkboxes) so I know exactly what needs my attention today.',
  },
  {
    icon: Compass,
    title: 'Statutory & CARO',
    desc: 'Check Companies Act 2013 and CARO 2020 compliance gaps.',
    prompt: 'Review the evidence and identify any compliance gaps under the Companies Act 2013 and CARO 2020.',
  },
  {
    icon: FileSearch,
    title: 'GST & Tax Audit',
    desc: 'Verify GST returns, reconciliations, and Tax Audit (Sec 44AB) requirements.',
    prompt: 'List missing or expired documents related to GST compliance, reconciliations, and Income Tax Act requirements.',
  },
  {
    icon: ListChecks,
    title: 'Internal Audit (IFC)',
    desc: 'Assess Internal Financial Controls and operational process gaps.',
    prompt: 'Analyze the current evidence to assess the effectiveness of Internal Financial Controls (IFC) and highlight operational risks.',
  },
  {
    icon: ShieldAlert,
    title: 'Secretarial & ROC',
    desc: 'Check board minutes, ROC filings, and SEBI LODR (if applicable).',
    prompt: 'Summarize the compliance posture regarding Secretarial Audit, ROC filings, and board meeting documentation.',
  },
  {
    icon: FilePlus,
    title: 'Draft Findings',
    desc: 'Auto-draft non-compliance findings with specific clause references.',
    prompt: 'Draft 3 critical audit findings based on missing evidence, citing specific Indian framework clauses (e.g., CARO, GST Act, or ICAI SAs).',
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
  const [showRightPanel, setShowRightPanel] = useState(true);
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
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort('Request timed out.'), 90000);
      const res = await fetch(`/api/functions/audit-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages.map(m => ({ id: m.id, role: m.role, parts: [{ type: 'text', text: m.content }] })),
          clientId: clientId || undefined,
          engagementId: engagementId || undefined,
        }),
      });
      window.clearTimeout(timeout);
      const raw = await res.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-json */ }
      if (!res.ok) {
        throw new Error(data?.error || raw || `HTTP ${res.status}`);
      }
      const text = (data?.text || '').toString();
      if (!text.trim()) {
        throw new Error('The assistant returned an empty response. Please try again.');
      }
      setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: text } : m));
    } catch (e: any) {
      toast({ title: 'AI error', description: e?.message?.slice(0, 200) || 'Failed to get response' });
      setMessages(prev => prev.filter(m => m.id !== assistantMsg.id));
    } finally {
      setStreaming(false);
    }
  };

  const generateReport = async () => {
    if (!clientId || !buyerId) {
      toast({ title: 'Pick a client first' });
      return;
    }
    setGeneratingReport(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/functions/generate-audit-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ buyerId, clientId, engagementId: engagementId || undefined }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* non-json */ }
      if (!res.ok) {
        throw new Error(data?.error || text || `HTTP ${res.status}`);
      }
      if (data?.url) {
        setReportUrl(data.url);
        setReportAt(new Date());
        toast({ title: 'Report generated', description: `${data.findings ?? 0} findings included.` });
      } else {
        throw new Error('No report URL returned');
      }
    } catch (e: any) {
      toast({
        title: 'Report failed',
        description: e?.message?.slice(0, 200) || 'Unknown error',
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleCreateFinding = async (title: string, recommendation: string, severity: string) => {
    if (!buyerId || !clientId) {
      toast({ title: 'Missing client context', variant: 'destructive' });
      return;
    }
    
    let mappedSeverity = 'Minor';
    const s = severity.toLowerCase();
    if (s.includes('high') || s.includes('critical')) mappedSeverity = 'Critical';
    else if (s.includes('med') || s.includes('major')) mappedSeverity = 'Major';

    const { error } = await supabase.from('audit_findings').insert({
      buyer_id: buyerId,
      supplier_id: clientId,
      engagement_id: engagementId || null,
      title: title.trim().slice(0, 200),
      recommendation: recommendation.trim(),
      severity: mappedSeverity,
      status: 'Open',
      finding_date: new Date().toISOString().slice(0, 10),
      created_by: user?.id,
    });

    if (error) {
      toast({ title: 'Error saving finding', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Finding created', description: title });
      // remove the match from the UI state so it can't be clicked twice? It's fine for now.
    }
  };

  return (
    <div className="theme-minimalist h-screen flex flex-col bg-background font-sans">
      {/* HEADER */}
      <header className="h-16 border-b border-border/60 bg-card/80 backdrop-blur-md px-6 flex items-center gap-4 shrink-0 z-10 shadow-subtle">
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
          <div className="w-px h-5 bg-border mx-2" />
          <Button variant="ghost" size="icon" onClick={() => setShowRightPanel(p => !p)} title="Toggle Right Panel">
            {showRightPanel ? <PanelRightClose className="h-4 w-4 text-muted-foreground" /> : <PanelRight className="h-4 w-4 text-muted-foreground" />}
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-12 overflow-hidden">
        {/* LEFT */}
        <aside className="col-span-3 min-h-0 border-r bg-card overflow-y-auto">
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

            <div className="pt-4">
              <div className="mb-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-accent font-medium">
                    Suggested actions
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Tap to run with the selected context.</p>
              </div>
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                  {QUICK_PROMPTS.map(({ icon: Icon, title, desc, prompt }, i) => (
                    <motion.button
                      key={i}
                      variants={fadeInUp}
                      onClick={() => sendMessage(prompt)}
                      disabled={streaming || !clientId}
                      className="group w-full text-left p-3 rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-accent-secondary text-white flex items-center justify-center shrink-0 shadow-accent">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">{title}</div>
                          <div className="text-xs text-muted-foreground mt-1 leading-snug">{desc}</div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
            </div>
          </div>
        </aside>

        {/* CENTER */}
        <main className={`min-h-0 min-w-0 flex flex-col bg-background relative transition-all duration-300 ${showRightPanel ? 'col-span-6' : 'col-span-9'}`}>
          {/* Subtle dot pattern background for texture */}
          <div className="absolute inset-0 pointer-events-none dot-pattern opacity-40 mix-blend-multiply" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain relative z-10">
            <div className="px-8 py-10">
              {messages.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut }} className="max-w-xl mx-auto text-center py-16">
                  <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-accent/10 to-transparent mb-6 shadow-sm ring-1 ring-accent/10">
                    <img src={auditLogo} alt="" width={48} height={48} className="opacity-90" />
                  </div>
                  <h2 className="text-4xl font-display font-medium text-foreground tracking-tight leading-tight">
                    How can I help with <span className="gradient-text italic">this audit?</span>
                  </h2>
                  <p className="text-base text-muted-foreground mt-4 max-w-md mx-auto leading-relaxed">
                    Pick a client, then ask about engagement planning, evidence gaps, findings, or Indian &amp; global audit frameworks.
                  </p>
                  <div className="mt-10 flex flex-wrap gap-3 justify-center">
                    {QUICK_PROMPTS.slice(0, 3).map((p, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(p.prompt)}
                        disabled={!clientId}
                        className="text-sm px-4 py-2 rounded-full border border-border bg-card shadow-sm hover:shadow-md hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-40"
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-6 max-w-3xl mx-auto">
                  {messages.map((m, index) => {
                    const rawContent = m.content || '';
                    const createMatches = [...rawContent.matchAll(/\[CREATE_FINDING:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^\]]+)\]/g)];
                    const displayContent = rawContent.replace(/\[CREATE_FINDING:[^\]]+\]/g, '').trim();

                    return (
                      <motion.div 
                        key={m.id} 
                        initial={{ opacity: 0, y: 15 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ duration: 0.4, ease: easeOut }}
                        className={m.role === 'user' ? 'flex justify-end' : 'space-y-4'}
                      >
                        {m.role === 'user' ? (
                          <div className="bg-gradient-accent text-white shadow-accent rounded-2xl rounded-tr-sm px-5 py-3 max-w-[85%] text-[15px] leading-relaxed">
                            {displayContent}
                          </div>
                        ) : (
                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 mt-1">
                              <img src={auditLogo} alt="AI" className="w-5 h-5 opacity-80" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-4">
                              <div className="prose prose-sm md:prose-base prose-slate dark:prose-invert max-w-none overflow-x-auto text-foreground/90 leading-relaxed
                                prose-p:leading-relaxed prose-pre:bg-muted prose-pre:border
                                prose-th:border prose-th:bg-muted/50 prose-th:p-2 prose-th:text-left
                                prose-td:border prose-td:p-2 prose-table:w-full prose-table:border-collapse
                                prose-li:my-0.5">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent || '_Thinking\u2026_'}</ReactMarkdown>
                              </div>
                              {createMatches.length > 0 && (
                                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-3 mt-6 pt-5 border-t border-border/60">
                                  <div className="inline-flex items-center gap-2">
                                    <span className="font-mono text-[10px] uppercase tracking-wider text-accent font-semibold">Actionable Insights</span>
                                    <div className="h-px flex-1 bg-gradient-to-r from-accent/20 to-transparent" />
                                  </div>
                                  {createMatches.map((match, idx) => {
                                    const [_, title, rec, sev] = match;
                                    return (
                                      <div key={idx} className="bg-card border border-border shadow-sm hover:shadow-md hover:border-accent/40 transition-all rounded-xl p-4 text-sm flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                          <div className="font-semibold text-foreground flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-accent" />
                                            {title.trim()}
                                            <Badge variant="secondary" className="text-[10px] uppercase font-mono tracking-wider">{sev.trim()}</Badge>
                                          </div>
                                          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{rec.trim()}</p>
                                        </div>
                                        <Button 
                                          size="sm" 
                                          className="shrink-0 bg-gradient-accent text-white shadow-sm hover:shadow-accent hover:-translate-y-0.5 transition-all" 
                                          onClick={() => handleCreateFinding(title, rec, sev)}
                                        >
                                          Save Finding
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                  {streaming && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-gradient-to-t from-background via-background to-transparent pt-12 relative z-20">
            <div className="max-w-3xl mx-auto">
              <div className="relative flex items-end bg-card shadow-lg shadow-accent/5 ring-1 ring-border rounded-3xl pl-5 pr-2 py-2 hover:shadow-xl hover:ring-border/80 transition-all focus-within:ring-accent/50 focus-within:shadow-accent/10">
                <Textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  placeholder={clientId ? 'Ask the Audit Assistant\u2026' : 'Pick a client to start\u2026'}
                  rows={1}
                  className="resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent py-2.5 min-h-0 flex-1 px-0 text-[15px] max-h-32"
                  disabled={streaming}
                />
                <Button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || streaming}
                  size="icon"
                  className="h-10 w-10 rounded-full shrink-0 ml-2 bg-foreground hover:bg-foreground/90 text-background shadow-sm mb-0.5"
                >
                  {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
                </Button>
              </div>
              <div className="text-[11px] text-muted-foreground mt-3 text-center font-medium">
                {activeClient ? `Asking about ${activeClient.company_name}${activeEngagement ? ` · ${activeEngagement.title}` : ''}` : 'Ask the Audit Assistant to analyze documents and draft findings.'}
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT */}
        <aside className={`min-h-0 border-l bg-card overflow-hidden flex flex-col transition-all duration-300 ${showRightPanel ? 'col-span-3 opacity-100' : 'hidden opacity-0'}`}>
          <Tabs defaultValue="evidence" className="h-full flex flex-col">
            <div className="p-3 border-b">
              <TabsList className="grid grid-cols-3 w-full h-9">
                <TabsTrigger value="evidence" className="text-xs gap-1"><FileText className="h-3 w-3" />Evidence</TabsTrigger>
                <TabsTrigger value="findings" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Findings</TabsTrigger>
                <TabsTrigger value="report" className="text-xs gap-1"><FileBarChart className="h-3 w-3" />Report</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
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
