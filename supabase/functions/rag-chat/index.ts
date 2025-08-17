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

// Search for specific documents mentioned in the query
async function searchDocuments(query: string, companyId: string, companyType: string): Promise<DocumentReference[]> {
  try {
    // Extract potential supplier names and document types from query
    const supplierKeywords = ['terry foods', 'supplier', 'company'];
    const docTypeKeywords = ['iso', 'certificate', 'certification', 'compliance', 'audit'];
    
    let documentsQuery = supabase
      .from('document_uploads')
      .select(`
        id,
        file_name,
        status,
        expiration_date,
        file_path,
        request_id,
        document_requests!inner(
          title,
          document_type,
          supplier_id,
          suppliers(company_name)
        )
      `);

    // If user is a buyer, get documents from their suppliers
    if (companyType === 'buyer') {
      documentsQuery = documentsQuery.eq('document_requests.buyer_id', companyId);
    } else {
      documentsQuery = documentsQuery.eq('document_requests.supplier_id', companyId);
    }

    const { data: documents, error } = await documentsQuery.limit(10);

    if (error) {
      console.error('Document search error:', error);
      return [];
    }

    return (documents || []).map(doc => ({
      id: doc.id,
      title: doc.file_name,
      supplier_name: doc.document_requests?.suppliers?.company_name,
      document_type: doc.document_requests?.document_type || 'Unknown',
      expiration_date: doc.expiration_date,
      status: doc.status,
      file_path: doc.file_path,
      metadata: {
        request_title: doc.document_requests?.title
      }
    }));
  } catch (error) {
    console.error('Error searching documents:', error);
    return [];
  }
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

// Generate structured AI response with RAG context
async function generateStructuredResponse(
  userMessage: string, 
  knowledgeEntries: KnowledgeEntry[], 
  documents: DocumentReference[],
  userInfo: any,
  conversationHistory: any[]
): Promise<StructuredResponse> {
  
  const contextBlocks = knowledgeEntries.map(entry => 
    `[${entry.entry_type}] ${entry.title}\n${entry.content}`
  ).join('\n\n---\n\n');

  const documentContext = documents.length > 0 ? 
    `\n\nRELEVANT DOCUMENTS:\n${documents.map(doc => 
      `- ${doc.title} (${doc.document_type}) from ${doc.supplier_name || 'Unknown'} - Status: ${doc.status}${doc.expiration_date ? `, Expires: ${doc.expiration_date}` : ''}`
    ).join('\n')}` : '';

  const systemPrompt = `You are a helpful AI compliance assistant for ${userInfo.companyType}s in the ${userInfo.industry || 'general'} industry. 

Your role is to help with:
- Document compliance and requirements  
- Industry-specific regulations and standards
- Document expiration tracking and analysis
- Supplier document management
- Compliance best practices

IMPORTANT: Always respond with structured JSON in this exact format:
{
  "type": "structured",
  "content": "Main response text here",
  "sections": [
    {
      "title": "Section Title",
      "content": "Section content here",
      "type": "text|list|document_card"
    }
  ],
  "documents": [
    {
      "id": "doc_id",
      "title": "Document Title", 
      "supplier_name": "Supplier Name",
      "document_type": "Document Type",
      "expiration_date": "YYYY-MM-DD or null",
      "status": "approved|pending|expired"
    }
  ],
  "quick_actions": ["Follow-up question 1", "Follow-up question 2"]
}

Use the following knowledge base:
${contextBlocks}${documentContext}

Guidelines:
- Structure your response with clear sections
- Include document references when available
- Provide expiration dates and status information
- Add relevant quick action buttons
- Be concise but thorough
- Reference specific documents when mentioned

Current user context: ${userInfo.companyType} in ${userInfo.industry || 'general'} industry.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-8), // Last 8 messages for context
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
      max_tokens: 1200,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  const rawResponse = data.choices[0].message.content;
  
  try {
    // Try to parse structured response
    const structuredResponse = JSON.parse(rawResponse);
    
    // Enhance with actual document data
    if (documents.length > 0) {
      structuredResponse.documents = documents;
    }
    
    return structuredResponse;
  } catch (parseError) {
    console.error('Failed to parse structured response, falling back to simple:', parseError);
    
    // Fallback to simple response
    return {
      type: 'simple',
      content: rawResponse,
      documents: documents.length > 0 ? documents : undefined,
      quick_actions: userInfo.companyType === 'buyer' ? 
        ["Show me compliance status", "What documents are missing?"] :
        ["Check my document status", "What's required next?"]
    };
  }
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

    // Search relevant knowledge and documents in parallel
    const [knowledgeEntries, documents] = await Promise.all([
      searchKnowledge(embedding, userInfo.companyId, userInfo.companyType),
      searchDocuments(message, userInfo.companyId, userInfo.companyType)
    ]);

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

    // Generate structured AI response
    const structuredResponse = await generateStructuredResponse(
      message, 
      knowledgeEntries,
      documents,
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
    await saveMessage(finalSessionId, 'assistant', JSON.stringify(structuredResponse), {
      knowledge_entries_used: knowledgeEntries.length,
      documents_found: documents.length,
      response_type: structuredResponse.type,
      context_tags
    });

    // Log agent activity
    await supabase
      .from('agent_activities')
      .insert({
        agent_type: 'chat',
        action_type: 'structured_chat_response',
        entity_type: userInfo.companyType,
        entity_id: userInfo.companyId,
        success: true,
        confidence_score: knowledgeEntries.length > 0 ? 0.9 : 0.5,
        details: {
          message_length: message.length,
          response_type: structuredResponse.type,
          knowledge_entries_found: knowledgeEntries.length,
          documents_found: documents.length,
          sections_count: structuredResponse.sections?.length || 0
        },
        reasoning: `Generated structured response using ${knowledgeEntries.length} knowledge entries and ${documents.length} documents`
      });

    return new Response(JSON.stringify({
      response: structuredResponse,
      session_id: finalSessionId,
      knowledge_entries_used: knowledgeEntries.length,
      documents_found: documents.length,
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