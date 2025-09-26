import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Lightbulb,
  FileText,
  Download,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  AlertTriangle,
  Info,
  Zap,
  Brain,
  Shield,
  Sparkles,
  Activity,
  Eye,
  Mic,
  Volume2,
  Settings,
  MoreHorizontal
} from "lucide-react";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at: string;
}

interface ChatSource {
  title: string;
  type: string;
  similarity: number;
}

interface StructuredResponse {
  type: 'structured' | 'simple';
  content: string;
  sections?: {
    title: string;
    content: string;
    type: 'text' | 'list' | 'document_card' | 'document_overview' | 'metric_summary' | 'alert' | 'status_update' | 'executive_summary' | 'bullet_list' | 'insights' | 'actions';
  }[];
  documents?: DocumentReference[];
  quick_actions?: string[];
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

interface ChatAgentPanelProps {
  companyType: 'buyer' | 'supplier';
  companyId: string;
  className?: string;
}

const FuturisticChatInterface: React.FC<ChatAgentPanelProps> = ({ 
  companyType, 
  companyId, 
  className = "" 
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastSources, setLastSources] = useState<ChatSource[]>([]);
  const [voiceMode, setVoiceMode] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load chat history
  useEffect(() => {
    loadChatHistory();
  }, [companyId]);

  const loadChatHistory = async () => {
    try {
      const { data: sessions } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (sessions && sessions.length > 0) {
        const currentSessionId = sessions[0].id;
        setSessionId(currentSessionId);

        const { data: chatMessages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', currentSessionId)
          .order('created_at', { ascending: true })
          .limit(50);

        if (chatMessages) {
          const typedMessages: Message[] = chatMessages.map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            metadata: msg.metadata,
            created_at: msg.created_at
          }));
          setMessages(typedMessages);
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // Add user message to UI immediately
    const tempUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const { data, error } = await supabase.functions.invoke('rag-chat', {
        body: {
          message: userMessage,
          session_id: sessionId,
          context_tags: [companyType, 'compliance', 'documents']
        }
      });

      if (error) throw error;

      // Add AI response to messages
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: typeof data.response === 'string' ? data.response : JSON.stringify(data.response),
        metadata: {
          knowledge_entries_used: data.knowledge_entries_used,
          documents_found: data.documents_found,
          sources: data.sources,
          structured_response: typeof data.response === 'object' ? data.response : null
        },
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setSessionId(data.session_id);
      setLastSources(data.sources || []);

      // Show success toast
      const docInfo = data.documents_found > 0 ? ` and ${data.documents_found} documents` : '';
      if (data.knowledge_entries_used > 0 || data.documents_found > 0) {
        toast({
          title: "AI Response Generated",
          description: `Used ${data.knowledge_entries_used} knowledge sources${docInfo}`,
        });
      }

    } catch (error) {
      console.error('Chat error:', error);
      
      // Remove the temp user message and show error
      setMessages(prev => prev.slice(0, -1));
      
      toast({
        title: "Chat Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getMessageIcon = (role: string) => {
    switch (role) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'assistant':
        return <Bot className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getQuickActions = () => {
    const actions = companyType === 'buyer' ? [
      "What documents do I need from suppliers?",
      "How can I improve compliance rates?", 
      "Show me recent document analysis results",
      "What are the main compliance risks?"
    ] : [
      "What documents are required for compliance?",
      "How can I improve my document approval rates?",
      "What are common rejection reasons?",
      "Show me industry-specific requirements"
    ];

    return actions;
  };

  const getDocumentStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
      case 'pending_review':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'expired':
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const isExpiringSoon = (expirationDate: string) => {
    if (!expirationDate) return false;
    const expiry = new Date(expirationDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (expirationDate: string) => {
    if (!expirationDate) return false;
    return new Date(expirationDate) < new Date();
  };

  const renderStructuredMessage = (message: Message) => {
    if (!message.metadata?.structured_response) {
      return typeof message.content === 'string'
        ? <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        : <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(message.content, null, 2)}</pre>;
    }

    const response: StructuredResponse = message.metadata.structured_response;

    return (
      <div className="space-y-3">
        {/* Main content */}
        {response.content && typeof response.content === 'string' && (
          <p className="text-sm">{response.content}</p>
        )}
        {!response.content && typeof (response as any).response === 'string' && (
          <p className="text-sm">{(response as any).response}</p>
        )}

        {/* Sections */}
        {response.sections?.map((section, idx) => {
          const sectionStyle = section.type === 'executive_summary' ? 
            'border-l-4 border-l-primary bg-primary/5' : 
            section.type === 'alert' || section.title?.includes('⚠️') ? 
            'border-l-4 border-l-destructive bg-destructive/5' :
            section.title?.includes('✅') ?
            'border-l-4 border-l-green-500 bg-green-500/5' :
            'border-l-2 border-l-muted-foreground/30 bg-muted/20';

          return (
            <div key={idx} className={`rounded-lg p-4 ${sectionStyle}`}>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                {section.title}
              </h4>
              
              {section.type === 'document_overview' ? (
                <div className="space-y-3">
                  {section.content.split('\n').filter(line => line.trim()).map((line, i) => {
                    const cleanLine = line.replace(/^[•\-\*]\s*/, '').trim();
                    
                    if (!cleanLine) return null;
                    
                    // Check if this is a bullet point
                    if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
                      // Check if this contains document information
                      const isDocumentLine = cleanLine.match(/(expires|expiring|expired|from\s+\w+|document type|status:|pending|approved|rejected)/i);
                      
                      if (isDocumentLine) {
                        const parts = cleanLine.split(/,|\s-\s|\|/);
                        return (
                          <div key={i} className="bg-background/80 rounded-md p-3 border border-border/50">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-1">
                                {parts.map((part, idx) => {
                                  const trimmedPart = part.trim();
                                  if (trimmedPart.match(/expires|expiring|expired/i)) {
                                    const isExpired = trimmedPart.match(/expired/i);
                                    const isExpiringSoon = trimmedPart.match(/expiring|expires.*(\d{1,2}\s+days?)/i);
                                    return (
                                      <div key={idx} className={`text-xs flex items-center gap-1 font-medium ${
                                        isExpired ? 'text-red-600' : 
                                        isExpiringSoon ? 'text-amber-600' : 'text-muted-foreground'
                                      }`}>
                                        <Calendar className="h-3 w-3" />
                                        {trimmedPart}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={idx} className="text-sm font-medium text-foreground">
                                      {trimmedPart}
                                    </div>
                                  );
                                })}
                              </div>
                              <FileText className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <div className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                          <span className="text-foreground">{cleanLine}</span>
                        </div>
                      );
                    }
                    
                    return (
                      <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                        {cleanLine}
                      </p>
                    );
                  })}
                </div>
              ) : section.type === 'bullet_list' || section.type === 'list' || section.type === 'insights' || section.type === 'actions' ? (
                <div className="space-y-2">
                  {section.content.split('\n').filter(line => line.trim()).map((item, i) => {
                    const cleanItem = item.replace(/^[•\-\*]\s*/, '').trim();
                    if (!cleanItem) return null;
                    
                    // Check for priority indicators
                    const isPriority = cleanItem.match(/🔴|critical|urgent|immediate/i);
                    const isImportant = cleanItem.match(/🟡|important|soon|attention/i);
                    
                    return (
                      <div key={i} className={`flex items-start gap-2 text-sm p-2 rounded ${
                        isPriority ? 'bg-red-50 border-l-2 border-l-red-500' :
                        isImportant ? 'bg-yellow-50 border-l-2 border-l-yellow-500' :
                        'hover:bg-muted/50'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${
                          isPriority ? 'bg-red-500' :
                          isImportant ? 'bg-yellow-500' :
                          'bg-primary'
                        }`} />
                        <span className="text-foreground leading-relaxed">{cleanItem}</span>
                      </div>
                    );
                  })}
                </div>
              ) : section.type === 'executive_summary' ? (
                <div className="space-y-2">
                  {section.content.split('\n').filter(line => line.trim()).map((item, i) => {
                    const cleanItem = item.replace(/^[•\-\*]\s*/, '').trim();
                    if (!cleanItem) return null;
                    
                    return (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-foreground font-medium">{cleanItem}</span>
                      </div>
                    );
                  })}
                </div>
              ) : section.type === 'alert' ? (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-destructive font-medium">{section.content}</p>
                  </div>
                </div>
              ) : section.type === 'status_update' ? (
                <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-primary font-medium">{section.content}</p>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {section.content.split('\n').map((line, i) => {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) return null;
                    
                    if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
                      const cleanLine = trimmedLine.replace(/^[•\-\*]\s*/, '');
                      return (
                        <div key={i} className="flex items-start gap-2 mb-1">
                          <div className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                          <span>{cleanLine}</span>
                        </div>
                      );
                    }
                    
                    return <div key={i} className="mb-1">{trimmedLine}</div>;
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Document cards */}
        {response.documents && response.documents.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Related Documents</h4>
            {response.documents.map((doc, idx) => (
              <div key={idx} className="bg-muted/50 rounded-lg p-3 border">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getDocumentStatusIcon(doc.status)}
                      <span className="font-medium text-sm truncate">{doc.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {doc.supplier_name && (
                        <div>From: {doc.supplier_name}</div>
                      )}
                      <div>Type: {doc.document_type}</div>
                      {doc.expiration_date && (
                        <div className={`flex items-center gap-1 ${
                          isExpired(doc.expiration_date) ? 'text-red-500' : 
                          isExpiringSoon(doc.expiration_date) ? 'text-yellow-500' : ''
                        }`}>
                          <Calendar className="h-3 w-3" />
                          Expires: {new Date(doc.expiration_date).toLocaleDateString()}
                          {isExpired(doc.expiration_date) && ' (EXPIRED)'}
                          {isExpiringSoon(doc.expiration_date) && ' (Expiring Soon)'}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick actions */}
        {response.quick_actions && response.quick_actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {response.quick_actions.map((action: any, idx: number) => {
              const label = typeof action === 'string' ? action : action?.label ?? 'Run action';
              return (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setInputMessage(label)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    );
  };
            <span className="text-xs text-muted-foreground">
              {new Date(message.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Message Bubble */}
          <div className={`relative group ${isUser ? 'ml-8' : 'mr-8'}`}>
            <div className={`rounded-3xl p-4 backdrop-blur-sm relative overflow-hidden ${
              isUser 
                ? 'bg-gradient-to-br from-blue-600 to-purple-700 text-white shadow-xl shadow-blue-500/25' 
                : 'bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl'
            }`}>
              {/* Animated background for AI messages */}
              {isAI && (
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-purple-500/5 animate-pulse opacity-50" />
              )}
              
              <div className="relative z-10">
                {isAI ? 
                  renderStructuredMessage(message) :
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                }
              </div>

              {/* Message Actions */}
              <div className={`absolute top-2 ${isUser ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-white/60 hover:text-white/80">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Show sources for AI responses */}
          {isAI && message.metadata?.sources?.length > 0 && (
            <div className="mt-3 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-3 border border-white/20">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Knowledge sources:
              </p>
              <div className="space-y-1">
                {message.metadata.sources.map((source: ChatSource, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                    <span className="flex-1">{source.title}</span>
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 border-emerald-500/20 text-emerald-600">
                      {source.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 ${className} relative overflow-hidden`}>
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-emerald-400 to-cyan-500 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-pink-400 to-orange-500 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Header */}
      <div className="relative z-10 p-6 border-b border-white/10 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                Nexus AI Assistant
              </h1>
              <p className="text-sm text-muted-foreground">
                Advanced Compliance Intelligence • {companyType === 'buyer' ? 'Buyer Mode' : 'Supplier Mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Indicators */}
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/20">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-600">
                {lastSources.length > 0 ? `${lastSources.length} sources` : 'Ready'}
              </span>
            </div>
            
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/20">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-foreground/80">Online</span>
            </div>

            <Button variant="ghost" size="sm" className="rounded-full w-10 h-10 p-0">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 relative z-10">
        <div className="p-6">
          {messages.length === 0 && (
            <div className="text-center py-12 space-y-6">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/25">
                  <Brain className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-3xl opacity-20 animate-pulse blur-xl" />
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                  Welcome to Nexus AI
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Your advanced compliance intelligence partner. I can analyze documents, predict risks, and automate compliance workflows with precision.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Quick questions:</p>
                {getQuickActions().map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="w-full text-left justify-start h-auto p-3 text-sm bg-white/50 backdrop-blur-sm border-white/20 hover:bg-white/70 transition-all duration-300 hover:shadow-lg"
                    onClick={() => setInputMessage(action)}
                  >
                    <Lightbulb className="h-4 w-4 mr-2 flex-shrink-0 text-emerald-500" />
                    {action}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map(renderMessage)}

          {/* AI Thinking Indicator */}
          {isLoading && (
            <div className="flex gap-4 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-lg shadow-emerald-500/25">
                <Bot className="w-6 h-6 text-white relative z-10" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl opacity-75 animate-pulse" />
              </div>
              
              <div className="flex-1 mr-8">
                <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-4 shadow-xl backdrop-blur-sm relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-purple-500/5 animate-pulse" />
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-200" />
                    </div>
                    <span className="text-sm text-muted-foreground">Nexus AI is analyzing your request...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="relative z-10 p-6 border-t border-white/10 backdrop-blur-sm">
        <div className="relative">
          <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-white/20 p-2 shadow-lg">
            {/* Voice Mode Toggle */}
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-xl transition-all duration-300 ${voiceMode ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : ''}`}
              onClick={() => setVoiceMode(!voiceMode)}
            >
              {voiceMode ? <Volume2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>

            {/* Input Field */}
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Nexus AI anything about compliance..."
              disabled={isLoading}
              className="flex-1 border-0 bg-transparent text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
            />

            {/* Send Button */}
            <Button 
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-xl"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Nexus AI can see context from previous messages
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-500" />
                End-to-end encrypted
              </span>
            </div>
            {lastSources.length > 0 && (
              <div className="flex items-center gap-1">
                <FileText className="w-3 h-3 text-emerald-500" />
                <span>Used {lastSources.length} knowledge source{lastSources.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};<div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-lg shadow-emerald-500/25">
                <Bot className="w-6 h-6 text-white relative z-10" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl opacity-75 animate-pulse" />
              </div>
              
              <div className="flex-1 mr-8">
                <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-4 shadow-xl backdrop-blur-sm relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-purple-500/5 animate-pulse" />
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-200" />
                    </div>
                    <span className="text-sm text-muted-foreground">Nexus AI is analyzing your request...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="relative z-10 p-6 border-t border-white/10 backdrop-blur-sm">
        <div className="relative">
          <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-white/20 p-2 shadow-lg">
            {/* Voice Mode Toggle */}
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-xl transition-all duration-300 ${voiceMode ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : ''}`}
              onClick={() => setVoiceMode(!voiceMode)}
            >
              {voiceMode ? <Volume2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>

            {/* Input Field */}
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Nexus AI anything about compliance..."
              disabled={isLoading}
              className="flex-1 border-0 bg-transparent text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
            />

            {/* Send Button */}
            <Button 
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-xl"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Nexus AI can see context from previous messages
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-500" />
                End-to-end encrypted
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${networkStrength > 80 ? 'bg-green-500' : networkStrength > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
              <span>{networkStrength}% network</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FuturisticChatInterface;