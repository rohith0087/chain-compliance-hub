import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// OpenAI tools that the LLM can use
const tools = [
  {
    type: "function",
    function: {
      name: "query_documents",
      description: "Query and filter documents with flexible criteria. Use this to find documents based on status, expiration, supplier names, or document types.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "array",
            items: { type: "string", enum: ["pending_review", "approved", "rejected", "expired"] },
            description: "Filter by document status"
          },
          document_types: {
            type: "array",
            items: { type: "string" },
            description: "Filter by document types (e.g., 'Certificate of Insurance', 'Safety Data Sheet')"
          },
          supplier_names: {
            type: "array",
            items: { type: "string" },
            description: "Filter by supplier company names"
          },
          expired: {
            type: "boolean",
            description: "If true, only show expired documents. If false, show non-expired documents."
          },
          expiring_days: {
            type: "number",
            description: "Show documents expiring within this many days from now"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 20, max: 100)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_suppliers",
      description: "Query suppliers and their connection status. Use this to find suppliers by name or connection status.",
      parameters: {
        type: "object",
        properties: {
          supplier_names: {
            type: "array",
            items: { type: "string" },
            description: "Search for suppliers by name (partial match supported)"
          },
          connection_status: {
            type: "string",
            enum: ["pending", "approved", "rejected"],
            description: "Filter suppliers by connection status"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_compliance_metrics",
      description: "Get overall compliance statistics and metrics for the buyer. Use this for questions about compliance scores, totals, or overall statistics.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_document_request",
      description: "Create document requests for suppliers. Can create single or multiple requests at once. Use this when the user wants to request documents from a supplier.",
      parameters: {
        type: "object",
        properties: {
          supplier_name: {
            type: "string",
            description: "Name of the supplier to request documents from"
          },
          document_types: {
            type: "array",
            items: { type: "string" },
            description: "List of document types to request (e.g., ['ISO 9001', 'HACCP Certificate'])"
          },
          due_date: {
            type: "string",
            description: "Due date in YYYY-MM-DD format. If not specified, system will set reasonable default (14 days from now)"
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "Priority level for the request"
          },
          notes: {
            type: "string",
            description: "Additional notes or instructions for the supplier"
          }
        },
        required: ["supplier_name", "document_types"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_document_sets",
      description: "Get saved document sets for the buyer. Use this to suggest document sets when the user wants to request multiple documents.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];

// Fuzzy matching helper functions
function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function fuzzyMatch(supplier: string, query: string): boolean {
  const normSupplier = normalize(supplier);
  const normQuery = normalize(query);
  
  // Exact substring match
  if (normSupplier.includes(normQuery) || normQuery.includes(normSupplier)) {
    return true;
  }
  
  // Levenshtein distance <= 2 for typos
  if (levenshteinDistance(normSupplier, normQuery) <= 2) {
    return true;
  }
  
  // Token-level matching (any word in supplier matches any word in query)
  const supplierTokens = normSupplier.split(' ');
  const queryTokens = normQuery.split(' ');
  for (const qt of queryTokens) {
    for (const st of supplierTokens) {
      if (st.includes(qt) || qt.includes(st) || levenshteinDistance(st, qt) <= 1) {
        return true;
      }
    }
  }
  
  return false;
}

async function queryDocuments(filters: any, buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    let query = supabase
      .from('document_uploads')
      .select(`
        id,
        expiration_date,
        status,
        file_path,
        created_at,
        document_requests!inner(
          id,
          title,
          document_type,
          category,
          buyer_id,
          status,
          suppliers(
            id,
            company_name,
            industry
          )
        )
      `)
      .eq('document_requests.buyer_id', buyerId);

    // Apply dynamic filters
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    
    if (filters.document_types && filters.document_types.length > 0) {
      query = query.in('document_requests.document_type', filters.document_types);
    }
    
    // Handle expiration date filtering
    const today = new Date().toISOString();
    
    if (filters.expired === true) {
      // Only documents that are ALREADY expired (before today)
      query = query.lt('expiration_date', today);
    } else if (filters.expired === false) {
      query = query.gte('expiration_date', today);
    }
    
    if (filters.expiring_days) {
      // Documents expiring BETWEEN today and future date (not already expired)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + filters.expiring_days);
      query = query
        .gte('expiration_date', today)  // Must be today or later
        .lte('expiration_date', futureDate.toISOString());  // But before future cutoff
    }
    
    const limit = Math.min(filters.limit || 20, 100);
    query = query.limit(limit).order('created_at', { ascending: false });

    const { data, error } = await query;
    
    console.log('Query filters applied:', {
      status: filters.status,
      expired: filters.expired,
      expiring_days: filters.expiring_days,
      supplier_names: filters.supplier_names,
      today: new Date().toISOString(),
      result_count: data?.length || 0
    });
    
    if (error) throw error;

    // If supplier_names filter is provided, filter in-memory with fuzzy matching
    let results = data || [];
    if (filters.supplier_names && filters.supplier_names.length > 0) {
      results = results.filter((doc: any) => {
        const supplierName = doc.document_requests?.suppliers?.company_name || '';
        return filters.supplier_names.some((queryName: string) => 
          fuzzyMatch(supplierName, queryName)
        );
      });
      
      console.log('Supplier filter applied:', {
        requested: filters.supplier_names,
        filtered_count: results.length,
        sample_matches: results.slice(0, 3).map((r: any) => r.document_requests?.suppliers?.company_name)
      });
    }

    return {
      success: true,
      count: results.length,
      documents: results.map((doc: any) => ({
        id: doc.id,
        title: doc.document_requests?.title,
        document_type: doc.document_requests?.document_type,
        category: doc.document_requests?.category,
        supplier_name: doc.document_requests?.suppliers?.company_name,
        supplier_industry: doc.document_requests?.suppliers?.industry,
        status: doc.status,
        request_status: doc.document_requests?.status,
        expiration_date: doc.expiration_date,
        created_at: doc.created_at,
        file_path: doc.file_path
      }))
    };
  } catch (error) {
    console.error('Error querying documents:', error);
    return {
      success: false,
      error: error.message,
      count: 0,
      documents: []
    };
  }
}

async function querySuppliers(filters: any, buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    let query = supabase
      .from('buyer_supplier_connections')
      .select(`
        id,
        status,
        notes,
        requested_at,
        responded_at,
        suppliers(
          id,
          company_name,
          contact_email,
          industry,
          phone,
          address
        )
      `)
      .eq('buyer_id', buyerId);

    if (filters.connection_status) {
      query = query.eq('status', filters.connection_status);
    }

    const { data, error } = await query;
    
    if (error) throw error;

    let results = data || [];
    
    // Filter by supplier names if provided
    if (filters.supplier_names && filters.supplier_names.length > 0) {
      results = results.filter((conn: any) => {
        const supplierName = conn.suppliers?.company_name?.toLowerCase() || '';
        return filters.supplier_names.some((name: string) => 
          supplierName.includes(name.toLowerCase())
        );
      });
    }

    return {
      success: true,
      count: results.length,
      suppliers: results.map((conn: any) => ({
        connection_id: conn.id,
        connection_status: conn.status,
        supplier_id: conn.suppliers?.id,
        supplier_name: conn.suppliers?.company_name,
        contact_email: conn.suppliers?.contact_email,
        industry: conn.suppliers?.industry,
        phone: conn.suppliers?.phone,
        address: conn.suppliers?.address,
        requested_at: conn.requested_at,
        responded_at: conn.responded_at,
        notes: conn.notes
      }))
    };
  } catch (error) {
    console.error('Error querying suppliers:', error);
    return {
      success: false,
      error: error.message,
      count: 0,
      suppliers: []
    };
  }
}

async function getComplianceMetrics(buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // Get document counts by status
    const { data: documents, error: docsError } = await supabase
      .from('document_uploads')
      .select(`
        status,
        expiration_date,
        document_requests!inner(buyer_id)
      `)
      .eq('document_requests.buyer_id', buyerId);

    if (docsError) throw docsError;

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const metrics = {
      total_documents: documents?.length || 0,
      approved: documents?.filter((d: any) => d.status === 'approved').length || 0,
      pending: documents?.filter((d: any) => d.status === 'pending_review').length || 0,
      rejected: documents?.filter((d: any) => d.status === 'rejected').length || 0,
      expired: documents?.filter((d: any) => 
        d.expiration_date && new Date(d.expiration_date) < now
      ).length || 0,
      expiring_soon: documents?.filter((d: any) => 
        d.expiration_date && 
        new Date(d.expiration_date) > now &&
        new Date(d.expiration_date) <= thirtyDaysFromNow
      ).length || 0
    };

    // Calculate compliance score (approved / total * 100)
    const complianceScore = metrics.total_documents > 0 
      ? Math.round((metrics.approved / metrics.total_documents) * 100)
      : 0;

    // Get supplier count
    const { count: supplierCount } = await supabase
      .from('buyer_supplier_connections')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', buyerId)
      .eq('status', 'approved');

    return {
      success: true,
      metrics: {
        ...metrics,
        compliance_score: complianceScore,
        total_suppliers: supplierCount || 0
      }
    };
  } catch (error) {
    console.error('Error getting compliance metrics:', error);
    return {
      success: false,
      error: error.message,
      metrics: null
    };
  }
}

// Helper to parse pending request from confirmation message
function parsePendingRequest(message: string): any | null {
  try {
    // Look for confirmation pattern in message
    const supplierMatch = message.match(/(?:from|for)\s+([^,\.]+?)(?:\s*[,\.]|\s+with)/i);
    const docsMatch = message.match(/Requesting\s+(.+?)\s+(?:from|for)/i);
    const dueDateMatch = message.match(/due date of ([^,\.]+)/i);
    const priorityMatch = message.match(/(low|medium|high|urgent) priority/i);
    
    if (supplierMatch && docsMatch) {
      const docTypes = docsMatch[1]
        .split(/\s+and\s+|\s*,\s*/i)
        .map((d: string) => d.trim())
        .filter(Boolean);
      
      return {
        type: "create_document_request",
        params: {
          supplier_name: supplierMatch[1].trim(),
          document_types: docTypes,
          due_date: dueDateMatch?.[1]?.trim(),
          priority: priorityMatch?.[1]?.toLowerCase() || 'medium'
        }
      };
    }
  } catch (e) {
    console.log('Could not parse pending request:', e);
  }
  return null;
}

async function createDocumentRequest(filters: any, buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // 1. Find supplier by fuzzy matching
    const { data: connections } = await supabase
      .from('buyer_supplier_connections')
      .select('supplier_id, suppliers(id, company_name)')
      .eq('buyer_id', buyerId)
      .eq('status', 'approved');

    const matchedSupplier = connections?.find((conn: any) => 
      fuzzyMatch(
        conn.suppliers.company_name, 
        filters.supplier_name
      )
    );

    if (!matchedSupplier) {
      return {
        success: false,
        error: `No approved supplier found matching "${filters.supplier_name}". Please check the supplier name or connection status.`
      };
    }

    // 2. Get buyer profile data
    const { data: buyer } = await supabase
      .from('buyers')
      .select('id, profile_id')
      .eq('id', buyerId)
      .single();

    if (!buyer) {
      return {
        success: false,
        error: 'Buyer profile not found'
      };
    }

    // 3. Set reasonable defaults
    const dueDate = filters.due_date || 
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 14 days
    
    const priority = filters.priority || 'medium';
    
    const notes = filters.notes || 
      `This document request was created via Compliance Compass. Please upload the requested documents at your earliest convenience.`;

    // 4. Create requests for each document type
    const createdRequests = [];
    const errors = [];

    for (const docType of filters.document_types) {
      try {
        const { data: request, error } = await supabase
          .from('document_requests')
          .insert({
            title: docType,
            description: `Request for ${docType} from ${matchedSupplier.suppliers.company_name}`,
            document_type: docType,
            category: 'Compliance',
            priority: priority,
            due_date: dueDate,
            supplier_id: matchedSupplier.supplier_id,
            buyer_id: buyerId,
            requester_id: buyer.profile_id,
            notes: notes,
            status: 'pending'
          })
          .select()
          .single();

        if (error) {
          errors.push(`${docType}: ${error.message}`);
        } else {
          createdRequests.push(request);
          
          // Send notification
          try {
            await supabase.functions.invoke('send-document-request-notification', {
              body: { requestId: request.id }
            });
          } catch (notifError) {
            console.error('Notification error:', notifError);
          }
        }
      } catch (err: any) {
        errors.push(`${docType}: ${err.message}`);
      }
    }

    console.log('Document requests created:', {
      supplier: matchedSupplier.suppliers.company_name,
      successful: createdRequests.length,
      failed: errors.length,
      due_date: dueDate,
      priority
    });

    return {
      success: true,
      created_count: createdRequests.length,
      failed_count: errors.length,
      supplier_name: matchedSupplier.suppliers.company_name,
      document_types: filters.document_types,
      due_date: dueDate,
      priority: priority,
      request_ids: createdRequests.map((r: any) => r.id),
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error: any) {
    console.error('Error creating document requests:', error);
    return {
      success: false,
      error: error.message,
      created_count: 0,
      failed_count: filters.document_types?.length || 0
    };
  }
}

async function getDocumentSets(buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const { data, error } = await supabase
      .from('document_sets')
      .select('id, set_name, description, document_ids, usage_count, is_default')
      .eq('buyer_id', buyerId)
      .order('is_default', { ascending: false })
      .order('usage_count', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      count: data?.length || 0,
      document_sets: data?.map((set: any) => ({
        id: set.id,
        name: set.set_name,
        description: set.description,
        document_count: Array.isArray(set.document_ids) ? set.document_ids.length : 0,
        documents: set.document_ids,
        usage_count: set.usage_count,
        is_default: set.is_default
      })) || []
    };
  } catch (error: any) {
    console.error('Error getting document sets:', error);
    return {
      success: false,
      error: error.message,
      count: 0,
      document_sets: []
    };
  }
}

async function executeToolCall(toolName: string, args: any, buyerId: string) {
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  switch (toolName) {
    case "query_documents":
      return await queryDocuments(args, buyerId);
    case "query_suppliers":
      return await querySuppliers(args, buyerId);
    case "get_compliance_metrics":
      return await getComplianceMetrics(buyerId);
    case "create_document_request":
      return await createDocumentRequest(args, buyerId);
    case "get_document_sets":
      return await getDocumentSets(buyerId);
    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`
      };
  }
}

async function callOpenAI(messages: any[], toolChoice: any = "auto") {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: toolChoice,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { buyer_id, question, session_id, user_context } = await req.json();
    
    const companyType = user_context?.company_type || 'buyer';
    const industry = user_context?.industry || 'General';
    
    console.log('simple-rag-chat request:', { buyer_id, question, session_id });
    console.log('User context:', { company_type: companyType, industry });

    if (!buyer_id || !question) {
      return new Response(
        JSON.stringify({ error: 'buyer_id and question are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recent conversation history for context
    let conversationHistory: any[] = [];
    let pendingAction: any = null;
    
    if (session_id) {
      const { data: recentMessages } = await supabase
        .from('chat_messages')
        .select('role, content, created_at, metadata')
        .eq('session_id', session_id)
        .order('created_at', { ascending: false })
        .limit(8); // Last 8 messages for better context

      if (recentMessages && recentMessages.length > 0) {
        // Reverse to get chronological order (oldest first)
        conversationHistory = recentMessages
          .reverse()
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .map(msg => ({
            role: msg.role,
            content: msg.content
          }));
        
        // Check for pending actions in recent assistant messages
        const assistantWithPending = recentMessages.find(
          msg => msg.role === 'assistant' && msg.metadata?.pending_action
        );
        
        if (assistantWithPending) {
          pendingAction = assistantWithPending.metadata.pending_action;
          console.log('Found pending action:', pendingAction);
        }
        
        console.log(`Loaded ${conversationHistory.length} messages from conversation history`);
      }
    }

    // DETERMINISTIC SHORT-REPLY INTERCEPTOR
    // Handle short confirmations/modifications for pending actions
    const normalizedQuestion = question.trim().toLowerCase();
    const isConfirm = /^(yes|yess|y|yeah|sure|go ahead|proceed|confirm|correct|that's right)$/i.test(normalizedQuestion);
    const isNoNotes = /^(no|nope|nah|no notes|skip notes|no changes|not now)$/i.test(normalizedQuestion);
    const hasNoteCmd = /^(add note|note:|make it|change|update)/i.test(question);
    
    if ((isConfirm || isNoNotes || hasNoteCmd) && pendingAction?.type === 'create_document_request') {
      console.log('Intercepting short reply for pending action:', { normalizedQuestion, pendingAction });
      
      const params = { ...pendingAction.params };
      
      // Handle different reply types
      if (isNoNotes) {
        params.notes = '';
      } else if (hasNoteCmd) {
        // Extract modifications from command
        const priorityMatch = question.match(/(low|medium|high|urgent)/i);
        const dateMatch = question.match(/(\d{4}-\d{2}-\d{2})|(?:due|date).*?(\d{1,2})(?:th|st|nd|rd)?/i);
        const noteMatch = question.match(/(?:add note|note:)\s*(.+)/i);
        
        if (priorityMatch) params.priority = priorityMatch[1].toLowerCase();
        if (dateMatch && dateMatch[1]) params.due_date = dateMatch[1];
        if (noteMatch) params.notes = noteMatch[1].trim();
      }
      
      // Execute the request directly
      const result = await createDocumentRequest(params, buyer_id);
      
      // Save both user message and assistant response
      const userMsg = {
        session_id,
        role: 'user',
        content: question,
        metadata: {}
      };
      
      const responseText = result.success
        ? `✓ Created ${result.created_count} document request${result.created_count > 1 ? 's' : ''} for ${result.supplier_name}:\n- Documents: ${result.document_types?.join(', ')}\n- Due: ${result.due_date}\n- Priority: ${result.priority}\n${result.notes ? `- Notes: ${result.notes}` : ''}`
        : `I couldn't create the request: ${result.error || 'Unknown error'}`;
      
      const assistantMsg = {
        session_id,
        role: 'assistant',
        content: responseText,
        metadata: result.success ? { action: 'document_requests_created', data: result } : {}
      };
      
      await supabase.from('chat_messages').insert([userMsg, assistantMsg]);
      
      return new Response(JSON.stringify({
        answer: responseText,
        structured_response: result.success ? {
          action: 'document_requests_created',
          data: result,
          response: responseText
        } : undefined,
        session_id,
        conversation_history: [...conversationHistory, userMsg, assistantMsg]
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Step 1: Initial conversation with OpenAI
    const messages = [
      {
        role: "system",
        content: `You are a compliance assistant helping a ${companyType} in the ${industry} industry manage their ${companyType === 'buyer' ? 'supplier documents and compliance' : 'document submissions and buyer requirements'}. Today's date is ${new Date().toISOString().split('T')[0]}.

USER CONTEXT:
- Role: ${companyType.toUpperCase()}
- Industry: ${industry}
- This means you should provide responses relevant to ${industry}-specific compliance requirements and terminology.

Use the available tools to answer questions about:
- Documents (certificates, safety sheets, insurance, etc.)
- Suppliers and their connection status
- Compliance metrics and statistics
- Creating document requests for suppliers

CRITICAL TOOL USAGE RULES:

1. INFORMATION QUERIES - Use tools IMMEDIATELY without asking or announcing:
   - "show me documents from X" → IMMEDIATELY call query_documents (no "I'll retrieve..." message)
   - "what documents are approved?" → IMMEDIATELY call query_documents
   - "give me all documents from Kerry" → IMMEDIATELY call query_documents  
   - "find documents expiring soon" → IMMEDIATELY call query_documents
   - "which suppliers are connected?" → IMMEDIATELY call query_suppliers
   - "what's my compliance score?" → IMMEDIATELY call get_compliance_metrics
   
   DO NOT say "I'll retrieve..." or "Please hold on a moment..." - JUST CALL THE TOOL DIRECTLY.

2. ACTION REQUESTS - Confirm parameters first, then execute on confirmation:
   - "create document request" → Confirm details, wait for "yes", then execute
   - "request documents from X" → Confirm details, wait for "yes", then execute

3. FOLLOW-UP CONFIRMATIONS - Execute immediately without further delay:
   - After presenting request details and user says "yes" → IMMEDIATELY execute
   - User makes modifications → Update params and IMMEDIATELY execute

WRONG behavior (DO NOT DO THIS):
User: "show me documents from Kerry"
AI: "I found Kerry. I'll retrieve all approved documents. Please hold on." ❌
(This just announces intent but never calls the tool!)

CORRECT behavior:
User: "show me documents from Kerry"  
AI: [IMMEDIATELY calls query_documents with supplier_names=["Kerry"], status=["approved"]]
→ Then presents the results in a clear format

DOCUMENT REQUEST CREATION:
When users want to create document requests, guide them through the process:
1. Identify the supplier (use fuzzy matching from query_suppliers)
2. Ask which documents they need OR suggest using saved document sets (get_document_sets)
3. Confirm due date (default: 14 days) and priority (default: medium)
4. Ask if they want to add custom notes (optional)
5. Use create_document_request tool to create the requests
6. Confirm success with details: supplier name, number of requests, due date

HANDLING USER CONFIRMATIONS (CRITICAL):
When users respond with confirmations or modifications after you've presented request details, you MUST IMMEDIATELY execute the create_document_request tool. DO NOT just acknowledge - TAKE ACTION.

Confirmation phrases that mean "execute now":
- "yes" / "yess" / "yeah" / "sure" / "go ahead" / "proceed" / "correct" / "that's right"
- "no" / "nope" / "nah" when asked "Would you like to add any notes?" (means "no notes, proceed")
- "yes its 2025" (correction + confirmation)
- "yes change date to X" (modification + confirmation)
- "add note Y" (direct command)
- "make it urgent" (priority update command)

CRITICAL EXECUTION RULES:
1. If user says "yes" or any confirmation phrase → IMMEDIATELY call create_document_request with parameters from conversation history
2. If you just asked "Would you like to add any notes?" and user replies "no"/"nope"/"nah"/"no notes" → IMMEDIATELY call create_document_request with empty notes
3. If user makes modifications ("change date to X", "add note Y") → Update parameters and IMMEDIATELY execute
4. NEVER respond with just "Thank you for confirming" or "I'll proceed with that" - EXECUTE THE TOOL
5. Use conversation history to gather all parameters (supplier, documents, priority, date, notes)
6. If there's a typo (like "22025" instead of "2025"), correct it and proceed with the corrected value
7. Look back at previous messages to find supplier name, document types, priority level, and notes

Example of CORRECT behavior:
User (message 1): "Request HACCP from Killer Farms, urgent"
AI: "Confirming: HACCP from Killer Farms, urgent priority, due Oct 25, 2025. Would you like to add any notes?"
User (message 2): "change date to Oct 20 and add note 'rush order'"
AI: [IMMEDIATELY calls create_document_request with supplier="Killer Farms", documents=["HACCP"], priority="urgent", due_date="2025-10-20", notes="rush order"] → Shows success message

Example of WRONG behavior (DO NOT DO THIS):
User: "yes"
AI: "Thank you for confirming. I'll create the request now." ❌ WRONG - Should execute tool instead

CONVERSATIONAL FLOW EXAMPLES FOR REQUESTS:
User: "I want to request ISO 9001 from Kerry"
→ Create request with defaults, confirm success

User: "Can you request documents from Kerry?"
→ "I found Kerry as an approved supplier. Which documents would you like to request? You can also use saved document sets if you have any."

User: "Request HACCP and ISO 22000 from Killer Farms, urgent priority, due next week"
→ Create with specified priority and calculate due date

IMPORTANT FILTERING RULES:
- When filtering by expiration dates, always consider documents already past their expiration date as "expired", not "expiring soon".
- If user asks for documents that are "valid", "currently valid", or "valid till date", call query_documents with expired=false to exclude already expired documents.
- For "latest" or "most recent" queries, rely on the default ordering (newest first) and use limit=1 if needed.

When presenting results:
- Be clear and concise
- Format lists nicely
- Include relevant details like expiration dates, statuses, and supplier names
- Tailor your language and examples to the ${industry} industry context
- If no results are found, suggest alternative searches or provide helpful guidance
- For document request creation, always confirm what was created and provide clear feedback

IMPORTANT - Document Query Presentation:
- When presenting document query results, keep your narrative response VERY concise (e.g., "Here are the 5 approved documents from Kerry:")
- The frontend will automatically render documents in beautiful cards with View and Copy Link buttons
- DO NOT repeat all document details (title, type, expiration, etc.) in text format - the cards will show them
- Focus on providing brief context, insights, or next steps instead of listing details`
      },
      // Add recent conversation history for context
      ...conversationHistory,
      // Add current question
      {
        role: "user",
        content: question
      }
    ];

    console.log(`Total messages sent to OpenAI: ${messages.length} (including ${conversationHistory.length} history messages)`);

    // Save user message to history
    if (session_id) {
      await supabase
        .from('chat_messages')
        .insert({
          session_id,
          role: 'user',
          content: question,
          metadata: { company_type: companyType, industry }
        });
      
      console.log('Saved user message to chat history');
    }

    let aiResponse = await callOpenAI(messages);
    
    // Step 2: If OpenAI wants to use tools, execute them
    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      console.log(`OpenAI requested ${aiResponse.tool_calls.length} tool calls`);
      
      // Add the assistant's response with tool calls
      messages.push(aiResponse);
      
      // Execute each tool call
      for (const toolCall of aiResponse.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        const toolResult = await executeToolCall(toolName, toolArgs, buyer_id);
        
        // Add tool result to conversation
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(toolResult)
        });
      }
      
      // Step 3: Get final answer from OpenAI with tool results
      aiResponse = await callOpenAI(messages, "none"); // Don't allow more tool calls
      
      // Check if any of the tool results was a document query
      const queryDocumentsResult = messages
        .filter((m: any) => m.role === 'tool' && m.name === 'query_documents')
        .map((m: any) => {
          try {
            return JSON.parse(m.content);
          } catch {
            return null;
          }
        })
        .find((result: any) => result?.success && result?.documents);
      
      // Check if any of the tool results was a document request creation
      const documentRequestResult = messages
        .filter((m: any) => m.role === 'tool' && m.name === 'create_document_request')
        .map((m: any) => {
          try {
            return JSON.parse(m.content);
          } catch {
            return null;
          }
        })
        .find((result: any) => result?.success);
      
      // Save assistant response to history with pending action detection
      if (session_id) {
        // Check if this is a confirmation request for document creation
        const maybePending = parsePendingRequest(aiResponse.content);
        const isAskingForNotes = /would you like to add any notes|any additional notes|add notes/i.test(aiResponse.content);
        
        await supabase
          .from('chat_messages')
          .insert({
            session_id,
            role: 'assistant',
            content: aiResponse.content,
            metadata: documentRequestResult ? { 
              action: 'document_requests_created',
              data: documentRequestResult 
            } : queryDocumentsResult ? {
              action: 'documents_queried',
              count: queryDocumentsResult.documents?.length || 0
            } : (maybePending && isAskingForNotes) ? {
              pending_action: maybePending
            } : {}
          });
        
        console.log('Saved assistant response to chat history', maybePending ? 'with pending action' : '');
      }

      // If we queried documents, format the response with structured document cards
      if (queryDocumentsResult && queryDocumentsResult.documents && queryDocumentsResult.documents.length > 0) {
        return new Response(
          JSON.stringify({
            answer: aiResponse.content,
            session_id,
            conversation_history: messages,
            structured_response: {
              content: aiResponse.content,
              documents: queryDocumentsResult.documents.map((doc: any) => ({
                id: doc.id,
                title: doc.title,
                document_type: doc.document_type,
                category: doc.category,
                supplier_name: doc.supplier_name,
                status: doc.status,
                expiration_date: doc.expiration_date,
                file_path: doc.file_path || null
              }))
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If we created document requests, format the response specially
      if (documentRequestResult) {
        return new Response(
          JSON.stringify({
            answer: aiResponse.content,
            session_id,
            conversation_history: messages,
            structured_response: {
              action: 'document_requests_created',
              data: documentRequestResult,
              response: aiResponse.content
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Save assistant response to history (if no tool calls)
    if (session_id) {
      await supabase
        .from('chat_messages')
        .insert({
          session_id,
          role: 'assistant',
          content: aiResponse.content,
          metadata: {}
        });
      
      console.log('Saved assistant response to chat history');
    }

    console.log('simple-rag-chat response generated successfully');

    return new Response(
      JSON.stringify({
        answer: aiResponse.content,
        session_id,
        conversation_history: messages
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in simple-rag-chat:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        answer: "I encountered an error processing your request. Please try again or rephrase your question."
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
