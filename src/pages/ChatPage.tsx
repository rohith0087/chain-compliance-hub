// src/pages/ChatPage.tsx
import React, { useState, useEffect, useRef } from "react";
import logger from '@/utils/logger';
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
import ResponseActionButtons from "@/components/chat/ResponseActionButtons";
import ShareDialog from "@/components/chat/ShareDialog";
import { CodeVisualizationRenderer } from "@/components/chat/CodeVisualizationRenderer";
import AdvancedComplianceInsightsDashboard from "@/components/chat/AdvancedComplianceInsightsDashboard";
import { useWorkspaceProfile } from "@/hooks/useWorkspaceProfile";
import ComplianceEmailComposer from "@/components/chat/ComplianceEmailComposer";
import { StructuredResponseRenderer, hasStructuredContent } from "@/components/chat/structured";
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
  Link,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  Search,
  Users,
  TrendingUp,
  Home,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  
  action?: string;              // Action type (e.g., 'document_requests_created')
  data?: any;                   // Action data payload
  
  // Code visualization
  code?: string;                // Generated React component code
  summary?: string;             // Summary of the visualization
  
  // Compliance Insights Dashboard
  metrics?: any;                // Dashboard metrics
  supplier_metrics?: any[];     // Supplier performance data
  ai_insights?: any[];          // AI-generated insights
  timeframe?: string;           // Dashboard timeframe
  
  // Email composer
  drafts?: any[];               // Email drafts for composer
  action_type?: string;         // Email action type
  total_suppliers?: number;     // Number of suppliers
  total_documents?: number;     // Number of documents
  buyer_id?: string;            // Buyer ID for emails
}

type CompanyInfo = { id: string; type: "buyer" | "supplier"; industry?: string } | null;

/* ------------ Helpers ------------ */

const tidyTitle = (s?: string) => (s || "Untitled").replace(/_/g, " ");

// Time-based greeting helper
const getTimeOfDayGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
};

