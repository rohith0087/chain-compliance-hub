import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface ChatRequest {
  message: string;
  session_id?: string;
  context_tags?: string[];
}

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  entry_type: string;
  metadata: any;
  source_reference?: string;
  similarity: number;
}

// Create embeddings for user query
async function createEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
}

// Search relevant knowledge entries using vector similarity
async function searchKnowledge(
  embedding: number[], 
  companyId: string, 
  companyType: string, 
  limit: number = 5
): Promise<KnowledgeEntry[]> {
  
  const { data, error } = await supabase.rpc('search_knowledge_entries', {
    query_embedding: JSON.stringify(embedding),
    company_id_param: companyId,
    company_type_param: companyType,
    similarity_threshold: 0.7,
    match_count: limit
  });

  if (error) {
    console.error('Knowledge search error:', error);
    return [];
  }

  return data || [];
}

// Get user company information
async function getUserCompany(userId: string): Promise<{companyId: string, companyType: string, industry?: string} | null> {
  // Check if user is a buyer
  const { data: buyerData } = await supabase
    .from('buyers')
    .select('id, industry')
    .eq('profile_id', userId)
    .single();

  if (buyerData) {
    return { companyId: buyerData.id, companyType: 'buyer', industry: buyerData.industry };
  }

  // Check if user is a supplier
  const { data: supplierData } = await supabase
    .from('suppliers')
    .select('id, industry')
    .eq('profile_id', userId)
    .single();

  if (supplierData) {
    return { companyId: supplierData.id, companyType: 'supplier', industry: supplierData.industry };
  }

  return null;
}

// Generate AI response with RAG context
async function generateResponse(
  userMessage: string, 
  knowledgeEntries: KnowledgeEntry[], 
  userInfo: any,
  conversationHistory: any[]
): Promise<string> {
  
  const contextBlocks = knowledgeEntries.map(entry => 
    `[${entry.entry_type}] ${entry.title}\n${entry.content}`
  ).join('\n\n---\n\n');

  const systemPrompt = `You are a helpful AI compliance assistant for ${userInfo.companyType}s in the ${userInfo.industry || 'general'} industry. 

Your role is to help with:
- Document compliance and requirements
- Industry-specific regulations and standards
- Supplier-buyer relationship management
- Compliance best practices
- Document analysis insights

Use the following knowledge base to provide accurate, contextual answers:

KNOWLEDGE BASE:
${contextBlocks}

Guidelines:
- Always ground your responses in the provided knowledge base
- If information isn't in the knowledge base, clearly state this
- Provide practical, actionable advice
- Reference specific documents or analyses when relevant
- Be concise but thorough
- For compliance matters, emphasize the importance of professional legal/regulatory review

Current user context: ${userInfo.companyType} in ${userInfo.industry || 'general'} industry.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // Last 10 messages for context
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

// Save or update chat session
async function saveSession(userId: string, companyId: string, companyType: string, sessionId?: string, contextTags?: string[]): Promise<string> {
  if (sessionId) {
    return sessionId;
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      company_id: companyId,
      company_type: companyType,
      session_title: 'Compliance Chat',
      context_tags: contextTags || []
    })
    .select('id')
    .single();

  if (error) {
    console.error('Session creation error:', error);
    throw new Error('Failed to create chat session');
  }

  return data.id;
}

// Save chat message
async function saveMessage(sessionId: string, role: string, content: string, metadata?: any): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      role,
      content,
      metadata: metadata || {}
    });

  if (error) {
    console.error('Message save error:', error);
  }
}

// Create vector search function if it doesn't exist
async function ensureSearchFunction(): Promise<void> {
  const searchFunctionSQL = `
  CREATE OR REPLACE FUNCTION search_knowledge_entries(
    query_embedding text,
    company_id_param uuid,
    company_type_param text,
    similarity_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
  )
  RETURNS TABLE (
    id uuid,
    title text,
    content text,
    entry_type text,
    metadata jsonb,
    source_reference text,
    similarity float
  )
  LANGUAGE sql
  STABLE
  AS $$
    SELECT 
      ke.id,
      ke.title,
      ke.content,
      ke.entry_type,
      ke.metadata,
      ke.source_reference,
      1 - (ke.embedding <=> query_embedding::vector) as similarity
    FROM ai_knowledge_entries ke
    WHERE ke.company_id = company_id_param 
      AND ke.company_type = company_type_param
      AND (ke.expires_at IS NULL OR ke.expires_at > now())
      AND 1 - (ke.embedding <=> query_embedding::vector) > similarity_threshold
    ORDER BY ke.embedding <=> query_embedding::vector
    LIMIT match_count;
  $$;`;

  const { error } = await supabase.rpc('exec_sql', { query: searchFunctionSQL });
  if (error && !error.message.includes('already exists')) {
    console.error('Failed to create search function:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Ensure vector search function exists
    await ensureSearchFunction();

    const { message, session_id, context_tags }: ChatRequest = await req.json();

    // Get user from auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Get user company info
    const userInfo = await getUserCompany(user.id);
    if (!userInfo) {
      throw new Error('User company information not found');
    }

    // Create embedding for user message
    const embedding = await createEmbedding(message);

    // Search relevant knowledge
    const knowledgeEntries = await searchKnowledge(
      embedding, 
      userInfo.companyId, 
      userInfo.companyType
    );

    // Get conversation history if session exists
    let conversationHistory: any[] = [];
    if (session_id) {
      const { data: historyData } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true })
        .limit(20);
      
      conversationHistory = historyData || [];
    }

    // Generate AI response
    const aiResponse = await generateResponse(
      message, 
      knowledgeEntries, 
      userInfo, 
      conversationHistory
    );

    // Save or create session
    const finalSessionId = await saveSession(
      user.id, 
      userInfo.companyId, 
      userInfo.companyType, 
      session_id, 
      context_tags
    );

    // Save messages
    await saveMessage(finalSessionId, 'user', message);
    await saveMessage(finalSessionId, 'assistant', aiResponse, {
      knowledge_entries_used: knowledgeEntries.length,
      context_tags
    });

    // Log agent activity
    await supabase
      .from('agent_activities')
      .insert({
        agent_type: 'chat',
        action_type: 'chat_response',
        entity_type: userInfo.companyType,
        entity_id: userInfo.companyId,
        success: true,
        confidence_score: knowledgeEntries.length > 0 ? 0.9 : 0.5,
        details: {
          message_length: message.length,
          response_length: aiResponse.length,
          knowledge_entries_found: knowledgeEntries.length
        },
        reasoning: `Generated response using ${knowledgeEntries.length} knowledge entries`
      });

    return new Response(JSON.stringify({
      response: aiResponse,
      session_id: finalSessionId,
      knowledge_entries_used: knowledgeEntries.length,
      sources: knowledgeEntries.map(entry => ({
        title: entry.title,
        type: entry.entry_type,
        similarity: entry.similarity
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('RAG chat error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});