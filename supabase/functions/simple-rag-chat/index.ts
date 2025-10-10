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
  }
];

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
    
    if (filters.expired === true) {
      query = query.lt('expiration_date', new Date().toISOString());
    } else if (filters.expired === false) {
      query = query.gte('expiration_date', new Date().toISOString());
    }
    
    if (filters.expiring_days) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + filters.expiring_days);
      query = query.lte('expiration_date', futureDate.toISOString())
                   .gte('expiration_date', new Date().toISOString());
    }
    
    const limit = Math.min(filters.limit || 20, 100);
    query = query.limit(limit).order('created_at', { ascending: false });

    const { data, error } = await query;
    
    if (error) throw error;

    // If supplier_names filter is provided, filter in-memory (since we can't filter through nested relations easily)
    let results = data || [];
    if (filters.supplier_names && filters.supplier_names.length > 0) {
      results = results.filter((doc: any) => {
        const supplierName = doc.document_requests?.suppliers?.company_name?.toLowerCase() || '';
        return filters.supplier_names.some((name: string) => 
          supplierName.includes(name.toLowerCase())
        );
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
        created_at: doc.created_at
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

async function executeToolCall(toolName: string, args: any, buyerId: string) {
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  switch (toolName) {
    case "query_documents":
      return await queryDocuments(args, buyerId);
    case "query_suppliers":
      return await querySuppliers(args, buyerId);
    case "get_compliance_metrics":
      return await getComplianceMetrics(buyerId);
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
    const { buyer_id, question, session_id } = await req.json();
    
    console.log('simple-rag-chat request:', { buyer_id, question, session_id });

    if (!buyer_id || !question) {
      return new Response(
        JSON.stringify({ error: 'buyer_id and question are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Initial conversation with OpenAI
    const messages = [
      {
        role: "system",
        content: `You are a compliance assistant helping a buyer manage their supplier documents and compliance.
        
Use the available tools to answer questions about:
- Documents (certificates, safety sheets, insurance, etc.)
- Suppliers and their connection status
- Compliance metrics and statistics

When presenting results:
- Be clear and concise
- Format lists nicely
- Include relevant details like expiration dates, statuses, and supplier names
- If no results are found, suggest alternative searches or provide helpful guidance`
      },
      {
        role: "user",
        content: question
      }
    ];

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