// Map function names to user-friendly display text
const functionDisplayNames: Record<string, string> = {
  'query_documents': 'Searching Documents',
  'query_suppliers': 'Finding Suppliers',
  'get_compliance_metrics': 'Analyzing Compliance',
  'create_document_request': 'Creating Document Request',
  'get_document_sets': 'Loading Document Sets',
  'get_document_timeseries': 'Generating Timeline',
  'get_missing_required_documents': 'Checking Missing Documents',
  'create_requests_for_missing': 'Creating Requests',
  'send_notification': 'Sending Notification',
  'export_csv': 'Exporting Data',
  'audit_trail': 'Reviewing Audit Trail',
  'get_compliance_insights_dashboard': 'Generating Insights',
  'generate_visualization_code': 'Building Visualization',
  'draft_compliance_email': 'Drafting Email',
  'find_documents_for_comparison': 'Comparing Documents',
  'execute_document_comparison': 'Running Comparison',
  'draft_generic_email': 'Composing Email',
  'confirm_send_email': 'Sending Email',
  'rag_chat': 'Processing',
  'simple-rag-chat': 'Processing',
};

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
  const { user, profile } = useAuth();
  const { t: wsT } = useWorkspaceProfile();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [messageToShare, setMessageToShare] = useState<Message | null>(null);
  const [activeFunction, setActiveFunction] = useState<string | null>(null);
  
  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
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
    setUserId(user.id);
    (async () => {
      try {
        // Step 1: Check if user is company OWNER (buyer)
        const { data: buyer } = await supabase
          .from("buyers")
          .select("id, industry")
          .eq("profile_id", user.id)
          .maybeSingle();
        if (buyer) {
          setCompanyInfo({ id: buyer.id, type: "buyer", industry: buyer.industry });
          return;
        }

        // Step 2: Check if user is company OWNER (supplier)
        const { data: supplier } = await supabase
          .from("suppliers")
          .select("id, industry")
          .eq("profile_id", user.id)
          .maybeSingle();
        if (supplier) {
          setCompanyInfo({ id: supplier.id, type: "supplier", industry: supplier.industry });
          return;
        }

        // Step 3: Check if user is a company TEAM MEMBER
        const { data: companyUser } = await supabase
          .from("company_users")
          .select("company_id, company_type")
          .eq("profile_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (companyUser) {
          if (companyUser.company_type === 'buyer') {
            const { data: teamBuyer } = await supabase
              .from("buyers")
              .select("id, industry")
              .eq("id", companyUser.company_id)
              .single();
            if (teamBuyer) {
              setCompanyInfo({ id: teamBuyer.id, type: "buyer", industry: teamBuyer.industry });
              return;
            }
          } else if (companyUser.company_type === 'supplier') {
            const { data: teamSupplier } = await supabase
              .from("suppliers")
              .select("id, industry")
              .eq("id", companyUser.company_id)
              .single();
            if (teamSupplier) {
              setCompanyInfo({ id: teamSupplier.id, type: "supplier", industry: teamSupplier.industry });
              return;
            }
          }
        }
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

  async function startNewChat() {
    if (!user || !companyInfo) {
      toast({ title: "Error", description: "User or company not loaded.", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("chat-session-manager", {
        body: {
          action: 'create',
          user_id: user.id,
          company_id: companyInfo.id,
          company_type: companyInfo.type,
          title: 'New Chat'
        }
      });

      if (error) throw error;

      logger.debug('✓ Created new session:', data.session.id);
      
      setCurrentSession(data.session.id);
      setMessages([]);
      inputRef.current?.focus();

    } catch (e: any) {
      console.error('Failed to create session:', e);
      toast({
        title: "Error",
        description: "Failed to start new chat.",
        variant: "destructive"
      });
    }
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
    setActiveFunction('simple-rag-chat');

    try {
      const { data, error } = await supabase.functions.invoke("simple-rag-chat", {
        body: {
          question: userMsg.content,
          buyer_id: companyInfo.id,
          session_id: currentSession,
          user_context: {
            user_id: user.id,
            company_type: companyInfo.type,
            industry: companyInfo.industry || "General",
          },
        },
      });
      if (error) throw error;

      console.debug("[simple-rag-chat] response", data);

      // Capture session_id from response if we didn't have one
      if (data.session_id && !currentSession) {
        logger.debug('✓ Session created by edge function:', data.session_id);
        setCurrentSession(data.session_id);
        
        // Update session title based on first question
        const autoTitle = userMsg.content.length > 50 
          ? userMsg.content.substring(0, 47) + '...'
          : userMsg.content;
        
        supabase.functions.invoke("chat-session-manager", {
          body: {
            action: 'update_title',
            session_id: data.session_id,
            title: autoTitle
          }
        }).catch(console.error);
      }

      const assistant: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data?.answer || "I apologize, but I was unable to process your request.",
        metadata: {
          structured_response: data?.structured_response || {
            content: data?.answer || "I apologize, but I was unable to process your request.",
          },
        },
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistant]);
    } catch (e: any) {
      console.error("sendMessage", e);
      toast({
        title: "Chat error",
        description: e?.message || "Edge function returned a non-2xx status.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setActiveFunction(null);
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

  function handleRegenerate(question: string) {
    setInputMessage(question);
    setTimeout(() => sendMessage(), 100);
  }

  function handleShareMessage(message: Message) {
    setMessageToShare(message);
    setShareDialogOpen(true);
  }

  // Handle email action from structured supplier grid
  function handleEmailSupplier(entity: { id: string; name?: string; email?: string }) {
    const supplierName = entity.name || 'supplier';
    const prompt = `Draft a compliance follow-up email to ${supplierName} about their pending documents`;
    setInputMessage(prompt);
    toast({
      title: "Drafting email...",
      description: `Preparing email for ${supplierName}`,
    });
    setTimeout(() => sendMessage(), 100);
  }

  // Handle view details action from structured supplier grid
  function handleViewSupplierDetails(entity: { id: string; name?: string; email?: string }) {
    const supplierName = entity.name || 'supplier';
    const prompt = `Show me detailed compliance information for ${supplierName}`;
    setInputMessage(prompt);
    toast({
      title: "Loading details...",
      description: `Fetching information for ${supplierName}`,
    });
    setTimeout(() => sendMessage(), 100);
  }

  async function handleViewDocumentInNewWindow(doc: DocumentReference) {
    if (!doc.file_path) {
      toast({
        title: "No file available",
        description: "This document doesn't have a file attached.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('secure-document-url', {
        body: { file_path: doc.file_path }
      });
      
      if (error) throw error;
      
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast({
        title: "Error",
        description: "Failed to open document.",
        variant: "destructive"
      });
    }
  }

  async function handleCopyDocumentLink(doc: DocumentReference) {
    try {
      const { data, error } = await supabase.functions.invoke('document-link-handler', {
        body: {
          action: 'create_link',
          document_id: doc.id,
          permission_level: 'view',
          expires_in_days: 30
        }
      });
      
      if (error) throw error;
      
      const shareableUrl = `${window.location.origin}/shared/document/${data.access_token}`;
      
      await navigator.clipboard.writeText(shareableUrl);
      
      toast({
        title: "Link copied!",
        description: "Document link copied to clipboard",
      });
    } catch (e: any) {
      toast({
        title: "Error",
        description: "Failed to copy link.",
        variant: "destructive"
      });
    }
  }

  /* ---- Voice Functions ---- */

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm;codecs=opus' 
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length === 0) {
          toast({
            title: "No audio recorded",
            description: "Please try speaking louder or check your microphone.",
            variant: "destructive"
          });
          return;
        }
        
        // Convert to base64 and send for transcription
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      
      toast({
        title: "Recording started",
        description: "Speak now... Click mic again to stop.",
      });
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to use voice input.",
        variant: "destructive"
      });
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function transcribeAudio(audioBlob: Blob) {
    setIsTranscribing(true);
    try {
      // Convert blob to base64
      const buffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 32768;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);
      
      const { data, error } = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio }
      });
      
      if (error) throw error;
      
      if (data?.text) {
        setInputMessage(prev => prev ? `${prev} ${data.text}` : data.text);
        toast({
          title: "Transcription complete",
          description: "Your speech has been added to the input.",
        });
        inputRef.current?.focus();
      } else {
        throw new Error('No text returned from transcription');
      }
    } catch (error: any) {
      console.error('Transcription error:', error);
      toast({
        title: "Transcription failed",
        description: error.message || "Failed to transcribe audio. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsTranscribing(false);
    }
  }

  function handleMicClick() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  async function playLastResponse() {
    // Find last assistant message
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) {
      toast({
        title: "No response to play",
        description: "There's no AI response to read aloud yet.",
        variant: "destructive"
      });
      return;
    }
    
    // Extract text from structured response or plain content
    let textToSpeak = '';
    const structured = lastAssistant.metadata?.structured_response;
    
    if (structured) {
      // Priority: response > content > narrative extraction
      textToSpeak = structured.response || structured.content || '';
      
      // If still empty, try to extract from sections
      if (!textToSpeak && structured.sections) {
        textToSpeak = structured.sections.map((s: any) => s.content).join(' ');
      }
    }
    
    if (!textToSpeak && typeof lastAssistant.content === 'string') {
      textToSpeak = lastAssistant.content;
    }
    
    if (!textToSpeak) {
      toast({
        title: "Cannot read response",
        description: "This response doesn't contain readable text.",
        variant: "destructive"
      });
      return;
    }
    
    // Clean markdown and HTML
    textToSpeak = textToSpeak
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold
      .replace(/\*(.*?)\*/g, '$1')       // Italic
      .replace(/#{1,6}\s/g, '')          // Headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links
      .replace(/<[^>]+>/g, '')           // HTML tags
      .replace(/`{1,3}[^`]*`{1,3}/g, '') // Code blocks
      .trim();
    
    if (textToSpeak.length > 4096) {
      textToSpeak = textToSpeak.substring(0, 4096);
    }
    
    setIsGeneratingAudio(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('text-to-voice', {
        body: { text: textToSpeak, voice: 'alloy' }
      });
      
      if (error) throw error;
      
      if (!data?.audioContent) {
        throw new Error('No audio content returned');
      }
      
      // Decode base64 and play
      const audioData = atob(data.audioContent);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      
      const audioBlob = new Blob([audioArray], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onplay = () => setIsPlayingAudio(true);
      audio.onended = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(audioUrl);
        toast({
          title: "Playback error",
          description: "Failed to play audio.",
          variant: "destructive"
        });
      };
      
      await audio.play();
    } catch (error: any) {
      console.error('TTS error:', error);
      toast({
        title: "Text-to-speech failed",
        description: error.message || "Failed to generate audio.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingAudio(false);
    }
  }

  function handleAudioClick() {
    if (isPlayingAudio) {
      stopAudio();
    } else {
      playLastResponse();
    }
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

        {/* Structured Response Renderer - for AI responses with HTML-like tags */}
        {!isError && (parsed.response || parsed.content) && hasStructuredContent(parsed.response || parsed.content || '') && (
          <StructuredResponseRenderer 
            content={parsed.response || parsed.content || ''} 
            onEmailSupplier={handleEmailSupplier}
            onViewSupplierDetails={handleViewSupplierDetails}
          />
        )}

        {/* Narrative / markdown - only if no structured content */}
        {!isError && (parsed.response || parsed.content) && !hasStructuredContent(parsed.response || parsed.content || '') && (
          <div className="text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>
              {parsed.response || parsed.content || ""}
            </ReactMarkdown>
          </div>
        )}

        {/* Document request creation success */}
        {!isError && parsed.action === 'document_requests_created' && parsed.data && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">
                Document Requests Created Successfully
              </h4>
            </div>
            <div className="text-sm text-emerald-800 dark:text-emerald-200 space-y-2">
              <div className="grid gap-2">
                <p className="flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  <span>Supplier: <strong>{parsed.data.supplier_name}</strong></span>
                </p>
                <p className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Documents requested: <strong>{parsed.data.created_count}</strong></span>
                </p>
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Due date: <strong>{format(new Date(parsed.data.due_date), "MMM dd, yyyy")}</strong></span>
                </p>
                <p className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Priority: <strong className="uppercase">{parsed.data.priority}</strong></span>
                </p>
              </div>
              {parsed.data.document_types && parsed.data.document_types.length > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                  <p className="font-medium mb-2">Requested documents:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    {parsed.data.document_types.map((doc: string, idx: number) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}
              {parsed.data.failed_count > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                  <p className="flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4" />
                    {parsed.data.failed_count} request(s) failed
                  </p>
                  {parsed.data.errors && (
                    <ul className="text-xs list-disc list-inside ml-6 mt-1 space-y-0.5">
                      {parsed.data.errors.map((err: string, i: number) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Code Visualization - PRIORITY RENDERING */}
        {!isError && parsed.type === 'code_visualization' && parsed.code && parsed.data && (
          <div className="my-4">
            <CodeVisualizationRenderer
              code={parsed.code}
              data={parsed.data}
              summary={parsed.summary || ''}
            />
          </div>
        )}

        {/* Compliance Insights Dashboard - AI Tool Triggered */}
        {!isError && parsed.type === 'compliance_insights_dashboard' && parsed.metrics && companyInfo && (
          <div className="my-4">
            <AdvancedComplianceInsightsDashboard
              companyId={companyInfo.id}
              companyType={companyInfo.type}
              initialData={{
                metrics: {
                  ...parsed.metrics,
                  trend_data: parsed.metrics.trend_data || []
                },
                supplier_metrics: parsed.supplier_metrics || [],
                ai_insights: parsed.ai_insights || []
              }}
              timeframe={(parsed.timeframe as '7D' | '30D' | '90D' | '1Y') || '30D'}
            />
          </div>
        )}

        {/* Email Composer - Compliance Follow-up Emails */}
        {!isError && parsed.type === 'email_composer' && parsed.drafts && companyInfo && (
          <ComplianceEmailComposer
            drafts={parsed.drafts}
            actionType={parsed.action_type || 'general_followup'}
            buyerId={companyInfo.id}
            onClose={() => {}}
            onSent={(results) => {
              toast({
                title: "Emails Sent",
                description: `Successfully sent ${results.total_emails_sent} email(s).`,
              });
            }}
          />
        )}
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
                quickActions={Array.isArray(parsed.quick_actions) ? parsed.quick_actions.filter((qa): qa is { label: string; action: string; action_type?: string; parameters?: Record<string, any>; data?: any; } => typeof qa === "object" && qa !== null) : []}
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
                  className={`border-l-4 transition-all hover:shadow-lg ${getStatusColor(doc.status)}`}
                >
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(doc.status)}
                        <h3 className="font-semibold text-lg text-foreground">{doc.title}</h3>
                      </div>

                      {doc.supplier_name && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building className="w-4 h-4" />
                          <span>{doc.supplier_name}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                          {doc.document_type}
                        </Badge>

                        {doc.expiration_date && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
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
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400"
                              : doc.status === "pending_review"
                              ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-400"
                              : "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-400"
                          }`}
                        >
                          {doc.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {doc.file_path && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDocumentInNewWindow(doc)}
                          className="gap-2 hover:bg-primary/10"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyDocumentLink(doc)}
                        className="gap-2 hover:bg-primary/10"
                      >
                        <Link className="w-4 h-4" />
                        Copy Link
                      </Button>
                    </div>
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
                        className={`border-l-4 transition-all hover:shadow-lg ${getStatusColor(doc.status)}`}
                      >
                        <div className="flex items-start justify-between gap-4 p-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(doc.status)}
                              <h3 className="font-semibold text-lg text-foreground">{doc.title}</h3>
                            </div>

                            {doc.supplier_name && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Building className="w-4 h-4" />
                                <span>{doc.supplier_name}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                                {doc.document_type}
                              </Badge>

                              {doc.expiration_date && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Calendar className="w-4 h-4" />
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
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400"
                                    : doc.status === "pending_review"
                                    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-400"
                                    : "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-400"
                                }`}
                              >
                                {doc.status.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>

                          {doc.file_path && (
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDocumentInNewWindow(doc)}
                                className="gap-2 hover:bg-primary/10"
                              >
                                <ExternalLink className="w-4 h-4" />
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyDocumentLink(doc)}
                                className="gap-2 hover:bg-primary/10"
                              >
                                <Link className="w-4 h-4" />
                                Copy Link
                              </Button>
                            </div>
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

  /* ---- Quick Actions & Suggested Insights ---- */
  
  const quickActions = [
    { label: "Search Suppliers", icon: Users, query: "Show me all my connected suppliers with their compliance status" },
    { label: "Browse Documents", icon: FileText, query: "List all documents pending review" },
    { label: "Compliance Gaps", icon: AlertCircle, query: "Which documents are expired or expiring soon?" },
    { label: "Insights", icon: TrendingUp, query: "Give me a compliance overview and key metrics" },
  ];

  const suggestedInsights = [
    "Suppliers with expiring certifications this quarter",
    "Top compliance risks by document type",
    "Documents frequently missing across suppliers",
  ];

  const handleQuickAction = (query: string) => {
    setInputMessage(query);
    // Auto-send after setting
    setTimeout(() => {
      const syntheticEvent = { key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>;
      handleKeyPress(syntheticEvent);
    }, 100);
  };

  /* ---- UI ---- */

  return (
    <div className="h-screen bg-background flex overflow-hidden">

      {/* History Sheet (Universal - triggered by menu button) */}
      <Sheet open={showHistory} onOpenChange={setShowHistory}>
        <SheetContent side="left" className="w-80 p-0">
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Chat History</h2>
              <Button size="sm" variant="outline" onClick={startNewChat}>
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
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
                {chatSessions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No chat history yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col w-full min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            /* Discovery Landing Page */
            <div className="flex flex-col min-h-full">
              {/* Header with Menu Button */}
              <div className="flex items-center justify-between gap-3 py-2 px-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-lg"
                    onClick={() => setShowHistory(true)}
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                  <span className="text-sm font-medium text-muted-foreground">Discovery</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {isLoading 
                      ? (activeFunction 
                          ? `${functionDisplayNames[activeFunction] || 'Processing'}...` 
                          : 'Searching...')
                      : `Hey ${profile?.full_name?.split(' ')[0] || 'there'}, good ${getTimeOfDayGreeting()}!`
                    }
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-lg"
                    onClick={() => navigate('/dashboard')}
                    title="Go to Dashboard"
                  >
                    <Home className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Centered Content */}
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white">
                <div className="w-full max-w-2xl space-y-8">
                  {/* Discovery Headline */}
                  <div className="text-center space-y-2">
                    <h1 className="text-3xl md:text-4xl font-semibold text-foreground">
                      Explore suppliers, documents, and compliance insights
                    </h1>
                    <p className="text-muted-foreground text-base">
                      Ask questions, search your data, or click a suggestion below
                    </p>
                  </div>
                  
                  {/* Smart Search Input */}
                  <div className="relative flex items-center gap-2 bg-card border border-border rounded-2xl shadow-lg hover:shadow-xl transition-all p-3">
                    <Search className="w-5 h-5 text-muted-foreground ml-2" />
                    <Input
                      ref={inputRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Find suppliers missing compliance documents..."
                      className="flex-1 border-0 focus-visible:ring-0 text-base bg-transparent"
                      disabled={isLoading || isRecording || isTranscribing}
                    />
                    {/* Mic Button */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`rounded-full transition-all ${
                        isRecording 
                          ? 'bg-destructive text-destructive-foreground animate-pulse' 
                          : isTranscribing 
                            ? 'bg-primary/20' 
                            : ''
                      }`}
                      onClick={handleMicClick}
                      disabled={isTranscribing || isLoading}
                    >
                      {isTranscribing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : isRecording ? (
                        <MicOff className="w-5 h-5" />
                      ) : (
                        <Mic className="w-5 h-5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button 
                      onClick={sendMessage} 
                      disabled={isLoading || !inputMessage.trim()} 
                      size="icon"
                      className="rounded-full h-10 w-10"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>

                  {/* Quick Action Chips */}
                  <div className="flex flex-wrap justify-center gap-3">
                    {quickActions.map((action) => (
                      <Button
                        key={action.label}
                        variant="outline"
                        className="rounded-full gap-2 px-4 py-2 h-auto text-sm hover:bg-accent hover:border-primary/50 transition-all"
                        onClick={() => handleQuickAction(action.query)}
                        disabled={isLoading}
                      >
                        <action.icon className="w-4 h-4" />
                        {action.label}
                      </Button>
                    ))}
                  </div>

                  {/* Suggested Insights */}
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2 justify-center">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">Suggested insights</span>
                    </div>
                    <div className="space-y-2">
                      {suggestedInsights.map((insight, index) => (
                        <button
                          key={index}
                          className="w-full text-left p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-accent hover:border-primary/30 transition-all text-sm text-muted-foreground hover:text-foreground group"
                          onClick={() => handleQuickAction(insight)}
                          disabled={isLoading}
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
                            {insight}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 bg-white">
              {/* Header with Menu Button for Chat View */}
              <div className="flex items-center justify-between gap-3 py-2 px-4 border-b border-border sticky top-0 bg-background z-10">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-lg"
                    onClick={() => setShowHistory(true)}
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                  <span className="text-sm font-medium text-muted-foreground">Compliance Compass</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {isLoading 
                      ? (activeFunction 
                          ? `${functionDisplayNames[activeFunction] || 'Processing'}...` 
                          : 'Searching...')
                      : `Hey ${profile?.full_name?.split(' ')[0] || 'there'}, good ${getTimeOfDayGreeting()}!`
                    }
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-lg"
                    onClick={() => navigate('/dashboard')}
                    title="Go to Dashboard"
                  >
                    <Home className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1 px-6 py-6 max-w-4xl mx-auto w-full bg-white">
                {messages.map((m) => (
                  <div key={m.id} className="flex items-start gap-4 p-6 transition-colors group">
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
                          m.metadata?.structured_response || typeof m.content !== "string"
                            ? renderStructuredMessage(m)
                            : <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        ) : typeof m.content === "string" ? (
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        ) : (
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {JSON.stringify(m.content, null, 2)}
                          </pre>
                        )}
                      </div>

                      {/* Action buttons for assistant messages */}
                      {m.role === 'assistant' && (
                        <ResponseActionButtons
                          message={m}
                          messages={messages}
                          onRegenerate={handleRegenerate}
                          onShare={handleShareMessage}
                        />
                      )}
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
            </div>
          )}
        </div>
        {messages.length > 0 && (
          <div className="sticky bottom-0 p-6 pb-8">
            <div className="max-w-3xl mx-auto">
              <div className="relative flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border/50 rounded-full shadow-lg hover:shadow-xl transition-all p-3 px-4">
                {/* Mic Button */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`rounded-full transition-all ${
                    isRecording 
                      ? 'bg-destructive text-destructive-foreground animate-pulse' 
                      : isTranscribing 
                        ? 'bg-primary/20' 
                        : ''
                  }`}
                  onClick={handleMicClick}
                  disabled={isTranscribing || isLoading}
                >
                  {isTranscribing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isRecording ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5 text-muted-foreground" />
                  )}
                </Button>
                <Input
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about documents, compliance, or regulations..."
                  className="flex-1 border-0 focus-visible:ring-0 text-base bg-transparent"
                  disabled={isLoading || isRecording || isTranscribing}
                />
                {/* Audio Button */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`rounded-full transition-all ${
                    isPlayingAudio 
                      ? 'bg-primary text-primary-foreground' 
                      : isGeneratingAudio 
                        ? 'bg-primary/20' 
                        : ''
                  }`}
                  onClick={handleAudioClick}
                  disabled={isGeneratingAudio}
                >
                  {isGeneratingAudio ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isPlayingAudio ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-muted-foreground" />
                  )}
                </Button>
                <Button 
                  onClick={sendMessage} 
                  disabled={isLoading || !inputMessage.trim()} 
                  size="icon"
                  className="rounded-full h-10 w-10 shadow-sm bg-black hover:bg-gray-800 text-white"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Document Viewer */}
      <ChatDocumentViewer
        document={selectedDocument}
        isOpen={isDocumentViewerOpen}
        onClose={closeDocumentViewer}
      />

      {/* Share Dialog */}
      {messageToShare && (
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          message={messageToShare}
        />
      )}
    </div>
  );
};

export default ChatPage;
