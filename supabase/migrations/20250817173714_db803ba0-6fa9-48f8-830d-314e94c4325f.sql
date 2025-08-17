-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create AI knowledge entries table for RAG functionality
CREATE TABLE public.ai_knowledge_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  company_type TEXT NOT NULL CHECK (company_type IN ('buyer', 'supplier')),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('document_analysis', 'compliance_guide', 'industry_info', 'connection_data', 'agent_insights')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536), -- OpenAI embedding dimension
  source_reference TEXT,
  relevance_tags TEXT[],
  industry_context TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.ai_knowledge_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_knowledge_entries
CREATE POLICY "Users can view knowledge for their company" 
ON public.ai_knowledge_entries 
FOR SELECT 
USING (
  (company_type = 'supplier' AND company_id IN (
    SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid()
  )) OR
  (company_type = 'buyer' AND company_id IN (
    SELECT b.id FROM buyers b WHERE b.profile_id = auth.uid()
  ))
);

CREATE POLICY "System can manage knowledge entries" 
ON public.ai_knowledge_entries 
FOR ALL 
USING (true);

-- Add indexes for performance
CREATE INDEX idx_ai_knowledge_company ON public.ai_knowledge_entries(company_id, company_type);
CREATE INDEX idx_ai_knowledge_type ON public.ai_knowledge_entries(entry_type);
CREATE INDEX idx_ai_knowledge_industry ON public.ai_knowledge_entries(industry_context);
CREATE INDEX idx_ai_knowledge_tags ON public.ai_knowledge_entries USING GIN(relevance_tags);
CREATE INDEX idx_ai_knowledge_embedding ON public.ai_knowledge_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create function to update timestamps
CREATE TRIGGER update_ai_knowledge_entries_updated_at
BEFORE UPDATE ON public.ai_knowledge_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create chat_sessions table to track conversations
CREATE TABLE public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  company_type TEXT NOT NULL CHECK (company_type IN ('buyer', 'supplier')),
  session_title TEXT,
  context_tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for chat_sessions
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their chat sessions" 
ON public.chat_sessions 
FOR ALL 
USING (user_id = auth.uid());

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage messages in their sessions" 
ON public.chat_messages 
FOR ALL 
USING (
  session_id IN (
    SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
  )
);

-- Add indexes
CREATE INDEX idx_chat_sessions_user ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_company ON public.chat_sessions(company_id, company_type);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at);