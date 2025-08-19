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

// Query intent analysis for better results
interface QueryIntent {
  intent_type: 'latest_document' | 'specific_document' | 'document_status' | 'compliance_summary' | 'expired_documents' | 'supplier_specific' | 'general_inquiry';
  entities: {
    supplier_names?: string[];
    document_types?: string[];
    time_references?: string[];
    status_types?: string[];
  };
  limit_documents: number;
  confidence: number;
}

// Analyze query intent using GPT-4o-mini for fast classification
async function analyzeQueryIntent(query: string, companyType: string): Promise<QueryIntent> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a query intent classifier for a compliance document management system. 
          
Analyze the user query and classify it into one of these intent types:
- latest_document: User wants the most recent document(s) from a specific supplier or type
- specific_document: User is looking for a particular document type or certification
- document_status: User wants to know the status of documents (pending, approved, expired)  
- compliance_summary: User wants an overview/summary of compliance status
- expired_documents: User specifically asks about expired or expiring documents
- supplier_specific: User asks about a specific supplier's documents/compliance
- general_inquiry: General questions about compliance, processes, requirements

Extract entities like supplier names, document types (ISO, certification, audit, etc.), time references (latest, recent, last week, expiring), and status types (pending, approved, expired).

Determine appropriate document limit: 1 for "latest", 2-3 for "specific", 5-10 for "summary".

