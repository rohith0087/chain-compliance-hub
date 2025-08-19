import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import ChatDocumentViewer from "@/components/chat/ChatDocumentViewer";
import ComplianceVisualizer from "@/components/chat/ComplianceVisualizer";
import DailyInsightsPanel from "@/components/chat/DailyInsightsPanel";
import ActionExecutor from "@/components/chat/ActionExecutor";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  MessageSquare, 
  Send, 
  User, 
  Loader2, 
  History,
  Plus,
  FileText,
  AlertCircle,
  Download,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  Sparkles,
  Menu,
  ChevronDown,
  Building,
  Shield
} from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
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

interface StructuredResponse {
  response: string;
  content?: string;
  sections?: Array<{
    title: string;
    content: string;
    type?: string;
  }>;
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
    priority: 'low' | 'medium' | 'high';
    estimated_time: string;
    action_type: string;
    parameters: Record<string, any>;
  }>;
  suggested_actions?: Array<{
    label: string;
    description: string;
    action_type: string;
    parameters: Record<string, any>;
    urgency: 'low' | 'medium' | 'high';
  }>;
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

const ChatPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [companyInfo, setCompanyInfo] = useState<{id: string, type: string, industry?: string} | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [dynamicQuestions, setDynamicQuestions] = useState<string[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentReference | null>(null);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Get company info on mount
  useEffect(() => {
    getCompanyInfo();
    loadChatSessions();
  }, [user]);

  // Load dynamic questions when company info is available
  useEffect(() => {
    if (companyInfo) {
      loadDynamicQuestions();
    }
  }, [companyInfo]);

  const getCompanyInfo = async () => {
    if (!user) return;

    try {
      // Check if user is a buyer
      const { data: buyerData } = await supabase
        .from('buyers')
        .select('id, industry')
        .eq('profile_id', user.id)
        .single();

      if (buyerData) {
        setCompanyInfo({ id: buyerData.id, type: 'buyer', industry: buyerData.industry });
        return;
      }

      // Check if user is a supplier
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('id, industry')
        .eq('profile_id', user.id)
        .single();

      if (supplierData) {
        setCompanyInfo({ id: supplierData.id, type: 'supplier', industry: supplierData.industry });
      }
    } catch (error) {
      console.error('Error getting company info:', error);
    }
  };

  const loadDynamicQuestions = async () => {
    if (!companyInfo) return;

    try {
      // Get top suppliers
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('company_name')
        .limit(3);

      // Get common document types
      const { data: docTypes } = await supabase
        .from('document_requests')
        .select('document_type')
        .limit(3);

      // Get pending documents count
      const { data: pendingDocs } = await supabase
        .from('document_uploads')
        .select('status')
        .eq('status', 'pending_review');

      const questions = [];
      
      if (suppliers && suppliers.length > 0) {
        questions.push(`Show me documents from ${suppliers[0].company_name}`);
      }
      
      if (docTypes && docTypes.length > 0) {
        questions.push(`When do our ${docTypes[0].document_type} certificates expire?`);
      }
      
      if (pendingDocs && pendingDocs.length > 0) {
        questions.push(`Show me the ${pendingDocs.length} documents pending review`);
      }
      
      questions.push("What documents need my attention today?");
      questions.push("Show me compliance gaps and recommendations");
      questions.push("Find documents expiring in the next 30 days");

      setDynamicQuestions(questions);
    } catch (error) {
      console.error('Error loading dynamic questions:', error);
      // Fallback to static questions
      setDynamicQuestions([
        "Show me documents from our suppliers",
        "When do our certificates expire?",
        "Which documents are pending review?",
        "What documents need attention today?",
        "Show me compliance status",
        "Find expired documents"
      ]);
    }
  };

  const loadChatSessions = async () => {
    if (!user || !companyInfo) return;

    try {
      const { data: sessions } = await supabase
        .from('chat_sessions')
        .select('id, session_title, created_at, updated_at')
        .eq('user_id', user.id)
        .eq('company_id', companyInfo.id)
        .eq('company_type', companyInfo.type)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (sessions) {
        setChatSessions(sessions);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const loadChatHistory = async (sessionId: string) => {
    try {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (messages) {
        setMessages(messages.map(msg => ({
          ...msg,
          role: msg.role as 'user' | 'assistant' | 'system'
        })));
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

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

  const sendMessage = async () => {
    if (!inputMessage.trim() || !companyInfo || !user) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('rag-chat', {
        body: {
          message: inputMessage,
          company_id: companyInfo.id,
          company_type: companyInfo.type,
          session_id: currentSession,
          conversation_history: messages.slice(-10) // Last 10 messages for context
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: typeof data?.response === 'string'
          ? data.response
          : typeof data?.content === 'string'
          ? data.content
          : typeof data?.message === 'string'
          ? data.message
          : "The assistant provided a structured response.",
        metadata: {
          ...data,
          structured_response: data
        },
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.session_id && data.session_id !== currentSession) {
        setCurrentSession(data.session_id);
        loadChatSessions(); // Refresh sessions list
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleViewDocument = (document: DocumentReference) => {
    setSelectedDocument(document);
    setIsDocumentViewerOpen(true);
  };

  const closeDocumentViewer = () => {
    setIsDocumentViewerOpen(false);
    setSelectedDocument(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20';
      case 'pending_review':
        return 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20';
      case 'rejected':
        return 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20';
      case 'expired':
        return 'border-l-red-600 bg-red-50/50 dark:bg-red-950/20';
      default:
        return 'border-l-primary/20 bg-card';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-3 h-3 text-emerald-600" />;
      case 'pending_review':
        return <Clock className="w-3 h-3 text-amber-600" />;
      case 'rejected':
        return <XCircle className="w-3 h-3 text-red-600" />;
      case 'expired':
        return <AlertCircle className="w-3 h-3 text-red-600" />;
      default:
        return <FileText className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const renderStructuredMessage = (message: Message) => {
    // Check if we have a structured response in metadata first
    if (message.metadata?.structured_response) {
      const parsed: StructuredResponse = message.metadata.structured_response;
      
      return (

        <div className="space-y-6">
{(typeof parsed.response === 'string' || typeof parsed.content === 'string') && (
            <p className="text-muted-foreground leading-relaxed">
              {typeof parsed.response === 'string'
                ? parsed.response
                : (typeof parsed.content === 'string' ? parsed.content : '')}
            </p>
          )}
          
          {/* Action Executor */}
          {(((parsed.actionable_items?.length ?? 0) > 0) || ((parsed.suggested_actions?.length ?? 0) > 0) || (Array.isArray(parsed.quick_actions) && parsed.quick_actions.some(qa => (qa as any)?.action_type && (qa as any)?.action_type !== 'navigate'))) && (
            <div className="border-l-4 border-primary/20 pl-4">
              <ActionExecutor
                actionItems={parsed.actionable_items}
                suggestedActions={parsed.suggested_actions}
                quickActions={parsed.quick_actions}
                sessionId={currentSession || 'temp-session'}
                onActionComplete={(result) => {
                  toast({
                    title: "Action Completed",
                    description: result.message,
                  });
                }}
              />
            </div>
          )}
          
          {parsed.sections?.map((section, index) => (
            <div key={index} className="space-y-3">
              <h4 className="font-semibold text-foreground">{section.title}</h4>
              {section.type === 'list' ? (
                <div className="space-y-1 pl-4">
                  {section.content.split('\n').filter(line => line.trim()).map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{item.replace(/^[-•]\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground leading-relaxed">{section.content}</p>
              )}
            </div>
          ))}

          {parsed.documents && parsed.documents.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Related Documents ({parsed.documents.length})
              </h4>
              
              {/* Show top 3 documents */}
              <div className="grid gap-3">
                {parsed.documents.slice(0, 3).map((doc, index) => (
                  <Card key={index} className={`p-4 border-l-4 transition-all hover:shadow-md ${getStatusColor(doc.status)}`}>
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
                          <Badge 
                            variant="secondary" 
                            className="bg-primary/10 text-primary hover:bg-primary/20"
                          >
                            {doc.document_type}
                          </Badge>
                          
                          {doc.expiration_date && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span>Expires: {format(new Date(doc.expiration_date), 'MMM dd, yyyy')}</span>
                            </div>
                          )}
                          
                          <Badge 
                            variant="outline" 
                            className={`capitalize ${
                              doc.status === 'approved' ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' :
                              doc.status === 'pending_review' ? 'border-amber-500 text-amber-700 dark:text-amber-400' :
                              'border-red-500 text-red-700 dark:text-red-400'
                            }`}
                          >
                            {doc.status.replace('_', ' ')}
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

              {/* Collapsible section for remaining documents */}
              {parsed.documents.length > 3 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground">
                      <span>Show {parsed.documents.length - 3} more documents</span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="grid gap-3">
                      {parsed.documents.slice(3).map((doc, index) => (
                        <Card key={index + 3} className={`p-4 border-l-4 transition-all hover:shadow-md ${getStatusColor(doc.status)}`}>
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
                                <Badge 
                                  variant="secondary" 
                                  className="bg-primary/10 text-primary hover:bg-primary/20"
                                >
                                  {doc.document_type}
                                </Badge>
                                
                                {doc.expiration_date && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Calendar className="w-3 h-3" />
                                    <span>Expires: {format(new Date(doc.expiration_date), 'MMM dd, yyyy')}</span>
                                  </div>
                                )}
                                
                                <Badge 
                                  variant="outline" 
                                  className={`capitalize ${
                                    doc.status === 'approved' ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' :
                                    doc.status === 'pending_review' ? 'border-amber-500 text-amber-700 dark:text-amber-400' :
                                    'border-red-500 text-red-700 dark:text-red-400'
                                  }`}
                                >
                                  {doc.status.replace('_', ' ')}
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

          {parsed.quick_actions && parsed.quick_actions.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Quick Actions</h4>
              <div className="flex flex-wrap gap-2">
                {parsed.quick_actions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => setInputMessage(action.action || action.label)}
                    className="text-xs hover:bg-primary/10 hover:border-primary/20"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Render Visual Data */}
          {parsed.visual_data && (
            <div className="mt-4">
              <ComplianceVisualizer visualData={parsed.visual_data} />
            </div>
          )}

          {/* Render Daily Insights */}
          {parsed.daily_insights && (
            <div className="mt-4">
              <DailyInsightsPanel insights={parsed.daily_insights} />
            </div>
          )}

          {/* Render Navigation Quick Actions */}
          {parsed.quick_actions && parsed.quick_actions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
              {parsed.quick_actions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (typeof action === 'string') {
                      setInputMessage(action);
                    } else {
                      setInputMessage(action.action || action.label);
                    }
                  }}
                  className="text-xs hover:bg-primary/10 hover:border-primary/20"
                >
                  {typeof action === 'string' ? action : action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Fallback: try to parse content as JSON if no structured response in metadata
    try {
      const parsed: StructuredResponse = JSON.parse(message.content);
      
      return (
        <div>
          <p className="text-muted-foreground leading-relaxed">{typeof parsed.response === 'string' ? parsed.response : (typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed))}</p>
          {parsed.visual_data && (
            <div className="mt-4">
              <ComplianceVisualizer visualData={parsed.visual_data} />
            </div>
          )}
          {parsed.daily_insights && (
            <div className="mt-4">
              <DailyInsightsPanel insights={parsed.daily_insights} />
            </div>
          )}
        </div>
      );

      // Re-render with the parsed structured response
      return renderStructuredMessage({
        ...message,
        metadata: {
          ...message.metadata,
          structured_response: parsed
        }
      });
    } catch (error) {
      // Final fallback to plain text
      return typeof message.content === 'string'
        ? <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{message.content}</p>
        : <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(message.content, null, 2)}</pre>;
    }
  };


  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* History Sidebar for Desktop */}
      <div className="hidden lg:flex w-80 border-r border-border bg-card flex-col">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 p-6 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Chat History</h2>
            <Button size="sm" variant="outline" onClick={startNewChat}>
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
        </div>
        
        {/* Scrollable History List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="p-4 space-y-2">
            {chatSessions.map((session) => (
              <Card
                key={session.id}
                className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                  currentSession === session.id ? 'bg-accent border-primary' : ''
                }`}
                onClick={() => selectSession(session)}
              >
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-foreground">
                      {session.session_title || 'Untitled Chat'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(session.updated_at), 'MMM dd, yyyy')}
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
                      currentSession === session.id ? 'bg-accent border-primary' : ''
                    }`}
                    onClick={() => selectSession(session)}
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-foreground">
                          {session.session_title || 'Untitled Chat'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(session.updated_at), 'MMM dd, yyyy')}
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
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setShowHistory(true)}
              >
                <Menu className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h1 className="font-semibold text-foreground">Compliance Assistant</h1>
                  <p className="text-xs text-muted-foreground capitalize">{companyInfo?.type} • {companyInfo?.industry || 'General'}</p>
                </div>
              </div>
            </div>
            
            <Button variant="outline" size="sm" onClick={startNewChat}>
              <Plus className="w-4 h-4 mr-1" />
              New Chat
            </Button>
          </div>
        </div>

        {/* Chat Messages - Scrollable Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6" ref={scrollAreaRef}>
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
              {messages.map((message, index) => (
                <div key={message.id} className="flex items-start gap-4 p-6 hover:bg-accent/30 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20'
                  }`}>
                    {message.role === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Shield className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="font-medium text-sm text-foreground">
                      {message.role === 'user' ? 'You' : 'Compliance AI'}
                    </div>
                    <div className="prose prose-sm max-w-none">
{message.role === 'assistant' ? 
                        renderStructuredMessage(message) : 
                        (typeof message.content === 'string' ? (
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(message.content, null, 2)}</pre>
                        ))
                      }
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
                        <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                      Analyzing your request...
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Input Area */}
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
                  Knowledge sources: {messages[messages.length - 1]?.metadata?.knowledge_entries_used || 0} • 
                  Documents found: {messages[messages.length - 1]?.metadata?.documents_found || 0}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      <ChatDocumentViewer
        document={selectedDocument}
        isOpen={isDocumentViewerOpen}
        onClose={closeDocumentViewer}
      />
    </div>
  );
};

export default ChatPage;