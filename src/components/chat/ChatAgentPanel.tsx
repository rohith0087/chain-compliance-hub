import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertCircle,
  Download,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  AlertTriangle,
  Info
} from "lucide-react";
import { format } from "date-fns";

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

const ChatAgentPanel: React.FC<ChatAgentPanelProps> = ({ 
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
                          Expires: {format(new Date(doc.expiration_date), 'MMM dd, yyyy')}
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

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          Compliance AI Assistant
          <Badge variant="secondary" className="ml-auto">
            {companyType === 'buyer' ? 'Buyer' : 'Supplier'}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4 p-4">
        {/* Messages Area */}
        <ScrollArea 
          ref={scrollAreaRef}
          className="flex-1 pr-4 scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">Welcome to your AI Assistant!</p>
                <p className="text-sm">I can help you with compliance questions, document requirements, and industry-specific guidance.</p>
                
                {/* Quick Actions */}
                <div className="mt-6 space-y-2">
                  <p className="text-xs font-medium text-left">Quick questions:</p>
                  {getQuickActions().map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="w-full text-left justify-start h-auto p-2 text-xs"
                      onClick={() => setInputMessage(action)}
                    >
                      <Lightbulb className="h-3 w-3 mr-2 flex-shrink-0" />
                      {action}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {getMessageIcon(message.role)}
                  </div>
                  
                  <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                     <div className={`rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground ml-auto'
                        : 'bg-muted'
                    }`}>
                      {message.role === 'assistant' ? 
                        renderStructuredMessage(message) : 
                        (typeof message.content === 'string' ? (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(message.content, null, 2)}</pre>
                        ))
                      }
                      
                      {/* Show sources for AI responses */}
                      {message.role === 'assistant' && message.metadata?.sources?.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-muted-foreground/20">
                          <p className="text-xs text-muted-foreground mb-2">Knowledge sources:</p>
                          <div className="space-y-1">
                            {message.metadata.sources.map((source: ChatSource, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <FileText className="h-3 w-3" />
                                <span className="flex-1">{source.title}</span>
                                <Badge variant="outline" className="text-xs">
                                  {source.type}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(message.created_at), 'HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="space-y-2">
          <Separator />
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about compliance, documents, or requirements..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage} 
              disabled={!inputMessage.trim() || isLoading}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {lastSources.length > 0 && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Response used {lastSources.length} knowledge source{lastSources.length !== 1 ? 's' : ''}
              {messages[messages.length - 1]?.metadata?.documents_found > 0 && 
                ` and ${messages[messages.length - 1].metadata.documents_found} document${messages[messages.length - 1].metadata.documents_found !== 1 ? 's' : ''}`
              }
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatAgentPanel;