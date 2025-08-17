import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  MessageSquare, 
  Send, 
  Bot, 
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
  Menu
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
  type: 'structured' | 'simple';
  content: string;
  sections?: {
    title: string;
    content: string;
    type: 'text' | 'list' | 'document_card';
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

const ChatPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [companyInfo, setCompanyInfo] = useState<{id: string, type: string} | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
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

  const getCompanyInfo = async () => {
    if (!user) return;

    try {
      // Check if user is a buyer
      const { data: buyerData } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (buyerData) {
        setCompanyInfo({ id: buyerData.id, type: 'buyer' });
        return;
      }

      // Check if user is a supplier
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (supplierData) {
        setCompanyInfo({ id: supplierData.id, type: 'supplier' });
      }
    } catch (error) {
      console.error('Error getting company info:', error);
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
        content: data.response,
        metadata: data.metadata,
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

  const renderStructuredMessage = (content: string) => {
    try {
      const parsed: StructuredResponse = JSON.parse(content);
      
      if (parsed.type === 'simple') {
        return <p className="text-muted-foreground leading-relaxed">{parsed.content}</p>;
      }

      return (
        <div className="space-y-6">
          {parsed.content && (
            <p className="text-muted-foreground leading-relaxed">{parsed.content}</p>
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
              <h4 className="font-semibold text-foreground">Related Documents</h4>
              <div className="grid gap-3">
                {parsed.documents.map((doc, index) => (
                  <Card key={index} className="p-4 border-l-4 border-l-primary/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="font-medium text-foreground">{doc.title}</span>
                        </div>
                        
                        {doc.supplier_name && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <span>Supplier: {doc.supplier_name}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm">
                          <Badge variant="outline">{doc.document_type}</Badge>
                          
                          {doc.expiration_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>Expires: {format(new Date(doc.expiration_date), 'MMM dd, yyyy')}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            {doc.status === 'approved' && <CheckCircle className="w-3 h-3 text-green-500" />}
                            {doc.status === 'pending_review' && <Clock className="w-3 h-3 text-yellow-500" />}
                            {doc.status === 'rejected' && <XCircle className="w-3 h-3 text-red-500" />}
                            {doc.status === 'expired' && <AlertCircle className="w-3 h-3 text-red-500" />}
                            <span className="capitalize">{doc.status.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>
                      
                      {doc.file_path && (
                        <Button size="sm" variant="outline">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
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
                    onClick={() => setInputMessage(action)}
                    className="text-xs"
                  >
                    {action}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    } catch {
      return <p className="text-muted-foreground leading-relaxed">{content}</p>;
    }
  };

  const quickStarters = [
    "Show me documents from Terry Foods",
    "When does our ISO 9001 certification expire?",
    "Which documents are pending review?",
    "Find all expired compliance documents",
    "Show me recent document uploads",
    "What documents need attention today?"
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* History Sidebar for Desktop */}
      <div className="hidden lg:flex w-80 border-r border-border bg-card flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Chat History</h2>
            <Button size="sm" variant="outline" onClick={startNewChat}>
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
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
        </ScrollArea>
      </div>

      {/* Mobile History Sheet */}
      <Sheet open={showHistory} onOpenChange={setShowHistory}>
        <SheetContent side="left" className="w-80 p-0">
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border">
              <h2 className="font-semibold text-foreground">Chat History</h2>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
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
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="border-b border-border bg-card/50 backdrop-blur">
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
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <h1 className="font-semibold text-foreground">AI Assistant</h1>
              </div>
            </div>
            
            <Button variant="outline" size="sm" onClick={startNewChat}>
              <Plus className="w-4 h-4 mr-1" />
              New Chat
            </Button>
          </div>
        </div>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto text-center space-y-8 py-12">
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Welcome to your AI Compliance Assistant
                </h2>
                <p className="text-muted-foreground text-lg">
                  Ask me about your documents, compliance status, or any questions about your business needs.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Try asking:</h3>
                <div className="grid gap-2">
                  {quickStarters.map((starter, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="text-left justify-start h-auto p-4"
                      onClick={() => setInputMessage(starter)}
                    >
                      <Sparkles className="w-4 h-4 mr-2 text-primary" />
                      {starter}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-4 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  
                  <div className={`flex-1 space-y-2 ${message.role === 'user' ? 'max-w-lg' : 'max-w-full'}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground ml-auto'
                          : 'bg-card border border-border'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <p>{message.content}</p>
                      ) : (
                        renderStructuredMessage(message.content)
                      )}
                    </div>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-border bg-card/50 backdrop-blur p-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about documents, compliance, or anything else..."
                  className="pr-12 min-h-[44px] rounded-full"
                  disabled={isLoading}
                />
                <Button
                  size="sm"
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="absolute right-1 top-1 bottom-1 rounded-full w-10 h-auto p-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground text-center mt-3">
              AI assistant can make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;