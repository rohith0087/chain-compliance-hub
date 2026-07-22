import { useCallback, useEffect, useRef, useState } from 'react';
import MarkdownMessage from '@/components/chat/MarkdownMessage';
import ThinkingIndicator from '@/components/chat/ThinkingIndicator';
import { ExternalLink, FileSearch, FileText, ListChecks, Mail, Maximize2, Send, ShieldAlert, Sparkles, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTour } from '@/components/support/TourProvider';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { publicEnvironment } from '@/config/env';
import { StructuredResponseRenderer, hasStructuredContent } from '@/components/chat/structured';
import ComplianceEmailComposer from '@/components/chat/ComplianceEmailComposer';
import './FloatingComplianceAssistant.css';

interface QuickAction {
  id: string;
  label: string;
  icon: typeof FileSearch;
  tabs: string[];
}

const quickActions: QuickAction[] = [
  { id: 'overdue', label: 'Find overdue documents', icon: FileSearch, tabs: ['documents', 'document-activity', 'requests'] },
  { id: 'risk', label: 'Explain this supplier risk', icon: ShieldAlert, tabs: ['compliance', 'supplier-risk', 'compliance-decisions'] },
  { id: 'reminder', label: 'Draft supplier reminder', icon: Mail, tabs: ['documents', 'requests'] },
  { id: 'flags', label: 'Review AI verification flags', icon: ListChecks, tabs: ['compliance', 'compliance-decisions'] },
  { id: 'branch', label: 'Summarize this branch', icon: Sparkles, tabs: ['dashboard'] },
];

function getOrderedActions(activeTab: string | null): QuickAction[] {
  if (!activeTab) return quickActions;
  const matched = quickActions.filter((action) => action.tabs.includes(activeTab));
  const rest = quickActions.filter((action) => !action.tabs.includes(activeTab));
  return [...matched, ...rest];
}

// The model sometimes pads field-by-field answers with runs of <br/> tags or
// extra blank lines (habit carried over from its email-drafting instructions).
// Collapse those down to a single break so spacing is governed by CSS, not by
// however many breaks happened to come back in any given reply.
function normalizeAssistantText(text: string): string {
  return text
    .replace(/(<br\s*\/?>\s*){2,}/gi, '<br/>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const hiddenRoutes = ['/chat', '/audit-assistant'];

interface DocumentReference {
  id: string;
  title: string;
  supplier_name?: string;
  document_type?: string;
  status?: string;
  expiration_date?: string;
  file_path?: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  documents?: DocumentReference[];
}

interface EmailComposerState {
  drafts: Parameters<typeof ComplianceEmailComposer>[0]['drafts'];
  actionType: string;
}

interface CompanyInfo {
  id: string;
  type: 'buyer' | 'supplier';
  industry?: string | null;
}

export function FloatingComplianceAssistant() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { isRunning } = useTour();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const companyInfoRef = useRef<CompanyInfo | null>(null);
  const [companyResolved, setCompanyResolved] = useState(false);
  const [emailComposer, setEmailComposer] = useState<EmailComposerState | null>(null);
  // Anchor scroll to the question, not the bottom of a long streamed answer --
  // otherwise a long reply keeps yanking the view past where the user asked.
  const [pendingScrollToId, setPendingScrollToId] = useState<string | null>(null);

  const hidden = hiddenRoutes.some((route) => location.pathname.startsWith(route));

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    const launcher = launcherRef.current;
    if (!launcher || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let returnTimer: ReturnType<typeof setTimeout> | undefined;
    let animationFrame: number | undefined;

    const centerEyes = () => {
      launcher.style.setProperty('--assistant-eye-x', '0px');
      launcher.style.setProperty('--assistant-eye-y', '0px');
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;

      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const bounds = launcher.getBoundingClientRect();
        const deltaX = event.clientX - (bounds.left + bounds.width / 2);
        const deltaY = event.clientY - (bounds.top + bounds.height / 2);
        const distance = Math.hypot(deltaX, deltaY) || 1;

        launcher.style.setProperty('--assistant-eye-x', `${(deltaX / distance) * 4}px`);
        launcher.style.setProperty('--assistant-eye-y', `${(deltaY / distance) * 3}px`);
      });

      if (returnTimer !== undefined) clearTimeout(returnTimer);
      returnTimer = setTimeout(centerEyes, 700);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('blur', centerEyes);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('blur', centerEyes);
      if (returnTimer !== undefined) clearTimeout(returnTimer);
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    };
  }, []);

  // Resolve the buyer/supplier identity once, the first time the panel is
  // opened -- mirrors ChatPage.tsx's own owner -> team-member lookup so the
  // mini chat and the full page agree on who's asking.
  useEffect(() => {
    if (!open || companyResolved || !user) return;
    let active = true;

    const resolve = async () => {
      try {
        const { data: buyer } = await supabase.from('buyers').select('id, industry').eq('profile_id', user.id).maybeSingle();
        if (buyer) {
          if (active) { companyInfoRef.current = { id: buyer.id, type: 'buyer', industry: buyer.industry }; setCompanyResolved(true); }
          return;
        }
        const { data: supplier } = await supabase.from('suppliers').select('id, industry').eq('profile_id', user.id).maybeSingle();
        if (supplier) {
          if (active) { companyInfoRef.current = { id: supplier.id, type: 'supplier', industry: supplier.industry }; setCompanyResolved(true); }
          return;
        }
        const { data: companyUser } = await supabase.from('company_users').select('company_id, company_type').eq('profile_id', user.id).eq('status', 'active').maybeSingle();
        if (companyUser) {
          const table = companyUser.company_type === 'buyer' ? 'buyers' : 'suppliers';
          const { data: teamCompany } = await supabase.from(table).select('id, industry').eq('id', companyUser.company_id).single();
          if (teamCompany && active) {
            companyInfoRef.current = { id: teamCompany.id, type: companyUser.company_type as 'buyer' | 'supplier', industry: teamCompany.industry };
            setCompanyResolved(true);
          }
        }
      } catch (error) {
        console.error('compliance-assistant: failed to resolve company', error);
      }
    };
    void resolve();
    return () => { active = false; };
  }, [open, companyResolved, user]);

  useEffect(() => {
    if (!pendingScrollToId) return;
    const el = messagesRef.current?.querySelector(`[data-message-id="${pendingScrollToId}"]`);
    if (el) {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      setPendingScrollToId(null);
    }
  }, [pendingScrollToId, messages]);

  const expandToFullChat = useCallback(() => {
    navigate('/chat', { state: sessionId ? { sessionId } : undefined });
  }, [navigate, sessionId]);

  if (hidden || isRunning) return null;

  const activeTab = open ? localStorage.getItem('buyerDashboard_activeTab') : null;
  const orderedActions = getOrderedActions(activeTab);
  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  const sendMessage = async (text: string) => {
    const question = text.trim();
    const info = companyInfoRef.current;
    if (!question || sending || !info || !user) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: question };
    setMessages((current) => [...current, userMessage]);
    setPendingScrollToId(userMessage.id);
    setInputValue('');
    setFollowUps([]);
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No active session');

      const response = await fetch(`${publicEnvironment.VITE_SUPABASE_URL}/functions/v1/simple-rag-chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          buyer_id: info.id,
          session_id: sessionId,
          user_context: { user_id: user.id, company_type: info.type, industry: info.industry || 'General' },
          stream: true,
        }),
      });
      if (!response.ok) throw new Error(`simple-rag-chat returned ${response.status}`);

      const contentType = response.headers.get('Content-Type') || '';

      if (contentType.includes('application/x-ndjson') && response.body) {
        const assistantId = `assistant-${Date.now()}`;
        setMessages((current) => [...current, { id: assistantId, role: 'assistant', content: '' }]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let resolvedSessionId: string | null = null;
        // Defer live display until we know whether this is plain text (stream
        // it) or a tagged compliance card (buffer silently, render formatted
        // once complete -- raw "<COMPLIANCE_SUMMARY>" tag soup is never shown).
        let accumulatedText = '';
        let structuredDecision: 'pending' | 'plain' | 'structured' = 'pending';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.type === 'text_delta') {
                accumulatedText += event.text;
                if (structuredDecision === 'pending' && accumulatedText.length >= 20) {
                  structuredDecision = accumulatedText.trimStart().startsWith('<COMPLIANCE_SUMMARY') ? 'structured' : 'plain';
                }
                if (structuredDecision === 'plain') {
                  setMessages((current) => current.map((m) => (m.id === assistantId ? { ...m, content: accumulatedText } : m)));
                }
              } else if (event.type === 'done') {
                resolvedSessionId = event.session_id || null;
              } else if (event.type === 'error') {
                setMessages((current) => current.map((m) => (m.id === assistantId ? { ...m, content: event.message || 'Something went wrong reaching the assistant.' } : m)));
              }
            } catch (parseError) {
              console.error('compliance-assistant: failed to parse stream line', parseError);
            }
          }
        }

        if (structuredDecision !== 'plain' && accumulatedText) {
          setMessages((current) => current.map((m) => (m.id === assistantId ? { ...m, content: accumulatedText } : m)));
        }
        if (resolvedSessionId && !sessionId) setSessionId(resolvedSessionId);
        setFollowUps([]);
      } else {
        const data = await response.json();
        if (data?.session_id && !sessionId) setSessionId(data.session_id);

        const documents = Array.isArray(data?.structured_response?.documents) ? data.structured_response.documents : undefined;
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data?.answer || "I wasn't able to process that — try again or open the full assistant.",
          documents,
        };
        setMessages((current) => [...current, assistantMessage]);

        if (data?.structured_response?.type === 'email_composer' && Array.isArray(data.structured_response.drafts)) {
          setEmailComposer({ drafts: data.structured_response.drafts, actionType: data.structured_response.action_type || 'general_followup' });
        }

        const nextActions = data?.structured_response?.quick_actions;
        setFollowUps(Array.isArray(nextActions) ? nextActions.slice(0, 3) : []);
      }
    } catch (error) {
      console.error('compliance-assistant: sendMessage failed', error);
      setMessages((current) => [
        ...current,
        { id: `assistant-error-${Date.now()}`, role: 'assistant', content: 'Something went wrong reaching the assistant. Please try again.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(inputValue);
  };

  // Handle the four real action buttons on a compliance-card (<QUICK_ACTIONS>) response.
  const handleStructuredQuickAction = async (actionType: string, metadata: Record<string, string>) => {
    const supplierId = metadata.entity_id;
    const supplierLabel = metadata.entity_name || metadata.supplier_name || 'this supplier';

    if (actionType === 'request_documents') {
      void sendMessage(`Request the missing documents from ${supplierLabel}`);
      return;
    }
    if (actionType === 'generate_email') {
      void sendMessage(`Draft a compliance follow-up email to ${supplierLabel} about the missing documents`);
      return;
    }
    if (actionType === 'view_supplier_profile') {
      localStorage.setItem('buyerDashboard_activeTab', 'suppliers');
      setOpen(false);
      navigate('/dashboard');
      return;
    }
    if (actionType === 'create_task') {
      const info = companyInfoRef.current;
      if (!info || !user || !supplierId) {
        toast({ title: "Can't create task", description: 'Missing supplier information.', variant: 'destructive' });
        return;
      }
      try {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        const { error } = await supabase.rpc('create_compliance_task_v1', {
          p_buyer_id: info.id,
          p_subject_type: 'supplier',
          p_subject_id: supplierId,
          p_supplier_id: supplierId,
          p_task_type: 'corrective_action',
          p_title: `Follow up: missing documents from ${supplierLabel}`,
          p_description: 'Created from the Compliance AI assistant.',
          p_assignee_id: user.id,
          p_due_date: dueDate.toISOString().slice(0, 10),
          p_decision_result_id: null,
        });
        if (error) throw error;
        toast({ title: 'Task created', description: `Follow-up task created for ${supplierLabel}.` });
      } catch (error) {
        console.error('compliance-assistant: create_compliance_task_v1 failed', error);
        toast({ title: "Couldn't create task", description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
      }
    }
  };

  const handleViewDocument = async (doc: DocumentReference) => {
    if (!doc.file_path) {
      toast({ title: 'No file available', description: "This document doesn't have a file attached.", variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('secure-document-url', { body: { file_path: doc.file_path } });
      if (error) throw error;
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('compliance-assistant: failed to open document', error);
      toast({ title: 'Error', description: 'Failed to open document.', variant: 'destructive' });
    }
  };

  return (
    <div className="compliance-assistant-root">
      {open && (
        <aside
          id="compliance-assistant-panel"
          ref={panelRef}
          className="compliance-assistant-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="compliance-assistant-title"
          tabIndex={-1}
        >
          <header className="compliance-assistant-panel__header">
            <div className="compliance-assistant-panel__identity">
              <span className="compliance-assistant-panel__mark" aria-hidden="true">
                <Sparkles size={18} />
              </span>
              <div>
                <div className="compliance-assistant-panel__title-row">
                  <h2 id="compliance-assistant-title">Compliance AI</h2>
                  <span className="compliance-assistant-panel__ai-badge">
                    <Sparkles size={11} />
                    AI
                  </span>
                </div>
                <p>Review, explain, and act on supplier issues.</p>
              </div>
            </div>
            <div className="compliance-assistant-panel__header-actions">
              <button type="button" className="compliance-assistant-panel__expand" onClick={expandToFullChat} aria-label="Open full assistant">
                <Maximize2 size={16} />
              </button>
              <button type="button" className="compliance-assistant-panel__close" onClick={() => setOpen(false)} aria-label="Close Compliance AI">
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="compliance-assistant-panel__body">
            <p className="compliance-assistant-panel__disclaimer">Never share sensitive or protected health information.</p>

            {messages.length === 0 ? (
              <>
                <p className="compliance-assistant-panel__greeting">Hi {firstName}, what would you like to do today?</p>
                <div className="compliance-assistant-panel__prompts">
                  {orderedActions.map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => void sendMessage(label)}>
                      <span className="compliance-assistant-panel__prompt-icon" aria-hidden="true">
                        <Icon size={14} />
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="compliance-assistant-panel__messages" ref={messagesRef}>
                {messages.map((message) => {
                  const isStructured = message.role === 'assistant' && hasStructuredContent(message.content);
                  return (
                  <div key={message.id} data-message-id={message.id} className={`compliance-assistant-message compliance-assistant-message--${message.role}${isStructured ? ' compliance-assistant-message--structured' : ''}`}>
                    {isStructured ? (
                      <StructuredResponseRenderer content={message.content} onQuickAction={handleStructuredQuickAction} />
                    ) : message.role === 'assistant' ? (
                      <>
                        <div className="compliance-assistant-markdown">
                          <MarkdownMessage>{normalizeAssistantText(message.content)}</MarkdownMessage>
                        </div>
                        {message.documents && message.documents.length > 0 && (
                          <div className="compliance-assistant-doc-list">
                            {message.documents.map((doc) => (
                              <div key={doc.id} className="compliance-assistant-doc-card">
                                <div className="compliance-assistant-doc-card__icon" aria-hidden="true">
                                  <FileText size={14} />
                                </div>
                                <div className="compliance-assistant-doc-card__body">
                                  <p className="compliance-assistant-doc-card__title">{doc.title}</p>
                                  <p className="compliance-assistant-doc-card__meta">
                                    {[doc.supplier_name, doc.document_type, doc.status].filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                                {doc.file_path && (
                                  <button type="button" className="compliance-assistant-doc-card__view" onClick={() => void handleViewDocument(doc)} aria-label="View document">
                                    <ExternalLink size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      message.content
                    )}
                  </div>
                  );
                })}
                {sending && (
                  <div className="flex items-center gap-2" aria-label="Working behind the scenes">
                    <span className="compliance-assistant-typing"><span /><span /><span /></span>
                    <ThinkingIndicator className="text-[13px] text-muted-foreground" />
                  </div>
                )}
              </div>
            )}

            {messages.length > 0 && followUps.length > 0 && !sending && (
              <div className="compliance-assistant-panel__followups">
                {followUps.map((action) => (
                  <button key={action} type="button" onClick={() => void sendMessage(action)}>
                    {action}
                  </button>
                ))}
              </div>
            )}

            <form className="compliance-assistant-panel__inputbar" onSubmit={handleSubmit}>
              <input
                type="text"
                className="compliance-assistant-panel__input"
                placeholder="Ask me anything"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                disabled={sending}
              />
              <button type="submit" className="compliance-assistant-panel__send" disabled={sending || !inputValue.trim()} aria-label="Send">
                <Send size={16} />
              </button>
            </form>
          </div>
        </aside>
      )}

      {!open && (
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <button
            ref={launcherRef}
            type="button"
            className="compliance-assistant-launcher"
            onClick={() => setOpen((current) => !current)}
            aria-label={open ? 'Close Compliance AI Assistant' : 'Open Compliance AI Assistant'}
            aria-expanded={open}
            aria-controls="compliance-assistant-panel"
          >
            <span className="compliance-assistant-launcher__halo" aria-hidden="true" />
            <span className="compliance-assistant-launcher__face" aria-hidden="true">
              {/* A sparkle mark, not a cartoon face. The previous smiley used a
                  sky-blue (#0EA5E9) gradient that predated the teal brand and
                  read as though it came from a different product. */}
              <svg viewBox="0 0 120 120">
                <defs>
                  <linearGradient id="compliance-ai-face" x1="18" y1="12" x2="104" y2="108" gradientUnits="userSpaceOnUse">
                    <stop stopColor="hsl(var(--primary))" />
                    <stop offset="1" stopColor="hsl(var(--primary-hover))" />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r="45" fill="url(#compliance-ai-face)" />
                <circle cx="60" cy="60" r="43.5" fill="none" stroke="hsl(var(--primary-foreground) / 0.22)" strokeWidth="1.5" />
                <path
                  className="compliance-assistant-spark"
                  d="M60 36c1.6 9.4 5.8 13.6 15.2 15.2C65.8 52.8 61.6 57 60 66.4 58.4 57 54.2 52.8 44.8 51.2 54.2 49.6 58.4 45.4 60 36Z"
                  fill="hsl(var(--primary-foreground))"
                />
                <path
                  className="compliance-assistant-spark compliance-assistant-spark--sm"
                  d="M78 62c.9 5.2 3.2 7.5 8.4 8.4-5.2.9-7.5 3.2-8.4 8.4-.9-5.2-3.2-7.5-8.4-8.4 5.2-.9 7.5-3.2 8.4-8.4Z"
                  fill="hsl(var(--primary-foreground) / 0.7)"
                />
              </svg>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Ask Compliance AI</TooltipContent>
      </Tooltip>
      )}
      {emailComposer && companyInfoRef.current && (
        <ComplianceEmailComposer
          drafts={emailComposer.drafts}
          actionType={emailComposer.actionType}
          buyerId={companyInfoRef.current.id}
          onClose={() => setEmailComposer(null)}
          onSent={(results) => {
            toast({ title: 'Email sent', description: `Successfully sent ${results?.total_emails_sent ?? ''} email(s).` });
            setMessages((current) => [...current, { id: `assistant-sent-${Date.now()}`, role: 'assistant', content: 'Done — the email has been sent.' }]);
            setEmailComposer(null);
          }}
        />
      )}
    </div>
  );
}