Respond in JSON format:
{
  "intent_type": "latest_document",
  "entities": {
    "supplier_names": ["Company Name"],
    "document_types": ["ISO Certificate"],
    "time_references": ["latest"],
    "status_types": ["approved"]
  },
  "limit_documents": 1,
  "confidence": 0.95
}`
        },
        {
          role: 'user',
          content: `Query: "${query}"\nUser type: ${companyType}`
        }
      ],
      max_completion_tokens: 300,
    }),
  });

  try {
    const data = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content);
    return analysis;
  } catch (error) {
    console.error('Intent analysis failed:', error);
    // Fallback to general inquiry
    return {
      intent_type: 'general_inquiry',
      entities: {},
      limit_documents: 5,
      confidence: 0.3
    };
  }
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

// Enhanced document search using intent analysis
async function searchDocumentsAdvanced(query: string, companyId: string, companyType: string, intent: QueryIntent): Promise<DocumentReference[]> {
  try {
    console.log('Searching documents with intent:', intent);
    
    // Use the existing search_relevant_documents function for better relevance
    const { data: relevantDocs, error: relevantError } = await supabase.rpc('search_relevant_documents', {
      query_text: query,
      user_company_id: companyId,
      user_company_type: companyType,
      match_limit: Math.min(intent.limit_documents * 2, 20) // Get more candidates to filter
    });

    if (relevantError) {
      console.error('Relevant documents search error:', relevantError);
      // Fallback to basic search
      return await basicDocumentSearch(query, companyId, companyType, intent);
    }

    if (!relevantDocs || relevantDocs.length === 0) {
      return [];
    }

    // Filter and sort based on intent
    let filteredDocs = relevantDocs;

    // Apply intent-specific filtering
    if (intent.intent_type === 'latest_document') {
      // Sort by creation date descending, take most recent
      filteredDocs = filteredDocs
        .sort((a, b) => new Date(b.metadata?.created_at || 0).getTime() - new Date(a.metadata?.created_at || 0).getTime())
        .slice(0, intent.limit_documents);
    } else if (intent.intent_type === 'expired_documents') {
      // Filter to only expired or expiring documents
      filteredDocs = filteredDocs.filter(doc => {
        if (!doc.expiration_date) return false;
        const expDate = new Date(doc.expiration_date);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 30; // Expired or expiring within 30 days
      });
    } else if (intent.intent_type === 'document_status') {
      // Filter by status if specified
      if (intent.entities.status_types?.length) {
        const statusFilters = intent.entities.status_types.map(s => s.toLowerCase());
        filteredDocs = filteredDocs.filter(doc => 
          statusFilters.includes(doc.status?.toLowerCase())
        );
      }
    }

    // Apply entity-based filtering
    if (intent.entities.supplier_names?.length) {
      const supplierNames = intent.entities.supplier_names.map(s => s.toLowerCase());
      filteredDocs = filteredDocs.filter(doc => 
        supplierNames.some(name => 
          doc.supplier_name?.toLowerCase().includes(name)
        )
      );
    }

    if (intent.entities.document_types?.length) {
      const docTypes = intent.entities.document_types.map(t => t.toLowerCase());
      filteredDocs = filteredDocs.filter(doc => 
        docTypes.some(type => 
          doc.document_type?.toLowerCase().includes(type) ||
          doc.title?.toLowerCase().includes(type)
        )
      );
    }

    // Sort by relevance score and limit results
    return filteredDocs
      .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
      .slice(0, intent.limit_documents);

  } catch (error) {
    console.error('Error in advanced document search:', error);
    return await basicDocumentSearch(query, companyId, companyType, intent);
  }
}

// Fallback basic document search
async function basicDocumentSearch(query: string, companyId: string, companyType: string, intent: QueryIntent): Promise<DocumentReference[]> {
  console.log('Using fallback basic document search');
  
  let documentsQuery = supabase
    .from('document_uploads')
    .select(`
      id,
      file_name,
      status,
      expiration_date,
      file_path,
      created_at,
      request_id,
      document_requests!inner(
        title,
        document_type,
        buyer_id,
        supplier_id,
        suppliers(company_name)
      )
    `);

  // Apply company filter based on type
  if (companyType === 'buyer') {
    documentsQuery = documentsQuery.eq('document_requests.buyer_id', companyId);
  } else {
    documentsQuery = documentsQuery.eq('document_requests.supplier_id', companyId);
  }

  // Apply intent-specific ordering and filtering
  if (intent.intent_type === 'latest_document') {
    documentsQuery = documentsQuery.order('created_at', { ascending: false });
  } else if (intent.intent_type === 'expired_documents') {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    documentsQuery = documentsQuery.lte('expiration_date', thirtyDaysFromNow.toISOString());
  }

  const { data: documents, error } = await documentsQuery.limit(intent.limit_documents * 2);

  if (error) {
    console.error('Basic document search error:', error);
    return [];
  }

  if (!documents) return [];

  // Map to DocumentReference format
  let mappedDocs = documents.map(doc => ({
    id: doc.id,
    title: doc.file_name,
    supplier_name: doc.document_requests?.suppliers?.company_name,
    document_type: doc.document_requests?.document_type || 'Unknown',
    expiration_date: doc.expiration_date,
    status: doc.status,
    file_path: doc.file_path,
    metadata: {
      request_title: doc.document_requests?.title,
      created_at: doc.created_at
    }
  }));

  // Apply additional intent-based filtering
  if (intent.entities.supplier_names?.length) {
    const supplierNames = intent.entities.supplier_names.map(s => s.toLowerCase());
    mappedDocs = mappedDocs.filter(doc => 
      supplierNames.some(name => 
        doc.supplier_name?.toLowerCase().includes(name)
      )
    );
  }

  return mappedDocs.slice(0, intent.limit_documents);
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

// Generate structured AI response with RAG context and intent awareness
async function generateStructuredResponse(
  userMessage: string, 
  knowledgeEntries: KnowledgeEntry[], 
  documents: DocumentReference[],
  userInfo: any,
  conversationHistory: any[],
  intent: QueryIntent
): Promise<StructuredResponse> {
  
  const contextBlocks = knowledgeEntries.map(entry => 
    `[${entry.entry_type}] ${entry.title}\n${entry.content}`
  ).join('\n\n---\n\n');

  const documentContext = documents.length > 0 ? 
    `\n\nRELEVANT DOCUMENTS:\n${documents.map(doc => 
      `- ${doc.title} (${doc.document_type}) from ${doc.supplier_name || 'Unknown'} - Status: ${doc.status}${doc.expiration_date ? `, Expires: ${doc.expiration_date}` : ''}`
    ).join('\n')}` : '';

  // Create intent-aware system prompt
  const intentContext = `
QUERY INTENT ANALYSIS:
- Intent Type: ${intent.intent_type}
- Confidence: ${intent.confidence}
- Document Limit: ${intent.limit_documents}
- Entities Found: ${JSON.stringify(intent.entities)}
  `;

  const responseTemplates = {
    latest_document: "Focus on the most recent document(s). Highlight recency and current status.",
    specific_document: "Provide detailed information about the requested document type. Include requirements and compliance notes.", 
    document_status: "Summarize document statuses clearly. Group by status type and highlight any issues.",
    compliance_summary: "Provide a comprehensive compliance overview. Include metrics, trends, and recommendations.",
    expired_documents: "Focus on expiration dates and urgent actions needed. Prioritize by risk level.",
    supplier_specific: "Provide supplier-focused analysis. Include performance metrics and relationship insights.",
    general_inquiry: "Provide helpful general information with relevant examples and actionable advice."
  };

  const systemPrompt = `You are an expert AI compliance assistant for ${userInfo.companyType}s in the ${userInfo.industry || 'general'} industry.

${intentContext}

RESPONSE STRATEGY: ${responseTemplates[intent.intent_type]}

Your capabilities include:
- Document compliance and regulatory requirements
- Industry-specific standards and certifications  
- Document expiration tracking and risk analysis
- Supplier performance and document management
- Compliance best practices and recommendations

