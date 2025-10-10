// src/pages/ChatPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import ComplianceVisualizer from "@/components/chat/ComplianceVisualizer";
import DailyInsightsPanel from "@/components/chat/DailyInsightsPanel";
import ActionExecutor from "@/components/chat/ActionExecutor";
import ChatDocumentViewer from "@/components/chat/ChatDocumentViewer";
import {
  MessageSquare,
  Send,
  User,
  Loader2,
  Plus,
  FileText,
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  Sparkles,
  Menu,
  ChevronDown,
  Building,
  Shield,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";

// Charts (client-side fallback)
import ClientPieFromRows from "@/components/charts/ClientPieFromRows";

/* ------------ Types ------------ */

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: any;
  created_at: string;
}

interface ChatSession {
  id: string;
  session_title: string;
  created_at: string;
  updated_at: string;
}

interface DocumentReference {
  id: string;
  title: string;
  supplier_name?: string;
  document_type: string;
  expiration_date?: string;
  status: string;
  file_path?: string;
  metadata?: any;
}

/**
 * This mirrors what the edge can return (either under `response` or flat).
 * Only fields actually used by the UI are strictly necessary.
 */
interface StructuredResponse {
  response?: string;            // narrative
  content?: string;             // narrative (alt)
  sections?: Array<{ title: string; content: string; type?: string }>;

  documents?: DocumentReference[];
  rows?: Array<Record<string, any>>;

  generated_image?: string;     // base64 PNG
  image?: string;
  image_base64?: string;
  b64_json?: string;

  visual_data?: any;
  daily_insights?: any;

  actionable_items?: Array<{
    type: string;
    description: string;
    priority: "low" | "medium" | "high";
    estimated_time: string;
    action_type: string;
    parameters: Record<string, any>;
  }>;
  suggested_actions?: Array<{
    label: string;
    description: string;
    action_type: string;
    parameters: Record<string, any>;
    urgency: "low" | "medium" | "high";
  }>;
  quick_actions?: Array<{
    label: string;
    action: string;
    action_type?: string;
    parameters?: Record<string, any>;
    data?: any;
  } | string>;

  sql?: string;                 // transparency
  params?: Record<string, any>;
  type?: string;                // route/type sent by edge
  intent?: string;              // optional route hint

  error?: boolean;              // UI error banner flag
  error_code?: string;          // "insufficient_quota" | "429" etc.
  explanation?: string;         // optional narrative fallback
}

type CompanyInfo = { id: string; type: "buyer" | "supplier"; industry?: string } | null;

/* ------------ Helpers ------------ */

const tidyTitle = (s?: string) => (s || "Untitled").replace(/_/g, " ");

const getStatusColor = (status: string) => {
  switch (status) {
    case "approved":
      return "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20";
    case "pending_review":
      return "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20";
    case "rejected":
      return "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
    case "expired":
      return "border-l-red-600 bg-red-50/50 dark:bg-red-950/20";
    default:
      return "border-l-primary/20 bg-card";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "approved":
      return <CheckCircle className="w-3 h-3 text-emerald-600" />;
    case "pending_review":
      return <Clock className="w-3 h-3 text-amber-600" />;
    case "rejected":
      return <XCircle className="w-3 h-3 text-red-600" />;
    case "expired":
      return <AlertCircle className="w-3 h-3 text-red-600" />;
    default:
      return <FileText className="w-3 h-3 text-muted-foreground" />;
  }
};

// Normalize known list routes that return only rows → UI documents
function rowsToDocuments(rows?: any[]): DocumentReference[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    id: r.id,
    title: tidyTitle(r.document_name || r.file_name),
    supplier_name: r.supplier_name || "Unknown Supplier",
    document_type: r.document_type || "Unknown",
    expiration_date: r.expiration_date || undefined,
    status: r.status || "unknown",
    file_path: r.file_path || undefined,
    metadata: r,
  }));
}

function extractImageB64(obj?: any): string | null {
  if (!obj) return null;
  return obj.generated_image || obj.image || obj.image_base64 || obj.b64_json || null;
}

