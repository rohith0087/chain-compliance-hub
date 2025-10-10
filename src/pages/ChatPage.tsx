// app/chat/ChatPage.tsx (or wherever your component lives)
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import ChatDocumentViewer from "@/components/chat/ChatDocumentViewer";
import ComplianceVisualizer from "@/components/chat/ComplianceVisualizer";
import ComplianceInsightsDashboard from "@/components/chat/ComplianceInsightsDashboard";
import DailyInsightsPanel from "@/components/chat/DailyInsightsPanel";
import ActionExecutor from "@/components/chat/ActionExecutor";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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

// ---------------------------------------------
// Types
// ---------------------------------------------
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

interface StructuredResponse {
  response: string;
  content?: string;
  sections?: Array<{ title: string; content: string; type?: string }>;
  documents?: DocumentReference[];
  quick_actions?: Array<{
    label: string;
    action: string;
    action_type?: string;
    parameters?: Record<string, any>;
    data?: any;
  }>;
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
  generated_image?: string;
}

// ---------------------------------------------
// Helpers
// ---------------------------------------------
const isDebug = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

const statusColor = (status: string) => {
  switch ((status || "").toLowerCase()) {
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

const statusIcon = (status: string) => {
  switch ((status || "").toLowerCase()) {
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

// Normalize edge function payload into StructuredResponse
function normalizeEdgePayload(edge: any): StructuredResponse {
  if (!edge || typeof edge !== "object") {
    return { response: "Hmm, I didn't receive a valid response." };
  }

  // Control payloads
  if (edge.type === "needs_confirmation" && edge.confirm_kind === "supplier_name") {
    return {
      response: `Did you mean **${edge.options?.[0]}**?`,
      quick_actions: (edge.options || []).map((opt: string) => ({
        label: opt,
        action: `status for "${opt}"`,
        action_type: "navigate",
      })),
      sections: [
        {
          title: "Ambiguous supplier",
          content: `I found multiple matches. Pick one to continue:\n\n${(edge.options || []).map((o: string) => `- ${o}`).join("\n")}`,
        },
      ],
    };
  }

  if (edge.type === "supplier_not_found") {
    return {
      response: edge.message || "I couldn't find that supplier.",
      quick_actions: [{ label: "Try again", action: 'Show documents from "<supplier name>"', action_type: "navigate" }],
    };
  }

  if (edge.error) {
    return {
      response: edge.error,
      quick_actions: [{ label: "Retry", action: "Retry", action_type: "navigate" }],
    };
  }

  const toDocs = (rows: any[] = []): DocumentReference[] =>
    rows.map((r) => ({
      id: String(r.id ?? r.request_id ?? crypto.randomUUID()),
      title: r.file_name || r.document_name || r.title || "Untitled",
      supplier_name: r.supplier_name || r.suppliers?.company_name,
      document_type: r.document_type || r.document_requests?.document_type || "Document",
      expiration_date: r.expiration_date || undefined,
      status: String(r.status || "unknown").toLowerCase(),
      file_path: r.file_path,
      metadata: r,
    }));

  const docsFromOverview = (edge.overview?.expiring_documents || []).map((d: any) => ({
    id: String(d.id),
    title: d.title,
    supplier_name: d.supplier_name,
    document_type: d.document_type || "Document",
    expiration_date: d.expiration_date,
    status: d.status || "unknown",
    metadata: d,
  }));

  const type = edge.type as string | undefined;

  // Build per-type
  if (type === "daily_overview") {
    return {
      response: `Here’s your **daily compliance overview**.`,
      sections: [
        {
          title: "Compliance Metrics",
          type: "executive_summary",
          content: `- **Compliance score**: ${Math.round(edge.metrics?.compliance_score ?? 0)}%
- **Approved**: ${edge.metrics?.approved_documents ?? 0}
- **Pending**: ${edge.metrics?.pending_documents ?? 0}
- **Expired**: ${edge.metrics?.expired_documents ?? 0}
- **Expiring soon (30d)**: ${edge.metrics?.expiring_soon ?? 0}`,
        },
        {
          title: "Alerts & Tasks",
          type: "actions",
          content:
            ((edge.overview?.compliance_alerts || []).map((a: string) => `- ${a}`).join("\n") || "No alerts.") +
            "\n" +
            ((edge.overview?.pending_tasks || []).map((t: string) => `- ${t}`).join("\n") || ""),
        },
      ],
      documents: docsFromOverview,
      daily_insights: {
        pending_tasks: edge.overview?.pending_tasks || [],
        overdue_items: edge.overview?.overdue_items || [],
        compliance_alerts: edge.overview?.compliance_alerts || [],
      },
      quick_actions: [
        { label: "Show expiring in 30 days", action: "find documents expiring in the next 30 days" },
        { label: "Show expired docs", action: "show all expired documents" },
        { label: "Pending reviews", action: "show pending documents" },
      ],
      generated_image: edge.generated_image,
    };
  }

  if (type === "expired_documents") {
    return {
      response: `I found the **expired documents** relevant to your scope.`,
      sections: [{ title: "Summary", content: `Total expired: **${edge.rows?.length ?? 0}**` }],
      documents: toDocs(edge.rows),
      quick_actions: [
        { label: "Group by supplier", action: "group expired documents by supplier" },
        { label: "Only ISO docs", action: "show expired ISO certificates" },
      ],
    };
  }

  if (type === "expiring_window") {
    return {
      response: `Here are the documents **expiring in your selected window**.`,
      sections: [
        {
          title: "Summary",
          content: `Window: \`${edge.params?.start_date}\` → \`${edge.params?.end_date}\`\n\nTotal: **${edge.rows?.length ?? 0}**`,
        },
      ],
      documents: toDocs(edge.rows),
      quick_actions: [{ label: "Next 7 days", action: "show documents expiring in the next 7 days" }],
    };
  }

  if (type === "specific_document_check") {
    return {
      response: `Here’s what I found for **${edge.query}**.`,
      documents: toDocs(edge.rows),
    };
  }

  if (type === "text_to_sql") {
    const sr: StructuredResponse = {
      response: `Here are the results.`,
      documents: toDocs(edge.rows),
      quick_actions: [
        { label: "Expiring in 30 days", action: "find documents expiring in the next 30 days" },
        { label: "Expired docs", action: "show all expired documents" },
      ],
      generated_image: edge.generated_image,
    };
    if (edge.explanation) {
      sr.sections = [{ title: "How I queried", content: edge.explanation }];
    }
    return sr;
  }

  return {
    response: "Here are the latest results.",
    documents: toDocs(edge.rows),
    generated_image: edge.generated_image,
  };
}

// ---------------------------------------------
// Component
// ---------------------------------------------
const ChatPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [companyInfo, setCompanyInfo] = useState<{ id: string; type: string; industry?: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [dynamicQuestions, setDynamicQuestions] = useState<string[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentReference | null>(null);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Load bootstrap data
  useEffect(() => {
    getCompanyInfo();
  }, [user]);

  useEffect(() => {
    if (companyInfo) {
      loadChatSessions();
      loadDynamicQuestions();
    }
  }, [companyInfo]);

  // ---------------------------------------------
  // Data loaders
  // ---------------------------------------------
  const getCompanyInfo = async () => {
    if (!user) return;
    try {
      const { data: buyerData } = await supabase
        .from("buyers")
        .select("id, industry")
        .eq("profile_id", user.id)
        .single();
      if (buyerData) {
        setCompanyInfo({ id: buyerData.id, type: "buyer", industry: buyerData.industry });
        return;
      }
      const { data: supplierData } = await supabase
        .from("suppliers")
        .select("id, industry")
        .eq("profile_id", user.id)
        .single();
      if (supplierData) {
        setCompanyInfo({ id: supplierData.id, type: "supplier", industry: supplierData.industry });
      }
    } catch (error) {
      console.error("Error getting company info:", error);
    }
  };

  const loadChatSessions = async () => {
    if (!user || !companyInfo) return;
    try {
      const { data: sessions } = await supabase
        .from("chat_sessions")
        .select("id, session_title, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("company_id", companyInfo.id)
        .eq("company_type", companyInfo.type)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (sessions) setChatSessions(sessions);
    } catch (error) {
      console.error("Error loading chat sessions:", error);
    }
  };

  const loadChatHistory = async (sessionId: string) => {
    try {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (msgs) {
        setMessages(msgs.map((m) => ({ ...m, role: m.role as any })));
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  };

  const loadDynamicQuestions = async () => {
    if (!companyInfo) return;
    try {
      const { data: suppliers } = await supabase.from("suppliers").select("company_name").limit(3);
      const { data: docTypes } = await supabase.from("document_requests").select("document_type").limit(3);
      const { data: pendingDocs } = await supabase
        .from("document_uploads")
        .select("status")
        .eq("status", "pending_review");

      const q: string[] = [];
      if (suppliers?.length) q.push(`Show me documents from ${suppliers[0].company_name}`);
      if (docTypes?.length) q.push(`When do our ${docTypes[0].document_type} certificates expire?`);
      if (pendingDocs?.length) q.push(`Show me the ${pendingDocs.length} documents pending review`);
      q.push("What documents need my attention today?");
      q.push("Show me compliance gaps and recommendations");
      q.push("Find documents expiring in the next 30 days");
      setDynamicQuestions(q);
    } catch {
      setDynamicQuestions([
        "Show me documents from our suppliers",
        "When do our certificates expire?",
        "Which documents are pending review?",
        "What documents need attention today?",
        "Show me compliance status",
        "Find expired documents",
      ]);
    }
  };

  // ---------------------------------------------
  // Actions
  // ---------------------------------------------
  const startNewChat = () => {
    setMessages([]);
    setCurrentSession(null);
    inputRef.current?.focus();
  };

  const selectSession = (session: ChatSession) => {
    setCurrentSession(session.id);
    loadChatHistory(session.id);
    setShowHistory(false);
  };

  const handleViewDocument = (document: DocumentReference) => {
    setSelectedDocument(document);
    setIsDocumentViewerOpen(true);
  };

  const closeDocumentViewer = () => {
    setIsDocumentViewerOpen(false);
    setSelectedDocument(null);
  };

  const triggerKnowledgeRefresh = async () => {
    if (!companyInfo) {
      toast({ title: "Error", description: "Company information not available", variant: "destructive" });
      return;
    }
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("knowledge-refresh", {
        body: { mode: "initial_population", company_id: companyInfo.id, company_type: companyInfo.type },
      });
      if (error) throw error;
      toast({
        title: "Knowledge Base Updated",
        description: data?.message || "Knowledge base has been refreshed successfully",
      });
    } catch (error) {
      console.error("Error refreshing knowledge base:", error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh knowledge base. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !companyInfo || !user) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputMessage,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("rag-chat", {
        body: {
          message: userMessage.content,
          company_id: companyInfo.id,
          company_type: companyInfo.type,
          session_id: currentSession,
          conversation_history: messages.slice(-10),
        },
      });
      if (error) throw error;

      const normalized = normalizeEdgePayload(data);

      // Contextual follow-ups
      if (data?.type === "daily_overview") {
        setDynamicQuestions([
          "Show expiring in the next 30 days",
          "List expired documents",
          "Which suppliers have the most pending docs?",
        ]);
      } else if (data?.type === "expired_documents") {
        setDynamicQuestions(["Group these by supplier", "Show only ISO certificates", "Show expiring next 7 days"]);
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          typeof normalized.response === "string"
            ? normalized.response
            : "The assistant provided a structured response.",
        metadata: {
          ...data,
          generated_image: data?.generated_image,
          structured_response: normalized,
        },
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data?.session_id && data.session_id !== currentSession) {
        setCurrentSession(data.session_id);
        loadChatSessions();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ---------------------------------------------
  // Rendering helpers
  // ---------------------------------------------
  const renderStructuredMessage = (message: Message) => {
    const parsed: StructuredResponse | null = message.metadata?.structured_response || null;

    if (!parsed) {
      // fallback attempts
      try {
        const tryParsed: StructuredResponse = JSON.parse(message.content);
        message.metadata = { ...(message.metadata || {}), structured_response: tryParsed };
        return renderStructuredMessage(message);
      } catch {
        return typeof message.content === "string" ? (
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
            {JSON.stringify(message.content, null, 2)}
          </pre>
        );
      }
    }

    const imgB64 =
      (parsed as any)?.generated_image ||
      message.metadata?.generated_image ||
      message.metadata?.image ||
      message.metadata?.b64_json;

    return (
      <div className="space-y-6">
        {/* Intent/type badges if available */}
        {(message.metadata?.type || message.metadata?.intent) && (
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground mb-2">
            {message.metadata?.type && (
              <Badge variant="outline" className="capitalize">
                {(message.metadata.type as string).replaceAll("_", " ")}
              </Badge>
            )}
            {message.metadata?.intent && <span>• {(message.metadata.intent as string).replaceAll("_", " ")}</span>}
          </div>
        )}

        {/* KPI cards */}
        {message.metadata?.metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "Compliance", value: `${Math.round(message.metadata.metrics.compliance_score)}%` },
              { label: "Approved", value: message.metadata.metrics.approved_documents },
              { label: "Pending", value: message.metadata.metrics.pending_documents },
              { label: "Expired", value: message.metadata.metrics.expired_documents },
              { label: "Expiring (30d)", value: message.metadata.metrics.expiring_soon },
            ].map((kpi, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card/60 p-3">
                <div className="text-xs text-muted-foreground">{kpi.label}</div>
                <div className="text-lg font-semibold text-foreground">{kpi.value as any}</div>
              </div>
            ))}
          </div>
        )}

        {/* Main response */}
        {(parsed.response || parsed.content) && (
          <div className="text-muted-foreground leading-relaxed">
            <ReactMarkdown>{String(parsed.response || parsed.content)}</ReactMarkdown>
          </div>
        )}

        {/* AI-generated image */}
        {imgB64 && (
          <div className="mt-4 space-y-2">
            <img
              src={`data:image/png;base64,${imgB64}`}
              alt="AI-generated visualization"
              className="rounded-lg border border-border w-full max-w-2xl shadow-sm"
            />
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>AI-generated visualization</span>
            </div>
          </div>
        )}

        {/* Action Executor */}
        {((parsed.actionable_items?.length ?? 0) > 0 ||
          (parsed.suggested_actions?.length ?? 0) > 0 ||
          (Array.isArray(parsed.quick_actions) &&
            parsed.quick_actions.some(
              (qa) => (qa as any)?.action_type && (qa as any)?.action_type !== "navigate",
            ))) && (
          <div className="border-l-4 border-primary/20 pl-4">
            <ActionExecutor
              actionItems={parsed.actionable_items}
              suggestedActions={parsed.suggested_actions}
              quickActions={parsed.quick_actions}
              sessionId={currentSession || "temp-session"}
              onActionComplete={(result) => {
                toast({ title: "Action Completed", description: result.message });
              }}
            />
          </div>
        )}

        {/* Sections */}
        {parsed.sections?.map((section, index) => (
          <div
            key={index}
            className={`rounded-lg border border-border/50 p-4 space-y-3 ${
              section.type === "executive_summary"
                ? "bg-primary/5 border-primary/20"
                : section.type === "actions"
                  ? "bg-secondary/5 border-secondary/20"
                  : "bg-card/30"
            }`}
          >
            <h4 className="font-semibold text-card-foreground">{section.title}</h4>
            <div className="text-muted-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{section.content}</ReactMarkdown>
            </div>
          </div>
        ))}

        {/* Documents */}
        {parsed.documents && parsed.documents.length > 0 ? (
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Related Documents ({parsed.documents.length})
            </h4>

            <div className="grid gap-3">
              {parsed.documents.slice(0, 3).map((doc, index) => (
                <Card
                  key={index}
                  className={`p-4 border-l-4 transition-all hover:shadow-md ${statusColor(doc.status)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {statusIcon(doc.status)}
                        <span className="font-medium text-foreground">{doc.title}</span>
                      </div>

                      {doc.supplier_name && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Building className="w-3 h-3" />
                          <span>{doc.supplier_name}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                          {doc.document_type}
                        </Badge>

                        {doc.expiration_date && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>Expires: {format(new Date(doc.expiration_date), "MMM dd, yyyy")}</span>
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

            {parsed.documents.length > 3 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <span>Show {parsed.documents.length - 3} more documents</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="grid gap-3">
                    {parsed.documents.slice(3).map((doc, index) => (
                      <Card
                        key={index + 3}
                        className={`p-4 border-l-4 transition-all hover:shadow-md ${statusColor(doc.status)}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {statusIcon(doc.status)}
                              <span className="font-medium text-foreground">{doc.title}</span>
                            </div>
                            {doc.supplier_name && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Building className="w-3 h-3" />
                                <span>{doc.supplier_name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-sm flex-wrap">
                              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                {doc.document_type}
                              </Badge>
                              {doc.expiration_date && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  <span>Expires: {format(new Date(doc.expiration_date), "MMM dd, yyyy")}</span>
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
        ) : (
          // Empty documents
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            No documents to display.
          </div>
        )}

        {/* Visual data block (if any) */}
        {parsed.visual_data && (
          <div className="mt-4">
            <ComplianceVisualizer visualData={parsed.visual_data} />
          </div>
        )}

        {/* Daily insights */}
        {parsed.daily_insights && (
          <div className="mt-4">
            <DailyInsightsPanel insights={parsed.daily_insights} />
          </div>
        )}

        {/* Quick actions */}
        {parsed.quick_actions && parsed.quick_actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
            {parsed.quick_actions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => {
                  const label = typeof action === "string" ? action : action.label;
                  if (label?.toLowerCase() === "retry") {
                    const lastUser = [...messages].reverse().find((m) => m.role === "user");
                    if (lastUser) {
                      setInputMessage(lastUser.content);
                      sendMessage();
                      return;
                    }
                  }
                  const text = typeof action === "string" ? action : action.action || action.label;
                  setInputMessage(text);
                }}
                className="text-xs hover:bg-primary/10 hover:border-primary/20"
                title={typeof action === "string" ? action : action.label}
              >
                {typeof action === "string" ? action : action.label}
              </Button>
            ))}
          </div>
        )}

        {/* Debug drawer (opt-in via ?debug=1) */}
        {isDebug() && (message.metadata?.sql || message.metadata?.params) && (
          <Collapsible className="mt-2">
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-2">
                <ChevronDown className="w-4 h-4" /> Debug SQL
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              {message.metadata?.sql && (
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">{message.metadata.sql}</pre>
              )}
              {message.metadata?.params && (
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto mt-2">
                  {JSON.stringify(message.metadata.params, null, 2)}
                </pre>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  };

  // ---------------------------------------------
  // Render
  // ---------------------------------------------
  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar (Desktop) */}
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

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="p-4 space-y-2">
            {chatSessions.map((session) => (
              <Card
                key={session.id}
                className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                  currentSession === session.id ? "bg-accent border-primary" : ""
                }`}
                onClick={() => selectSession(session)}
                title={session.session_title || "Untitled Chat"}
              >
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-foreground">
                      {session.session_title || "Untitled Chat"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(session.updated_at), "MMM dd, yyyy")}
                    </p>
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

      {/* Main */}
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
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6" ref={scrollAreaRef} aria-live="polite">
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
                  Your intelligent assistant for document management, compliance tracking, and regulatory guidance.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Try asking:
                </h3>
                <div className="grid gap-3 max-w-lg mx-auto">
                  {dynamicQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="text-left justify-start h-auto p-4 hover:bg-primary/5 hover:border-primary/20 transition-all group"
                      onClick={() => setInputMessage(question)}
                      title={question}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className="w-2 h-2 rounded-full bg-primary/40 mt-2 group-hover:bg-primary flex-shrink-0" />
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                          {question}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((message) => (
                <div key={message.id} className="flex items-start gap-4 p-6 hover:bg-accent/30 transition-colors">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20"
                    }`}
                  >
                    {message.role === "user" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Shield className="w-4 h-4 text-primary" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="font-medium text-sm text-foreground">
                      {message.role === "user" ? "You" : "Compliance AI"}
                    </div>

                    <div className="prose prose-sm max-w-none">
                      {message.role === "assistant" ? (
                        renderStructuredMessage(message)
                      ) : typeof message.content === "string" ? (
                        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {JSON.stringify(message.content, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-start gap-4 p-6 bg-accent/20" aria-busy="true">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="font-medium text-sm text-foreground">Compliance AI</div>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <div className="flex gap-1" aria-hidden>
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
        <div className="sticky bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur-sm p-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-3">
              <Input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your compliance documents, suppliers, or regulatory requirements..."
                className="flex-1 bg-background border-border focus:border-primary/40 focus:ring-primary/20"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {messages.length > 0 && (
              <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Knowledge sources: {messages[messages.length - 1]?.metadata?.knowledge_entries_used || 0} • Documents
                  found:{" "}
                  {messages[messages.length - 1]?.metadata?.documents_found ||
                    (messages[messages.length - 1]?.metadata?.structured_response?.documents?.length ?? 0)}
                </p>
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
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="p-4 space-y-2">
                {chatSessions.map((session) => (
                  <Card
                    key={session.id}
                    className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                      currentSession === session.id ? "bg-accent border-primary" : ""
                    }`}
                    onClick={() => selectSession(session)}
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-foreground">
                          {session.session_title || "Untitled Chat"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(session.updated_at), "MMM dd, yyyy")}
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

      {/* Document Viewer */}
      <ChatDocumentViewer document={selectedDocument} isOpen={isDocumentViewerOpen} onClose={closeDocumentViewer} />
    </div>
  );
};

export default ChatPage;