CRITICAL: Always respond with structured JSON in this exact format:
{
  "type": "structured",
  "content": "Main response text here - keep concise and directly address the user's intent",
  "sections": [
    {
      "title": "Section Title",
      "content": "Section content here",
      "type": "text|list|document_card"
    }
  ],
  "documents": [Only include if documents are found and relevant],
  "quick_actions": ["Contextual follow-up question 1", "Related query 2"]
}

KNOWLEDGE BASE:
${contextBlocks}

RELEVANT DOCUMENTS:
${documentContext}

RESPONSE GUIDELINES:
- Be precise and directly address the query intent (${intent.intent_type})
- If showing documents, limit to ${intent.limit_documents} most relevant ones
- Provide actionable insights, not just information
- Include specific dates, statuses, and risk levels when available
- Generate contextually relevant quick actions
- Use professional but conversational tone
- Highlight urgent issues (expirations, compliance gaps, pending actions)

Current context: ${userInfo.companyType} in ${userInfo.industry || 'general'} industry with ${documents.length} relevant documents found.`;

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

// Save or update chat session with intelligent title
async function saveSession(userId: string, companyId: string, companyType: string, userMessage: string, sessionId?: string, contextTags?: string[]): Promise<string> {
  if (sessionId) {
    return sessionId;
  }

  // Generate session title from first message
  const generateTitle = (message: string): string => {
    const words = message.trim().split(' ').slice(0, 6);
    return words.join(' ').substring(0, 50);
  };

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      company_id: companyId,
      company_type: companyType,
      session_title: generateTitle(userMessage),
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

    // Step 1: Analyze query intent for smarter responses
    const queryIntent = await analyzeQueryIntent(message, userInfo.companyType);
    console.log('Query intent analysis:', queryIntent);

    // Step 2: Create embedding for semantic search
    const embedding = await createEmbedding(message);

    // Step 3: Search relevant knowledge and documents with intent-aware filtering
    const [knowledgeEntries, documents] = await Promise.all([
      searchKnowledge(embedding, userInfo.companyId, userInfo.companyType, queryIntent.limit_documents > 5 ? 8 : 3),
      searchDocumentsAdvanced(message, userInfo.companyId, userInfo.companyType, queryIntent)
    ]);

    console.log(`Found ${knowledgeEntries.length} knowledge entries and ${documents.length} documents for intent: ${queryIntent.intent_type}`);

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

    // Step 4: Generate intent-aware structured AI response
    const structuredResponse = await generateStructuredResponse(
      message, 
      knowledgeEntries,
      documents,
      userInfo, 
      conversationHistory,
      queryIntent
    );

    // Save or create session
    const finalSessionId = await saveSession(
      user.id, 
      userInfo.companyId, 
      userInfo.companyType, 
      message,
      session_id, 
      context_tags
    );

    // Step 5: Save conversation with enhanced metadata
    await saveMessage(finalSessionId, 'user', message);
    await saveMessage(finalSessionId, 'assistant', JSON.stringify(structuredResponse), {
      knowledge_entries_used: knowledgeEntries.length,
      documents_found: documents.length,
      response_type: structuredResponse.type,
      query_intent: queryIntent,
      context_tags
    });

    // Step 6: Log enhanced agent activity with intent analysis
    await supabase
      .from('agent_activities')
      .insert({
        agent_type: 'chat',
        action_type: 'intelligent_chat_response',
        entity_type: userInfo.companyType,
        entity_id: userInfo.companyId,
        success: true,
        confidence_score: Math.max(queryIntent.confidence, knowledgeEntries.length > 0 ? 0.9 : 0.5),
        details: {
          message_length: message.length,
          response_type: structuredResponse.type,
          query_intent: queryIntent.intent_type,
          intent_confidence: queryIntent.confidence,
          knowledge_entries_found: knowledgeEntries.length,
          documents_found: documents.length,
          document_limit_applied: queryIntent.limit_documents,
          sections_count: structuredResponse.sections?.length || 0,
          entities_extracted: queryIntent.entities
        },
        reasoning: `Generated ${queryIntent.intent_type} response with ${queryIntent.confidence} confidence using ${knowledgeEntries.length} knowledge entries and ${documents.length} filtered documents`
      });

    return new Response(JSON.stringify({
      response: JSON.stringify(structuredResponse),
      session_id: finalSessionId,
      metadata: {
        knowledge_entries_used: knowledgeEntries.length,
        documents_found: documents.length,
        sources: knowledgeEntries.map(entry => ({
          title: entry.title,
          type: entry.entry_type,
          similarity: entry.similarity
        }))
      }
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