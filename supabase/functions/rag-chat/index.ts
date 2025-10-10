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
    type: 'text' | 'list' | 'document_card' | 'chart' | 'metric_card' | 'alert';
    data?: any; // For chart data, metrics, etc.
  }[];
  documents?: DocumentReference[];
  quick_actions?: string[];
  generated_image?: string; // Base64 image string from AI
  visual_data?: {
    type: 'compliance_dashboard' | 'document_status_chart' | 'expiration_timeline' | 'supplier_comparison';
    data: any;
    config?: any;
  };
  daily_insights?: {
    priority_score: number;
    key_actions: string[];
    urgent_items: string[];
  };
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

// Enhanced query intent analysis for intelligent responses
interface QueryIntent {
  intent_type: 'latest_document' | 'specific_document' | 'document_status' | 'compliance_summary' | 'expired_documents' | 'supplier_specific' | 'daily_overview' | 'visual_analysis' | 'general_inquiry' | 'simple_question' | 'follow_up';
  entities: {
    supplier_names?: string[];
    document_types?: string[];
    time_references?: string[];
    status_types?: string[];
    visualization_type?: string;
    is_follow_up?: boolean;
    is_simple_question?: boolean;
  };
  limit_documents: number;
  confidence: number;
  requires_visual?: boolean;
  context_scope?: 'today' | 'week' | 'month' | 'all';
  response_format?: 'plain_text' | 'structured' | 'conversational';
}

// Enhanced compliance data interfaces
interface ComplianceMetrics {
  total_documents: number;
  pending_documents: number;
  approved_documents: number;
  rejected_documents: number;
  expired_documents: number;
  expiring_soon: number;
  compliance_score: number;
  avg_approval_time_hours: number;
}

interface SupplierComplianceData {
  supplier_id: string;
  supplier_name: string;
  compliance_metrics: ComplianceMetrics;
  recent_documents: DocumentReference[];
  risk_level: 'low' | 'medium' | 'high';
}

interface DailyOverview {
  pending_tasks: string[];
  expiring_documents: DocumentReference[];
  overdue_items: string[];
  compliance_alerts: string[];
  productivity_insights: string[];
}

// Get comprehensive compliance metrics for a company
async function getComplianceMetrics(companyId: string, companyType: string): Promise<ComplianceMetrics> {
  const { data: docs, error } = await supabase
    .from('document_uploads')
    .select(`
      id,
      status,
      expiration_date,
      created_at,
      document_requests!inner(
        buyer_id,
        supplier_id,
        ${companyType === 'buyer' ? 'buyer_id' : 'supplier_id'}
      )
    `)
    .eq(`document_requests.${companyType}_id`, companyId);

  if (error) {
    console.error('Compliance metrics error:', error);
    return {
      total_documents: 0,
      pending_documents: 0,
      approved_documents: 0,
      rejected_documents: 0,
      expired_documents: 0,
      expiring_soon: 0,
      compliance_score: 0,
      avg_approval_time_hours: 0
    };
  }

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const metrics = docs.reduce((acc, doc) => {
    acc.total_documents++;
    
    // Fix status mapping to match actual database values
    if (doc.status === 'pending_review' || doc.status === 'submitted') acc.pending_documents++;
    else if (doc.status === 'approved') acc.approved_documents++;
    else if (doc.status === 'rejected') acc.rejected_documents++;
    
    if (doc.expiration_date) {
      const expDate = new Date(doc.expiration_date);
      if (expDate < now) acc.expired_documents++;
      else if (expDate < thirtyDaysFromNow) acc.expiring_soon++;
    }
    
    return acc;
  }, {
    total_documents: 0,
    pending_documents: 0,
    approved_documents: 0,
    rejected_documents: 0,
    expired_documents: 0,
    expiring_soon: 0,
    compliance_score: 0,
    avg_approval_time_hours: 24
  });

  // Calculate compliance score (0-100)
  const activeDocuments = metrics.total_documents - metrics.expired_documents;
  const approvedPercentage = activeDocuments > 0 ? (metrics.approved_documents / activeDocuments) * 100 : 0;
  const urgentIssues = metrics.expired_documents + metrics.expiring_soon;
  metrics.compliance_score = Math.max(0, approvedPercentage - (urgentIssues * 10));

  return metrics;
}

// Get supplier-specific compliance data
async function getSupplierComplianceData(supplierId: string, buyerId?: string): Promise<SupplierComplianceData> {
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, company_name')
    .eq('id', supplierId)
    .single();

  if (!supplier) {
    throw new Error('Supplier not found');
  }

  const metrics = await getComplianceMetrics(supplierId, 'supplier');
  
  const { data: recentDocs } = await supabase
    .from('document_uploads')
    .select(`
      id,
      file_name,
      status,
      expiration_date,
      document_requests!inner(
        title,
        document_type,
        supplier_id
      )
    `)
    .eq('document_requests.supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(5);

  const recentDocuments: DocumentReference[] = (recentDocs || []).map(doc => ({
    id: doc.id,
    title: doc.file_name,
    document_type: doc.document_requests?.document_type || 'Unknown',
    supplier_name: supplier.company_name,
    status: doc.status,
    expiration_date: doc.expiration_date,
    metadata: { request_title: doc.document_requests?.title }
  }));

  // Calculate risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (metrics.expired_documents > 2 || metrics.compliance_score < 60) riskLevel = 'high';
  else if (metrics.expiring_soon > 1 || metrics.compliance_score < 80) riskLevel = 'medium';

  return {
    supplier_id: supplierId,
    supplier_name: supplier.company_name,
    compliance_metrics: metrics,
    recent_documents: recentDocuments,
    risk_level: riskLevel
  };
}

// Get daily overview for user's dashboard
async function getDailyOverview(companyId: string, companyType: string): Promise<DailyOverview> {
  const metrics = await getComplianceMetrics(companyId, companyType);
  
  const { data: expiringDocs } = await supabase
    .from('document_uploads')
    .select(`
      id,
      file_name,
      expiration_date,
      document_requests!inner(
        title,
        document_type,
        ${companyType}_id,
        suppliers(company_name)
      )
    `)
    .eq(`document_requests.${companyType}_id`, companyId)
    .gte('expiration_date', new Date().toISOString().split('T')[0])
    .lte('expiration_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('expiration_date', { ascending: true })
    .limit(10);

  const expiringDocuments: DocumentReference[] = (expiringDocs || []).map(doc => ({
    id: doc.id,
    title: doc.file_name,
    document_type: doc.document_requests?.document_type || 'Unknown',
    supplier_name: doc.document_requests?.suppliers?.company_name,
    status: 'approved',
    expiration_date: doc.expiration_date
  }));

  const pendingTasks = [];
  if (metrics.pending_documents > 0) {
    pendingTasks.push(`Review ${metrics.pending_documents} pending document${metrics.pending_documents > 1 ? 's' : ''}`);
  }
  if (metrics.expired_documents > 0) {
    pendingTasks.push(`Address ${metrics.expired_documents} expired document${metrics.expired_documents > 1 ? 's' : ''}`);
  }

  const complianceAlerts = [];
  if (metrics.compliance_score < 70) {
    complianceAlerts.push(`Compliance score is ${Math.round(metrics.compliance_score)}% - needs attention`);
  }
  if (metrics.expiring_soon > 0) {
    complianceAlerts.push(`${metrics.expiring_soon} document${metrics.expiring_soon > 1 ? 's' : ''} expiring within 30 days`);
  }

  return {
    pending_tasks: pendingTasks,
    expiring_documents: expiringDocuments,
    overdue_items: metrics.expired_documents > 0 ? [`${metrics.expired_documents} expired documents`] : [],
    compliance_alerts: complianceAlerts,
    productivity_insights: [
      metrics.compliance_score > 85 ? 'Excellent compliance performance!' : 'Focus on improving compliance score',
      metrics.avg_approval_time_hours < 48 ? 'Fast document processing' : 'Consider streamlining approval process'
    ]
  };
}

// Enhanced query intent analysis with visual and contextual capabilities
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

CRITICAL RULES FOR CLASSIFICATION:
1. DATA QUERIES (asking for lists, status, showing documents) = NOT simple questions
   - "what are all the expired documents" → expired_documents, is_simple_question: false, response_format: "structured"
   - "show me pending documents" → document_status, is_simple_question: false, response_format: "structured"
   - "list all suppliers" → supplier_specific, is_simple_question: false, response_format: "structured"

2. INFORMATIONAL QUERIES (asking for definitions, explanations) = simple questions
   - "what is ISO 9001" → simple_question, is_simple_question: true, response_format: "plain_text"
   - "explain compliance" → simple_question, is_simple_question: true, response_format: "plain_text"
   - "how does certification work" → simple_question, is_simple_question: true, response_format: "plain_text"

3. FOLLOW-UP QUERIES (referencing previous context) = conversational
   - "tell me more" → follow_up, is_follow_up: true, response_format: "conversational"
   - "what about that supplier" → follow_up, is_follow_up: true, response_format: "conversational"

Classify the query into one of these intent types:
- simple_question: ONLY for definitions/explanations (what is, explain, define, how does)
- follow_up: References previous conversation (tell me more, what about that, elaborate, more details)
- latest_document: Most recent document(s) from supplier or type
- specific_document: Looking for particular document type or certification
- document_status: Status of documents (pending, approved, expired)  
- compliance_summary: Overview/summary of compliance status
- expired_documents: Specifically asks about expired or expiring documents
- supplier_specific: Asks about specific supplier's documents/compliance
- daily_overview: "what does my day look like", "today's priorities", "my dashboard"
- visual_analysis: Requests charts, graphs, visual representation of data
- general_inquiry: General questions about compliance, processes, requirements

Extract entities including:
- supplier names, document types (ISO, certification, audit, etc.)
- time references (latest, recent, today, this week, expiring)
- status types (pending, approved, expired, overdue)
- visualization requests (chart, graph, visual, dashboard)
- is_simple_question: true ONLY if asking for definition/explanation, NOT for data
- is_follow_up: true if referencing previous conversation

Determine response_format:
- "plain_text" ONLY for simple informational questions
- "conversational" for follow-ups that need context
- "structured" for ALL data queries (lists, status, documents, analysis)

Determine context scope: "today" for daily queries, "week" for weekly summaries, "month" for trends, "all" for comprehensive analysis.

Set requires_visual: true if user wants charts, graphs, visual representation, compliance dashboard, or visual analysis.

Determine appropriate document limit: 1 for "latest", 2-3 for "specific", 5-10 for "summary", 15+ for comprehensive analysis.

Respond in JSON format:
{
  "intent_type": "simple_question",
  "entities": {
    "supplier_names": ["Company Name"],
    "document_types": ["ISO Certificate"],
    "time_references": ["today"],
    "status_types": ["pending"],
    "visualization_type": "dashboard",
    "is_simple_question": true,
    "is_follow_up": false
  },
  "limit_documents": 5,
  "confidence": 0.95,
  "requires_visual": false,
  "context_scope": "all",
  "response_format": "plain_text"
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
    const rawContent = data.choices[0].message.content;
    
    // Clean the response content to remove markdown code blocks
    const cleanedContent = rawContent
      .replace(/```json\s*/g, '')
      .replace(/```\s*$/g, '')
      .trim();
    
    console.log('Raw intent response:', rawContent);
    console.log('Cleaned intent response:', cleanedContent);
    
    const analysis = JSON.parse(cleanedContent);
    return analysis;
  } catch (error) {
    console.error('Intent analysis failed:', error);
    // Fallback to general inquiry
    return {
      intent_type: 'general_inquiry',
      entities: {},
      limit_documents: 5,
      confidence: 0.3,
      requires_visual: false,
      context_scope: 'all'
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

// Enhanced search with hybrid approach: vector + database search
async function searchKnowledge(
  embedding: number[], 
  companyId: string, 
  companyType: string, 
  limit: number = 5
): Promise<KnowledgeEntry[]> {
  
  console.log(`Searching knowledge for company ${companyId} (${companyType})`);
  
  const { data, error } = await supabase.rpc('search_knowledge_entries', {
    query_embedding: `[${embedding.join(',')}]`,
    company_id_param: companyId,
    company_type_param: companyType,
    similarity_threshold: 0.7,
    match_count: limit
  });

  if (error) {
    console.error('Knowledge search error:', error);
    return [];
  }

  console.log(`Found ${data?.length || 0} knowledge entries with vector search`);
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

    // Enrich with item metadata
    const enrichedDocs = await Promise.all(relevantDocs.map(async (doc) => {
      if (doc.metadata?.linked_item_ids && doc.metadata.linked_item_ids.length > 0) {
        const { data: items } = await supabase
          .from('supplier_items')
          .select('item_name, item_category')
          .in('id', doc.metadata.linked_item_ids);
        
        return {
          ...doc,
          linked_items: items || []
        };
      }
      return doc;
    }));

    // Filter and sort based on intent
    let filteredDocs = enrichedDocs;

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
    title: doc.document_requests?.title || doc.file_name,
    supplier_name: doc.document_requests?.suppliers?.company_name,
    document_type: doc.document_requests?.document_type || 'Unknown',
    expiration_date: doc.expiration_date,
    status: doc.status,
    file_path: doc.file_path,
    metadata: {
      request_title: doc.document_requests?.title,
      file_name: doc.file_name,
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

// Helper: Format data for AI image generation
function formatDataForVisualization(
  complianceData: {
    metrics?: ComplianceMetrics;
    documents?: DocumentReference[];
    supplierData?: SupplierComplianceData;
  },
  visualizationType: string
): string {
  let description = '';

  if (complianceData.metrics) {
    const m = complianceData.metrics;
    description += `
COMPLIANCE METRICS:
- Total Documents: ${m.total_documents}
- Compliance Score: ${Math.round(m.compliance_score)}%
- Approved: ${m.approved_documents}
- Pending: ${m.pending_documents}
- Expired: ${m.expired_documents}
- Rejected: ${m.rejected_documents}
- Expiring Soon (next 30 days): ${m.expiring_soon}
`;
  }

  if (complianceData.documents && complianceData.documents.length > 0) {
    // Group documents by status
    const byStatus = complianceData.documents.reduce((acc, doc) => {
      acc[doc.status] = (acc[doc.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    description += `\nDOCUMENT BREAKDOWN BY STATUS:\n`;
    Object.entries(byStatus).forEach(([status, count]) => {
      description += `- ${status}: ${count} documents\n`;
    });

    // Group by document type
    const byType = complianceData.documents.reduce((acc, doc) => {
      acc[doc.document_type] = (acc[doc.document_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    description += `\nDOCUMENT BREAKDOWN BY TYPE:\n`;
    Object.entries(byType).forEach(([type, count]) => {
      description += `- ${type}: ${count} documents\n`;
    });
  }

  if (complianceData.supplierData) {
    const s = complianceData.supplierData;
    description += `\nSUPPLIER COMPLIANCE DATA (${s.supplier_name}):
- Risk Level: ${s.risk_level.toUpperCase()}
- Compliance Score: ${Math.round(s.compliance_metrics.compliance_score)}%
- Total Documents: ${s.compliance_metrics.total_documents}
- Approved: ${s.compliance_metrics.approved_documents}
- Pending: ${s.compliance_metrics.pending_documents}
`;
  }

  description += `\nVISUALIZATION TYPE REQUESTED: ${visualizationType || 'general dashboard'}`;

  return description;
}

// Generate AI-powered compliance visualization image
async function generateComplianceImage(
  query: string,
  complianceData: {
    metrics?: ComplianceMetrics;
    documents?: DocumentReference[];
    supplierData?: SupplierComplianceData;
  },
  visualizationType: string
): Promise<string | null> {
  try {
    // Format the data for image generation
    const dataDescription = formatDataForVisualization(complianceData, visualizationType);
    
    const imagePrompt = `Generate a professional compliance dashboard visualization with the following data:
    
${dataDescription}

Create a clean, modern chart/graph that clearly shows:
- Document status breakdown (approved, pending, expired, rejected) as a pie chart or bar chart
- Compliance scores and trends with visual indicators
- Key metrics with color coding (green for good, yellow for warning, red for critical)
- Professional color scheme suitable for business compliance reporting

Style: Modern, clean, professional dashboard with clear labels and legends. Use a white or light background with high contrast for readability.`;

    console.log('Generating compliance image with OpenAI...');
    console.log('Prompt:', imagePrompt);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages: [
          {
            role: 'user',
            content: imagePrompt
          }
        ],
        tools: [{ type: "image_generation" }],
        max_completion_tokens: 1000
      }),
    });

    const data = await response.json();
    console.log('OpenAI image generation response status:', response.status);

    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return null;
    }

    // Extract the base64 image from the response
    const imageData = data.output?.find((output: any) => output.type === "image_generation_call");
    
    if (imageData && imageData.result) {
      console.log('Successfully generated compliance image');
      return imageData.result; // This is the base64 string
    }

    console.log('No image data found in response');
    return null;
  } catch (error) {
    console.error('Error generating compliance image:', error);
    return null;
  }
}

// Generate comprehensive intelligent response with contextual data and visual capabilities
async function generateStructuredResponse(
  userMessage: string, 
  knowledgeEntries: KnowledgeEntry[], 
  documents: DocumentReference[],
  userInfo: any,
  conversationHistory: any[],
  intent: QueryIntent,
  contextualData: {
    complianceMetrics?: ComplianceMetrics | null;
    dailyOverview?: DailyOverview | null;
    supplierData?: SupplierComplianceData | null;
  } = {}
): Promise<StructuredResponse> {
  
  const contextBlocks = knowledgeEntries.map(entry => 
    `[${entry.entry_type}] ${entry.title}\n${entry.content}`
  ).join('\n\n---\n\n');

  const documentContext = documents.length > 0 ? 
    `\n\nRELEVANT DOCUMENTS:\n${documents.map(doc => 
      `- ${doc.title} (${doc.document_type}) from ${doc.supplier_name || 'Unknown'} - Status: ${doc.status}${doc.expiration_date ? `, Expires: ${doc.expiration_date}` : ''}`
    ).join('\n')}` : '';

  // Filter expiring documents for special handling
  const expiringDocs = documents.filter(doc => {
    if (!doc.expiration_date) return false;
    const expiry = new Date(doc.expiration_date);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30; // Expiring within 30 days or expired
  });

  // Create intent-aware system prompt
  const intentContext = `
QUERY INTENT ANALYSIS:
- Intent Type: ${intent.intent_type}
- Confidence: ${intent.confidence}
- Document Limit: ${intent.limit_documents}
- Entities Found: ${JSON.stringify(intent.entities)}
- Expiring Documents Found: ${expiringDocs.length}
  `;

  const responseTemplates = {
    latest_document: "Focus on the most recent document(s). Highlight recency and current status.",
    specific_document: "Provide detailed information about the requested document type. Include requirements and compliance notes.", 
    document_status: "Summarize document statuses clearly. Group by status type and highlight any issues.",
    compliance_summary: "Provide a comprehensive compliance overview. Include metrics, trends, and recommendations with visual elements.",
    expired_documents: "Focus on expiration dates and urgent actions needed. Prioritize by risk level.",
    supplier_specific: "Provide supplier-focused analysis. Include performance metrics and relationship insights with visual compliance data.",
    daily_overview: "Provide a comprehensive daily briefing. Include pending tasks, urgent items, and prioritized actions for today.",
    visual_analysis: "Create visual representations of compliance data. Generate charts and metrics with clear actionable insights.",
    general_inquiry: "Provide helpful general information with relevant examples and actionable advice."
  };

  // Enhanced contextual information
  const contextualInfo = [];
  if (contextualData.complianceMetrics) {
    contextualInfo.push(`COMPLIANCE METRICS:
- Total Documents: ${contextualData.complianceMetrics.total_documents}
- Compliance Score: ${Math.round(contextualData.complianceMetrics.compliance_score)}%
- Pending Review: ${contextualData.complianceMetrics.pending_documents}
- Approved: ${contextualData.complianceMetrics.approved_documents}
- Expired: ${contextualData.complianceMetrics.expired_documents}
- Expiring Soon: ${contextualData.complianceMetrics.expiring_soon}`);
  }

  if (contextualData.dailyOverview) {
    contextualInfo.push(`DAILY OVERVIEW:
- Pending Tasks: ${contextualData.dailyOverview.pending_tasks.join(', ')}
- Expiring Documents: ${contextualData.dailyOverview.expiring_documents.length}
- Compliance Alerts: ${contextualData.dailyOverview.compliance_alerts.join(', ')}
- Key Insights: ${contextualData.dailyOverview.productivity_insights.join(', ')}`);
  }

  if (contextualData.supplierData) {
    contextualInfo.push(`SUPPLIER DATA (${contextualData.supplierData.supplier_name}):
- Risk Level: ${contextualData.supplierData.risk_level.toUpperCase()}
- Compliance Score: ${Math.round(contextualData.supplierData.compliance_metrics.compliance_score)}%
- Recent Documents: ${contextualData.supplierData.recent_documents.length}
- Documents Status: ${contextualData.supplierData.compliance_metrics.approved_documents} approved, ${contextualData.supplierData.compliance_metrics.pending_documents} pending`);
  }

  const additionalContext = contextualInfo.length > 0 ? `\n\nCONTEXTUAL DATA:\n${contextualInfo.join('\n\n')}` : '';

  // Generate visual data if required
  let visualData = undefined;
  let generatedImage = null;
  
  if (intent.requires_visual && contextualData.complianceMetrics) {
    const metrics = contextualData.complianceMetrics;
    
    // Generate AI image
    console.log('Generating AI image for visual analysis...');
    generatedImage = await generateComplianceImage(
      userMessage,
      {
        metrics: contextualData.complianceMetrics,
        documents: documents.slice(0, 20), // Limit for prompt size
        supplierData: contextualData.supplierData
      },
      intent.entities.visualization_type || 'dashboard'
    );
    
    if (generatedImage) {
      console.log('Successfully generated compliance image');
    }
    
    if (intent.entities.visualization_type === 'dashboard' || intent.intent_type === 'compliance_summary') {
      visualData = {
        type: 'compliance_dashboard' as const,
        data: {
          compliance_score: Math.round(metrics.compliance_score),
          document_status: {
            approved: metrics.approved_documents,
            pending: metrics.pending_documents,
            rejected: metrics.rejected_documents,
            expired: metrics.expired_documents
          },
          urgent_items: metrics.expiring_soon + metrics.expired_documents,
          trend: metrics.compliance_score > 80 ? 'positive' : metrics.compliance_score > 60 ? 'neutral' : 'negative'
        }
      };
    } else if (intent.intent_type === 'supplier_specific' && contextualData.supplierData) {
      visualData = {
        type: 'supplier_comparison' as const,
        data: {
          supplier_name: contextualData.supplierData.supplier_name,
          risk_level: contextualData.supplierData.risk_level,
          compliance_score: contextualData.supplierData.compliance_metrics.compliance_score,
          document_breakdown: {
            total: contextualData.supplierData.compliance_metrics.total_documents,
            approved: contextualData.supplierData.compliance_metrics.approved_documents,
            pending: contextualData.supplierData.compliance_metrics.pending_documents,
            expired: contextualData.supplierData.compliance_metrics.expired_documents
          }
        }
      };
    }
  }

  // Daily insights for overview queries
  let dailyInsights = undefined;
  if (intent.intent_type === 'daily_overview' && contextualData.dailyOverview && contextualData.complianceMetrics) {
    const urgentCount = contextualData.complianceMetrics.expired_documents + contextualData.complianceMetrics.expiring_soon;
    const priorityScore = Math.max(0, 100 - (urgentCount * 20) - (contextualData.complianceMetrics.pending_documents * 5));
    
    dailyInsights = {
      priority_score: priorityScore,
      key_actions: contextualData.dailyOverview.pending_tasks.slice(0, 3),
      urgent_items: [
        ...contextualData.dailyOverview.compliance_alerts,
        ...contextualData.dailyOverview.overdue_items
      ]
    };
  }

  // Build conversation context from recent messages for follow-ups
  const recentMessages = conversationHistory.slice(-10); // Last 5 Q&A pairs
  const contextSummary = recentMessages
    .filter(msg => msg.role === 'assistant')
    .slice(-3) // Last 3 AI responses
    .map(msg => {
      const content = typeof msg.content === 'string' 
        ? msg.content 
        : JSON.stringify(msg.content);
      return content.substring(0, 400); // First 400 chars
    })
    .join('\n---PREVIOUS RESPONSE---\n');

  // Determine response style based on query type
  const isSimpleQuestion = intent.intent_type === 'simple_question' || 
    intent.entities.is_simple_question || 
    userMessage.match(/^(what is|explain|define|tell me about|how do|why is)/i);
  
  const isFollowUp = intent.intent_type === 'follow_up' || 
    intent.entities.is_follow_up || 
    userMessage.match(/^(tell me more|what about|can you|more details|elaborate|expand on|that|it|this)/i);
  
  const needsStructuredResponse = intent.intent_type === 'compliance_summary' 
    || intent.intent_type === 'expired_documents'
    || intent.intent_type === 'daily_overview'
    || intent.intent_type === 'document_status'
    || documents.length > 5
    || intent.requires_visual;

  // Enhanced response generation with conversation intelligence
  const systemPrompt = `You are an intelligent compliance assistant that adapts its response style based on the query type.

RESPONSE STYLE GUIDELINES:

1. **Simple Informational Questions** (What is X? Explain Y? Define Z?)
   - Give a clear, concise answer in 2-3 paragraphs
   - Use plain text format (no JSON sections)
   - Only mention relevant documents if specifically asked
   - Keep it conversational and friendly
   - Example: "What is ISO 9001?" → Brief 2-3 paragraph explanation

2. **Follow-Up Questions** (Tell me more, What about X, Can you elaborate?)
   - Reference the previous conversation naturally
   - Build on what was already discussed
   - Stay conversational and maintain context
   - Use plain text unless detailed analysis is needed
   - Example: "Tell me more about that" → Continue from previous context

3. **Complex Analysis Questions** (Show compliance status, What documents are expiring?)
   - Use full structured format with sections
   - Include metrics, documents, action items
   - Provide executive summary and details
   - Use visual data when requested

4. **Conversation Memory**
   - Always consider the last 5 Q&A exchanges shown below
   - If user says "that document", "those suppliers", or "it" - reference previous context
   - Build a natural conversation flow
   - Maintain context across the conversation

RECENT CONVERSATION CONTEXT:
${contextSummary ? contextSummary : 'No recent conversation history'}

QUERY CLASSIFICATION:
- Type: ${intent.intent_type}
- Is Simple Question: ${isSimpleQuestion}
- Is Follow-Up: ${isFollowUp}
- Requires Structured Response: ${needsStructuredResponse}
- Response Format: ${intent.response_format || (isSimpleQuestion || isFollowUp ? 'plain_text' : 'structured')}

Context:
- Company Type: ${userInfo.companyType}
- Company ID: ${userInfo.companyId}
- Industry: ${userInfo.industry || 'General'}
- Available Knowledge: ${knowledgeEntries.length} entries
- Found Documents: ${documents.length} documents

ITEM-LEVEL AWARENESS:
When documents have linked items, always mention which items documents apply to (e.g., "COA for Yellowfin Tuna").
Identify compliance gaps for specific items when relevant.
Suggest targeted actions based on item categories.
Prioritize expired/expiring documents by item importance.

Available action types for complex queries:
- send_follow_up_email: Send emails to suppliers
- create_reminder: Set up reminders and alerts
- send_document_expiry_alert: Alert suppliers about expiring docs
- request_additional_documents: Create new document requests
- generate_compliance_report: Create compliance reports`;

  let userPrompt = `Query: "${userMessage}"`;

  // Format prompt based on query type and requirements
  if (isSimpleQuestion && !needsStructuredResponse) {
    // Simple question - plain text response
    userPrompt += `

RESPONSE FORMAT: Plain text only - NO JSON structure.

This is a simple informational question. Provide a clear, concise 2-3 paragraph explanation.
Keep it friendly and conversational. Do not include sections, bullet points, or structured data.
Only mention relevant documents if the user specifically asks about them.

Knowledge Context:
${knowledgeEntries.slice(0, 2).map(entry => `${entry.title}: ${entry.content.substring(0, 300)}`).join('\n\n')}

Just answer the question directly and naturally, like you're explaining it to a colleague.`;

  } else if (isFollowUp) {
    // Follow-up - conversational with context
    userPrompt += `

RESPONSE FORMAT: Conversational text referencing previous context.

This is a follow-up question. The user is asking you to expand on the previous conversation.
Reference what was discussed before and build on it naturally.

Previous Context:
${contextSummary}

${documents.length > 0 ? `
Relevant Documents:
${documents.slice(0, 3).map(doc => `- ${doc.title} (${doc.document_type}) - ${doc.status}`).join('\n')}
` : ''}

Respond naturally, building on the previous conversation. Use plain text unless detailed analysis is clearly needed.
If there are specific documents or data points to highlight, you can use simple bullet points.`;

  } else {
    // Complex query - full structured response
    userPrompt += `
  
Knowledge Context:
${knowledgeEntries.map(entry => `${entry.title}: ${entry.content.substring(0, 200)}...`).join('\n')}
  
Document Information:
${documents.map(doc => {
  const linkedItems = (doc as any).linked_items;
  const itemsText = linkedItems && linkedItems.length > 0 
    ? ` | Items: ${linkedItems.map((i: any) => i.item_name).join(', ')}`
    : '';
  return `Document: ${doc.title} | Supplier: ${doc.supplier_name || 'Unknown'} | Status: ${doc.status} | Type: ${doc.document_type}${doc.expiration_date ? ` | Expires: ${doc.expiration_date}` : ''}${itemsText}`;
}).join('\n')}
  
Compliance Data:
${contextualData.complianceMetrics ? `Total: ${contextualData.complianceMetrics.total_documents}, Score: ${Math.round(contextualData.complianceMetrics.compliance_score)}%, Pending: ${contextualData.complianceMetrics.pending_documents}, Expired: ${contextualData.complianceMetrics.expired_documents}` : 'No metrics available'}
  
Generate a comprehensive, well-structured response with clear headings, bullet points, and actionable insights.

${intent.intent_type === 'expired_documents' || expiringDocs.length > 0 ? 
  `CRITICAL: Structure expiring documents responses with:
  - An "Executive Summary" section with key insights
  - A "Critical Documents" section listing each expiring document
  - An "Action Items" section with prioritized next steps
  - Use structured formatting with clear headings and bullet points` : ''}

Respond in this JSON format:
{
  "content": "Brief executive summary - 1-2 sentences highlighting the key finding",
  "sections": [
    {
      "title": "📊 Executive Summary", 
      "content": "• Key insight 1\n• Key insight 2\n• Overall assessment",
      "type": "executive_summary"
    },
    {
      "title": "⚠️ Critical Issues" | "📋 Key Documents" | "💡 Insights",
      "content": "• Bullet point 1\n• Bullet point 2\n• Action item with timeline",
      "type": "bullet_list|document_overview|insights|actions"
    }
  ],
  ${intent.requires_visual ? '"visual_data": { "type": "compliance_dashboard|supplier_comparison|expiration_timeline", "data": {} },' : ''}
  ${intent.intent_type === 'daily_overview' ? '"daily_insights": { "priority_score": 85, "key_actions": [], "urgent_items": [] },' : ''}
  "documents": [],
  "quick_actions": [],
  "actionable_items": [],
  "suggested_actions": []
}

KNOWLEDGE BASE:
${contextBlocks}

RELEVANT DOCUMENTS:
${documentContext}

ENHANCED RESPONSE GUIDELINES:
- Structure responses with clear headings using emojis (📊, ⚠️, 📋, 💡, ✅)
- Use bullet points for lists and key information (• format)
- Create scannable sections: Executive Summary, Critical Issues, Key Documents, Action Items, Recommendations
- Include specific numbers, dates, and percentages from contextual data
- Prioritize urgent items with clear urgency indicators (🔴 Critical, 🟡 Important, 🟢 Normal)
- Use structured formatting: headings, bullet points, numbered action steps
- Provide actionable insights with specific timelines and next steps
- Format document information as clear bullet lists within document_overview sections
- End with prioritized action items and quick recommendations

Current context: ${userInfo.companyType} in ${userInfo.industry || 'general'} industry.
Data available: ${documents.length} documents, ${contextualData.complianceMetrics ? 'compliance metrics' : 'no metrics'}, ${contextualData.dailyOverview ? 'daily overview' : 'no overview'}.`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-8), // Last 8 messages for context
    { role: 'user', content: userPrompt }
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
  
  // Handle simple text responses (for simple questions and follow-ups)
  if (isSimpleQuestion || isFollowUp) {
    // For simple questions/follow-ups, return plain text if it doesn't look like JSON
    if (!rawResponse.trim().startsWith('{')) {
      return {
        type: 'simple',
        content: rawResponse,
        sections: [],
        documents: documents.slice(0, 3), // Include a few relevant docs
        quick_actions: []
      };
    }
  }
  
  try {
    // Clean the response content to remove markdown code blocks and fix common issues
    const cleanedResponse = rawResponse
      .replace(/```json\s*/g, '')
      .replace(/```\s*$/g, '')
      .replace(/^```/g, '')
      .replace(/```$/g, '')
      .trim();
    
    console.log('Raw OpenAI response:', rawResponse);
    console.log('Cleaned response for parsing:', cleanedResponse);
    
    // Try to parse structured response
    const structuredResponse = JSON.parse(cleanedResponse);
    
    // Ensure we have the required response field
    if (!structuredResponse.response && !structuredResponse.content) {
      structuredResponse.response = typeof structuredResponse === 'string' 
        ? structuredResponse 
        : 'I have analyzed your request and prepared a comprehensive response.';
    }
    
    // Enhance with actual data - prioritize expiring docs for consistency
    if (intent.intent_type === 'expired_documents' || expiringDocs.length > 0) {
      structuredResponse.documents = expiringDocs.length > 0 ? expiringDocs : documents;
    } else if (documents.length > 0) {
      structuredResponse.documents = documents;
    }

    // Add visual data if generated
    if (visualData) {
      structuredResponse.visual_data = visualData;
    }

    // Add generated image if available
    if (generatedImage) {
      structuredResponse.generated_image = generatedImage;
    }

    // Add daily insights if available
    if (dailyInsights) {
      structuredResponse.daily_insights = dailyInsights;
    }
    
    return structuredResponse;
  } catch (parseError) {
    console.error('Failed to parse structured response, creating formatted fallback:', parseError);
    console.error('Raw response that failed:', rawResponse);
    
    // Create a well-formatted fallback response instead of showing raw JSON
    const cleanContent = rawResponse
      .replace(/```json\s*/g, '')
      .replace(/```\s*$/g, '')
      .replace(/^\{.*\}$/s, '') // Remove any malformed JSON
      .trim();
    
    // If it looks like it was supposed to be JSON but failed, extract meaningful content
    let formattedContent = cleanContent;
    if (rawResponse.includes('"response"') || rawResponse.includes('"content"')) {
      // Try to extract just the response content from malformed JSON
      const responseMatch = rawResponse.match(/"response":\s*"([^"]+)"/);
      const contentMatch = rawResponse.match(/"content":\s*"([^"]+)"/);
      
      if (responseMatch) {
        formattedContent = responseMatch[1];
      } else if (contentMatch) {
        formattedContent = contentMatch[1];
      }
    }
    
    // Enhanced fallback response with contextual intelligence
    const baseContent = formattedContent || "I've analyzed your compliance data and can provide insights based on the available information.";
    const enhancedContent = contextualData.dailyOverview 
      ? `${baseContent}\n\n**Today's Priorities:**\n${contextualData.dailyOverview.pending_tasks.map(task => `• ${task}`).join('\n')}`
      : baseContent;

    return {
      type: 'simple',
      response: enhancedContent,
      content: enhancedContent,
      documents: documents.length > 0 ? documents : undefined,
      generated_image: generatedImage,
      visual_data: visualData,
      daily_insights: dailyInsights,
      quick_actions: intent.intent_type === 'daily_overview' ? 
        ["Show my compliance dashboard", "What's expiring this week?", "Review pending documents"] :
        userInfo.companyType === 'buyer' ? 
          ["Show compliance overview", "Check supplier performance", "Review expiring documents"] :
          ["Check my document status", "View compliance score", "What's required next?"]
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

    // Step 3: Get comprehensive contextual data based on intent
    let complianceMetrics: ComplianceMetrics | null = null;
    let dailyOverview: DailyOverview | null = null;
    let supplierData: SupplierComplianceData | null = null;

    // Gather contextual data based on query intent
    if (queryIntent.intent_type === 'daily_overview' || queryIntent.context_scope === 'today') {
      dailyOverview = await getDailyOverview(userInfo.companyId, userInfo.companyType);
      complianceMetrics = await getComplianceMetrics(userInfo.companyId, userInfo.companyType);
    } else if (queryIntent.intent_type === 'compliance_summary' || queryIntent.requires_visual) {
      complianceMetrics = await getComplianceMetrics(userInfo.companyId, userInfo.companyType);
    } else if (queryIntent.intent_type === 'supplier_specific' && queryIntent.entities.supplier_names?.length) {
      // Find supplier ID by name
      const supplierName = queryIntent.entities.supplier_names[0];
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id')
        .ilike('company_name', `%${supplierName}%`)
        .limit(1);
      
      if (suppliers && suppliers.length > 0) {
        supplierData = await getSupplierComplianceData(suppliers[0].id);
      }
    }

    // Step 4: Search relevant knowledge and documents with intent-aware filtering
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

    // Step 5: Generate comprehensive intelligent response with contextual data
    const structuredResponse = await generateStructuredResponse(
      message, 
      knowledgeEntries,
      documents,
      userInfo, 
      conversationHistory,
      queryIntent,
      {
        complianceMetrics,
        dailyOverview,
        supplierData
      }
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
    await saveMessage(finalSessionId, 'assistant', structuredResponse.content, {
      structured_response: structuredResponse,
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
      response: structuredResponse,
      session_id: finalSessionId,
      actionable_items: structuredResponse.actionable_items || [],
      suggested_actions: structuredResponse.suggested_actions || [],
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