/* ------------ Component ------------ */

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [dynamicQuestions, setDynamicQuestions] = useState<string[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentReference | null>(null);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ---- Effects ---- */

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // Try buyer, else supplier
        const { data: buyer } = await supabase
          .from("buyers")
          .select("id, industry")
          .eq("profile_id", user.id)
          .single();
        if (buyer) {
          setCompanyInfo({ id: buyer.id, type: "buyer", industry: buyer.industry });
          return;
        }
        const { data: supplier } = await supabase
          .from("suppliers")
          .select("id, industry")
          .eq("profile_id", user.id)
          .single();
        if (supplier) setCompanyInfo({ id: supplier.id, type: "supplier", industry: supplier.industry });
      } catch (e) {
        console.error("getCompanyInfo", e);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !companyInfo) return;
    (async () => {
      const { data: sessions } = await supabase
        .from("chat_sessions")
        .select("id, session_title, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("company_id", companyInfo.id)
        .eq("company_type", companyInfo.type)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (sessions) setChatSessions(sessions);
    })();
  }, [user, companyInfo]);

  useEffect(() => {
    if (!companyInfo) return;
    (async () => {
      try {
        const { data: suppliers } = await supabase.from("suppliers").select("company_name").limit(3);
        const { data: docTypes } = await supabase.from("document_requests").select("document_type").limit(3);
        const { data: pending } = await supabase
          .from("document_uploads")
          .select("status")
          .eq("status", "pending_review");
        const qs: string[] = [];
        if (suppliers?.length) qs.push(`Show me documents from ${suppliers[0].company_name}`);
        if (docTypes?.length) qs.push(`When do our ${docTypes[0].document_type} certificates expire?`);
        if (pending?.length) qs.push(`Show me the ${pending.length} documents pending review`);
        qs.push("What documents need my attention today?");
        qs.push("Find documents expiring in the next 30 days");
        qs.push("Create a pie chart showing document counts by supplier");
        setDynamicQuestions(qs);
      } catch {
        setDynamicQuestions([
          "Show me documents from our suppliers",
          "Which documents are pending review?",
          "Find expired documents",
        ]);
      }
    })();
  }, [companyInfo]);

  /* ---- Data helpers ---- */

  async function loadChatHistory(sessionId: string) {
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (msgs) {
      setMessages(msgs.map((m: any) => ({ ...m, role: m.role as Message["role"] })));
    }
  }

  function startNewChat() {
    setMessages([]);
    setCurrentSession(null);
    inputRef.current?.focus();
  }

  function selectSession(s: ChatSession) {
    setCurrentSession(s.id);
    loadChatHistory(s.id);
    setShowHistory(false);
  }

  async function triggerKnowledgeRefresh() {
    if (!companyInfo) {
      toast({ title: "Error", description: "Company not resolved yet.", variant: "destructive" });
      return;
    }
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("knowledge-refresh", {
        body: { mode: "initial_population", company_id: companyInfo.id, company_type: companyInfo.type },
      });
      if (error) throw error;
      toast({ title: "Knowledge Base Updated", description: data?.message || "Refreshed." });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Refresh Failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  }

  /* ---- Send Message ---- */

  async function sendMessage() {
    if (!inputMessage.trim() || !companyInfo || !user) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("rag-chat", {
        body: {
          message: userMsg.content,
          company_id: companyInfo.id,
          company_type: companyInfo.type,
          session_id: currentSession,
          conversation_history: messages.slice(-10),
        },
      });
      if (error) throw error;

      // Edge may return { response: StructuredResponse } or a flat StructuredResponse
      const structured: StructuredResponse = (typeof data?.response === "object" && data.response) || data || {};

      const assistant: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          typeof structured.response === "string"
            ? structured.response
            : typeof structured.content === "string"
            ? structured.content
            : structured.explanation || "Here’s what I found.",
        metadata: {
          ...data,
          structured_response: structured,
          generated_image: extractImageB64(structured),
        },
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistant]);

      // Refresh sessions if server assigned a new one
      if (data?.session_id && data.session_id !== currentSession) {
        setCurrentSession(data.session_id);
        (async () => {
          if (!user || !companyInfo) return;
          const { data: sessions } = await supabase
            .from("chat_sessions")
            .select("id, session_title, created_at, updated_at")
            .eq("user_id", user.id)
            .eq("company_id", companyInfo.id)
            .eq("company_type", companyInfo.type)
            .order("updated_at", { ascending: false })
            .limit(20);
          if (sessions) setChatSessions(sessions);
        })();
      }

      // Edge signaled rate-limit chart fallback
      if (structured?.error_code === "insufficient_quota" || structured?.error_code === "429") {
        toast({
          title: "Visualization temporarily unavailable",
          description: "Using a local chart from database data instead.",
        });
      }
      if (structured?.error) {
        toast({
          title: "Request issue",
          description:
            typeof structured.response === "string" ? structured.response : "Request failed — want to try again?",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      console.error("sendMessage", e);
      toast({
        title: "Chat error",
        description: e?.message || "Edge function returned a non-2xx status.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleViewDocument(doc: DocumentReference) {
    setSelectedDocument(doc);
    setIsDocumentViewerOpen(true);
  }
  function closeDocumentViewer() {
    setIsDocumentViewerOpen(false);
    setSelectedDocument(null);
  }

  /* ---- Renderers ---- */

  const renderGeneratedImage = (imageBase64: string) => (
    <div className="my-4 rounded-lg overflow-hidden border border-border bg-card">
      <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1">
        <Sparkles className="w-3 h-3" />
        AI-generated visualization
      </div>
      <img src={`data:image/png;base64,${imageBase64}`} alt="AI-Generated Visualization" className="w-full h-auto" />
    </div>
  );

  const renderStructuredMessage = (message: Message) => {
    const parsed: StructuredResponse =
      message.metadata?.structured_response || (typeof message.content === "object" ? (message.content as any) : {});

    // ✅ Treat backend `{ type: "error" }` as an error too.
    const isError = Boolean((parsed as any)?.error || parsed?.type === "error");

    const imgB64 = extractImageB64(parsed) || message.metadata?.generated_image || null;

    // ✅ Added "expiring_documents" so expiring lists render as document cards.
    const isListRoute =
      parsed?.type === "expired_documents" ||
      parsed?.type === "expiring_documents" ||
      parsed?.intent === "expired_documents" ||
      parsed?.intent === "document_status" ||
      parsed?.intent === "pending_documents" ||
      parsed?.intent === "document_review" ||
      parsed?.type === "text_to_sql";

    const normalizedDocs =
      parsed?.documents?.length
        ? parsed.documents
        : isListRoute && parsed?.rows
        ? rowsToDocuments(parsed?.rows)
        : undefined;

    return (
      <div className="space-y-6">
        {/* Error banner */}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="text-sm text-destructive font-medium mb-1">Something went wrong</div>
            <div className="text-sm text-muted-foreground">
              {typeof parsed.response === "string" ? parsed.response : "Request failed — want to try again?"}
            </div>
            {message.metadata?.req_id && (
              <div className="mt-2 text-xs text-muted-foreground">
                Request ID: <code className="px-1 py-0.5 rounded bg-muted">{message.metadata.req_id}</code>
              </div>
            )}
          </div>
        )}

        {/* Narrative / markdown */}
        {!isError && (parsed.response || parsed.content) && (
          <div className="text-muted-foreground leading-relaxed">
            <div
              dangerouslySetInnerHTML={{
                __html: (parsed.response || parsed.content || "")
                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  .replace(/\*(.*?)\*/g, "<em>$1</em>")
                  .replace(/\n/g, "<br />"),
              }}
            />
          </div>
        )}

        {/* Generated image */}
        {!isError && imgB64 && renderGeneratedImage(imgB64)}

        {/* Client-side chart fallback */}
        {!isError && !imgB64 && parsed?.rows && <ClientPieFromRows rows={parsed.rows} />}

        {/* Action executor */}
        {!isError &&
          ((parsed.actionable_items?.length ?? 0) > 0 ||
            (parsed.suggested_actions?.length ?? 0) > 0 ||
            (Array.isArray(parsed.quick_actions) &&
              parsed.quick_actions.some((qa: any) => qa && typeof qa === "object" && qa?.action_type && qa?.action_type !== "navigate"))) && (
            <div className="border-l-4 border-primary/20 pl-4">
              <ActionExecutor
                actionItems={parsed.actionable_items}
                suggestedActions={parsed.suggested_actions}
                quickActions={parsed.quick_actions}
                sessionId={currentSession || "temp-session"}
                onActionComplete={(result) => toast({ title: "Action Completed", description: result.message })}
              />
            </div>
          )}

        {/* Sections */}
        {Array.isArray(parsed.sections) &&
          parsed.sections.map((s, i) => (
            <div
              key={i}
              className={`rounded-lg border border-border/50 p-4 space-y-3 ${
                s.type === "executive_summary"
                  ? "bg-primary/5 border-primary/20"
                  : s.type === "actions"
                  ? "bg-secondary/5 border-secondary/20"
                  : "bg-card/30"
              }`}
            >
              <h4 className="font-semibold text-card-foreground">{s.title}</h4>
              <div className="text-muted-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{s.content}</ReactMarkdown>
              </div>
            </div>
          ))}

        {/* Empty-states for known intents */}
        {isListRoute && (!normalizedDocs || normalizedDocs.length === 0) && (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            No documents found matching your query.
          </div>
        )}

        {/* Documents list */}
        {!isError && normalizedDocs && normalizedDocs.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documents ({normalizedDocs.length})
            </h4>

            {/* Top 3 */}
            <div className="grid gap-3">
              {normalizedDocs.slice(0, 3).map((doc, index) => (
                <Card
                  key={doc.id || index}
                  className={`p-4 border-l-4 transition-all hover:shadow-md ${getStatusColor(doc.status)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(doc.status)}
                        <span className="font-medium text-foreground">{doc.title}</span>
                      </div>

                      {doc.supplier_name && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Building className="w-3 h-3" />
                          <span>{doc.supplier_name}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          {doc.document_type}
                        </Badge>

                        {doc.expiration_date && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>
                              Expires:{" "}
                              {(() => {
                                try {
                                  return format(new Date(doc.expiration_date), "MMM dd, yyyy");
                                } catch {
                                  return String(doc.expiration_date);
                                }
                              })()}
                            </span>
                          </div>
                        )}

                        <Badge
                          variant="outline"
                          className={`capitalize ${
                            doc.status === "approved"
                              ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                              : doc.status === "pending_review"
                              ? "border-amber-500 text-amber-700 dark:text-amber-400"
                              : "border-red-500 text-red-700 dark:text-red-400"
                          }`}
                        >
                          {doc.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>

                    {doc.file_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="hover:bg-primary/10"
                        onClick={() => handleViewDocument(doc)}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* Collapsible for rest */}
            {normalizedDocs.length > 3 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <span>Show {normalizedDocs.length - 3} more documents</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="grid gap-3">
                    {normalizedDocs.slice(3).map((doc, index) => (
                      <Card
                        key={doc.id || `rest-${index}`}
                        className={`p-4 border-l-4 transition-all hover:shadow-md ${getStatusColor(doc.status)}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(doc.status)}
                              <span className="font-medium text-foreground">{doc.title}</span>
                            </div>

                            {doc.supplier_name && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Building className="w-3 h-3" />
                                <span>{doc.supplier_name}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-4 text-sm flex-wrap">
                              <Badge variant="secondary" className="bg-primary/10 text-primary">
                                {doc.document_type}
                              </Badge>

                              {doc.expiration_date && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  <span>
                                    Expires:{" "}
                                    {(() => {
                                      try {
                                        return format(new Date(doc.expiration_date), "MMM dd, yyyy");
                                      } catch {
                                        return String(doc.expiration_date);
                                      }
                                    })()}
                                  </span>
                                </div>
                              )}

                              <Badge
                                variant="outline"
                                className={`capitalize ${
                                  doc.status === "approved"
                                    ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                                    : doc.status === "pending_review"
                                    ? "border-amber-500 text-amber-700 dark:text-amber-400"
                                    : "border-red-500 text-red-700 dark:text-red-400"
                                }`}
                              >
                                {doc.status.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>

                          {doc.file_path && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="hover:bg-primary/10"
                              onClick={() => handleViewDocument(doc)}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {/* Quick actions */}
        {Array.isArray(parsed.quick_actions) && parsed.quick_actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {parsed.quick_actions.map((action: any, i) => {
              const label = typeof action === "string" ? action : action.label;
              const text = typeof action === "string" ? action : action.action || action.label;
              return (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Retry special-case
                    if (label?.toLowerCase() === "retry") {
                      const lastUser = [...messages].reverse().find((m) => m.role === "user");
                      if (lastUser) {
                        setInputMessage(lastUser.content);
                        sendMessage();
                        return;
                      }
                    }
                    setInputMessage(text);
                  }}
                  className="text-xs hover:bg-primary/10 hover:border-primary/20"
                >
                  {label}
                </Button>
              );
            })}
          </div>
        )}

        {/* Visual data / insights */}
        {!isError && parsed.visual_data && (
          <div className="mt-4">
            <ComplianceVisualizer visualData={parsed.visual_data} />
          </div>
        )}
        {!isError && parsed.daily_insights && (
          <div className="mt-4">
            <DailyInsightsPanel insights={parsed.daily_insights} />
          </div>
        )}

        {/* Transparency: SQL + params */}
        {(parsed.sql || parsed.params) && (
          <Collapsible className="mt-2">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDown className="w-3 h-3" />
              <span>View SQL</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="p-3 bg-muted rounded-md border">
                {parsed.sql && (
                  <>
                    <div className="text-xs text-muted-foreground mb-1">Query</div>
                    <pre className="text-xs whitespace-pre-wrap break-all">{parsed.sql}</pre>
                  </>
                )}
                {parsed.params && Object.keys(parsed.params).length > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground mt-3 mb-1">Parameters</div>
                    <pre className="text-xs">{JSON.stringify(parsed.params, null, 2)}</pre>
                  </>
                )}
                {Array.isArray(parsed.rows) && (
                  <div className="text-xs text-muted-foreground mt-3">Result rows: {parsed.rows.length}</div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  };

  /* ---- UI ---- */

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* History Sidebar (lg) */}
      <div className="hidden lg:flex w-80 border-r border-border bg-card flex-col">
        <div className="sticky top-0 z-10 p-6 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Chat History</h2>
            <Button size="sm" variant="outline" onClick={startNewChat}>
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {chatSessions.map((s) => (
              <Card
                key={s.id}
                className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                  currentSession === s.id ? "bg-accent border-primary" : ""
                }`}
                onClick={() => selectSession(s)}
              >
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-foreground">{s.session_title || "Untitled Chat"}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(s.updated_at), "MMM dd, yyyy")}</p>
                  </div>
                </div>
              </Card>
            ))}
            {chatSessions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No chat history yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile History Sheet */}
      <Sheet open={showHistory} onOpenChange={setShowHistory}>
        <SheetContent side="left" className="w-80 p-0">
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border">
              <h2 className="font-semibold text-foreground">Chat History</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-2">
                {chatSessions.map((s) => (
                  <Card
                    key={s.id}
                    className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                      currentSession === s.id ? "bg-accent border-primary" : ""
                    }`}
                    onClick={() => selectSession(s)}
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-foreground">
                          {s.session_title || "Untitled Chat"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(s.updated_at), "MMM dd, yyyy")}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full min-h-0">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setShowHistory(true)}>
                <Menu className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h1 className="font-semibold text-foreground">Compliance Assistant</h1>
                  <p className="text-xs text-muted-foreground capitalize">
                    {companyInfo?.type || "—"} • {companyInfo?.industry || "General"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={triggerKnowledgeRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2"
                title="Refresh Knowledge Base"
              >
                <RotateCcw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Updating..." : ""}
              </Button>
              <Button variant="outline" size="sm" onClick={startNewChat}>
                <Plus className="w-4 h-4 mr-1" />
                New Chat
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto text-center space-y-8">
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent mx-auto flex items-center justify-center border border-primary/20">
                  <Shield className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-3xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Welcome to your Compliance AI
                </h2>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">
                  Your assistant for document management, compliance tracking, and regulatory guidance.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Try asking:
                </h3>
                <div className="grid gap-3 max-w-lg mx-auto">
                  {dynamicQuestions.map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="text-left justify-start h-auto p-4 hover:bg-primary/5 hover:border-primary/20"
                      onClick={() => setInputMessage(q)}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className="w-2 h-2 rounded-full bg-primary/40 mt-2 group-hover:bg-primary flex-shrink-0" />
                        <span className="text-muted-foreground group-hover:text-foreground">{q}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((m) => (
                <div key={m.id} className="flex items-start gap-4 p-6 hover:bg-accent/30 transition-colors">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20"
                    }`}
                  >
                    {m.role === "user" ? <User className="w-4 h-4" /> : <Shield className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="font-medium text-sm text-foreground">
                      {m.role === "user" ? "You" : "Compliance AI"}
                    </div>
                    <div className="prose prose-sm max-w-none">
                      {m.role === "assistant" ? (
                        renderStructuredMessage(m)
                      ) : typeof m.content === "string" ? (
                        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {JSON.stringify(m.content, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-start gap-4 p-6 bg-accent/20">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="font-medium text-sm text-foreground">Compliance AI</div>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-primary rounded-full animate-bounce" />
                        <div
                          className="w-1 h-1 bg-primary rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        />
                        <div
                          className="w-1 h-1 bg-primary rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        />
                      </div>
                      Analyzing your request...
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <
