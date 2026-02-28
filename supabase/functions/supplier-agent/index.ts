import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

// Initialize environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://edwerzutsknhuplidhsj.supabase.co';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

console.log('Supplier Agent starting...');
console.log('Service Role Key available:', !!supabaseServiceRoleKey);
console.log('OpenAI Key available:', !!openAIApiKey);

if (!supabaseServiceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
}

if (!openAIApiKey) {
  console.error('OPENAI_API_KEY is not set');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey!);

interface DocumentRequest {
  id: string;
  supplier_id: string;
  buyer_id: string;
  document_type: string;
  due_date: string;
  status: string;
}

interface ExistingDocument {
  id: string;
  file_name: string;
  file_path: string;
  expiration_date: string;
  status: string;
}

async function logAgentActivity(
  action_type: string,
  entity_id: string,
  entity_type: string,
  details: any,
  success: boolean = true,
  confidence_score?: number,
  error_message?: string
) {
  const { error } = await supabase
    .from('agent_activities')
    .insert({
      agent_type: 'supplier',
      action_type,
      entity_id,
      entity_type,
      details,
      success,
      confidence_score,
      error_message
    });
  
  if (error) {
    console.error('Failed to log agent activity:', error);
  }
}

async function analyzeDocumentMatch(requestType: string, existingDocs: ExistingDocument[]): Promise<any> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = `
  As an advanced AI compliance agent, perform sophisticated document analysis with predictive capabilities:
  
  Requested Document Type: "${requestType}"
  
  Existing Documents:
  ${existingDocs.map(doc => `- ${doc.file_name} (ID: ${doc.id}, expires: ${doc.expiration_date}, status: ${doc.status})`).join('\n')}
  
  Provide comprehensive analysis including:
  1. Semantic document matching with confidence scoring
  2. Risk assessment and compliance evaluation
  3. Predictive insights on document lifecycle
  4. Intelligent automation recommendations
  5. Future document needs prediction
  
  Return JSON with advanced insights:
  {
    "bestMatch": {
      "documentId": "id of best matching document or null",
      "confidence": 0.0-1.0,
      "reasoning": "detailed explanation with risk factors"
    },
    "isExpired": boolean,
    "riskAssessment": {
      "level": "low|medium|high",
      "factors": ["list of risk factors"],
      "mitigationActions": ["recommended actions"]
    },
    "predictiveInsights": {
      "expiryProbability": 0.0-1.0,
      "complianceScore": 0.0-1.0,
      "futureDocumentNeeds": ["predicted future requirements"],
      "automationOpportunities": ["areas for workflow automation"]
    },
    "recommendations": ["strategic recommendations"],
    "nextAction": "auto_submit|manual_review|request_new|escalate",
    "workflowTriggers": ["workflow_ids to trigger based on analysis"]
  }
  `;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07',
      messages: [
        { role: 'system', content: 'You are an advanced AI compliance agent with predictive analytics capabilities. Provide comprehensive document analysis with strategic insights and automation recommendations. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 1000,
    }),
  });

  const data = await response.json();
  
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError);
    // Return fallback response
    return {
      bestMatch: { documentId: null, confidence: 0, reasoning: 'AI analysis failed' },
      isExpired: false,
      riskAssessment: { level: 'medium', factors: [], mitigationActions: [] },
      predictiveInsights: { expiryProbability: 0, complianceScore: 0.5, futureDocumentNeeds: [], automationOpportunities: [] },
      recommendations: ['Manual review required'],
      nextAction: 'manual_review',
      workflowTriggers: []
    };
  }
}

async function calculateAverageResponseTime(supplierId: string, buyerId: string) {
  const { data, error } = await supabase
    .from('supplier_response_metrics')
    .select('response_time_hours')
    .eq('supplier_id', supplierId)
    .eq('buyer_id', buyerId)
    .not('response_time_hours', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) {
    return 48; // Default 48 hours
  }

  const avgHours = data.reduce((sum, record) => sum + record.response_time_hours, 0) / data.length;
  return Math.round(avgHours);
}

async function processDocumentRequest(request: DocumentRequest) {
  try {
    console.log(`Processing document request: ${request.id}`);

    // Find existing documents for this supplier and document type
    const { data: existingDocs, error: docsError } = await supabase
      .from('document_uploads')
      .select('id, file_name, file_path, expiration_date, status')
      .eq('uploader_id', request.supplier_id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (docsError) {
      throw new Error(`Failed to fetch existing documents: ${docsError.message}`);
    }

    await logAgentActivity(
      'document_search',
      request.id,
      'document_request',
      { found_documents: existingDocs?.length || 0, document_type: request.document_type }
    );

    if (!existingDocs || existingDocs.length === 0) {
      console.log(`No existing documents found for supplier ${request.supplier_id}`);
      return;
    }

    // Use AI to analyze document matches with advanced workflow integration
    const analysis = await analyzeDocumentMatch(request.document_type, existingDocs);
    
    await logAgentActivity(
      'advanced_document_analysis',
      request.id,
      'document_request',
      analysis,
      true,
      analysis.bestMatch.confidence
    );

    // Trigger workflows based on AI analysis
    if (analysis.workflowTriggers && analysis.workflowTriggers.length > 0) {
      for (const workflowTemplateId of analysis.workflowTriggers) {
        await supabase.functions.invoke('workflow-engine', {
          body: {
            action: 'start_workflow',
            template_id: workflowTemplateId,
            context: {
              document_request_id: request.id,
              supplier_id: request.supplier_id,
              buyer_id: request.buyer_id,
              document_type: request.document_type,
              analysis_results: analysis,
              user_id: request.supplier_id
            }
          }
        });
      }
    }

    // Execute action based on AI recommendation
    switch (analysis.nextAction) {
      case 'auto_submit':
        if (analysis.bestMatch.confidence > 0.8 && !analysis.isExpired) {
          const matchingDoc = existingDocs.find(doc => doc.id === analysis.bestMatch.documentId);
          
          if (matchingDoc) {
            // Copy the existing document for this request
            const { error: uploadError } = await supabase
              .from('document_uploads')
              .insert({
                request_id: request.id,
                file_name: matchingDoc.file_name,
                file_path: matchingDoc.file_path,
                uploader_id: request.supplier_id,
                status: 'pending_review',
                expiration_date: matchingDoc.expiration_date
              });

            if (!uploadError) {
              await logAgentActivity(
                'ai_auto_submit',
                request.id,
                'document_request',
                { 
                  submitted_document: matchingDoc.id, 
                  confidence: analysis.bestMatch.confidence,
                  reasoning: analysis.bestMatch.reasoning,
                  risk_level: analysis.riskAssessment.level,
                  predictive_insights: analysis.predictiveInsights
                },
                true,
                analysis.bestMatch.confidence
              );

              // Update request status
              await supabase
                .from('document_requests')
                .update({ status: 'submitted' })
                .eq('id', request.id);

              console.log(`AI auto-submitted document for request ${request.id} with confidence ${analysis.bestMatch.confidence}`);
            }
          }
        }
        break;

      case 'request_new':
        // Trigger document generation workflow
        await supabase.functions.invoke('workflow-engine', {
          body: {
            action: 'start_workflow',
            template_id: 'intelligent-document-generation',
            context: {
              document_request_id: request.id,
              supplier_id: request.supplier_id,
              document_type: request.document_type,
              requirements: analysis.predictiveInsights?.futureDocumentNeeds || [],
              user_id: request.supplier_id
            }
          }
        });
        break;

      case 'escalate':
        // Create escalation notification
        await supabase
          .from('notifications')
          .insert({
            user_id: request.buyer_id,
            title: 'Document Request Escalation',
            message: `Document request ${request.id} requires immediate attention. Risk level: ${analysis.riskAssessment.level}`,
            type: 'escalation',
            reference_id: request.id
          });
        break;

      case 'manual_review':
      default:
        // Log for manual intervention
        await logAgentActivity(
          'requires_manual_review',
          request.id,
          'document_request',
          { 
            reasoning: analysis.bestMatch.reasoning,
            risk_factors: analysis.riskAssessment.factors,
            recommendations: analysis.recommendations
          },
          true,
          analysis.bestMatch.confidence
        );
        break;
    }

  } catch (error) {
    console.error(`Error processing document request ${request.id}:`, error);
    await logAgentActivity(
      'process_error',
      request.id,
      'document_request',
      { error: error.message },
      false,
      undefined,
      error.message
    );
  }
}

async function checkExpiringDocuments(company_id?: string, company_type?: string) {
  try {
    console.log(`Checking for expiring documents for company ${company_id} (${company_type})...`);

    // Find documents expiring in the next 30-60 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

    let expiringQuery = supabase
      .from('document_uploads')
      .select(`
        id, 
        file_name, 
        expiration_date,
        request_id,
        document_requests!inner(
          supplier_id,
          buyer_id,
          suppliers!inner(profile_id, company_name),
          buyers!inner(profile_id, company_name, contact_email)
        )
      `)
      .gte('expiration_date', thirtyDaysFromNow.toISOString())
      .lte('expiration_date', sixtyDaysFromNow.toISOString())
      .eq('status', 'approved');

    // Filter by company if specified
    if (company_id && company_type === 'supplier') {
      expiringQuery = expiringQuery.eq('document_requests.supplier_id', company_id);
    } else if (company_id && company_type === 'buyer') {
      expiringQuery = expiringQuery.eq('document_requests.buyer_id', company_id);
    }

    const { data: expiringDocs, error } = await expiringQuery;

    if (error) {
      console.error('Error fetching expiring documents:', error);
      return;
    }

    for (const doc of expiringDocs || []) {
      const request = doc.document_requests;
      const avgResponseTime = await calculateAverageResponseTime(request.supplier_id, request.buyer_id);
      
      // Calculate notification timing based on response time
      const notificationDays = Math.max(avgResponseTime / 24 + 10, 30); // At least 30 days notice
      const notificationDate = new Date(doc.expiration_date);
      notificationDate.setDate(notificationDate.getDate() - notificationDays);

      if (new Date() >= notificationDate) {
        // Send notification via edge function
        await supabase.functions.invoke('send-expiry-notification', {
          body: {
            supplier_email: request.suppliers.profile_id, // Will need to fetch actual email
            buyer_email: request.buyers.contact_email,
            document_name: doc.file_name,
            expiration_date: doc.expiration_date,
            days_until_expiry: Math.ceil((new Date(doc.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          }
        });

        await logAgentActivity(
          'expiry_notification',
          doc.id,
          'document_upload',
          { 
            expiration_date: doc.expiration_date,
            notification_days: notificationDays,
            avg_response_time: avgResponseTime
          }
        );
      }
    }

  } catch (error) {
    console.error('Error checking expiring documents:', error);
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    // ============================================
    // Auth validation
    // ============================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Invalid authentication:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Supplier agent - Authenticated');

    // Rate limiting: 10 req/min/user
    const rateCheck = checkRateLimit(user.id, 10, 60_000);
    if (!rateCheck.allowed) {
      return rateLimitResponse(corsHeaders, rateCheck.retryAfterMs);
    }

    const requestBody = await req.json();
    console.log('Supplier agent received request, action:', requestBody?.action);
    
    // Handle both old format ({ action, data }) and new format ({ action, company_id, company_type })
    const { action, data, company_id, company_type } = requestBody;

    // Normalize action and provide sensible defaults
    const normalizedAction = (() => {
      const map: Record<string, string> = {
        process_requests: 'process_requests',
        trigger_supplier: 'process_requests', // coordinator alias
        check_expiring: 'check_expiring',
        process_single: 'process_single',
      };
      if (action && map[action]) return map[action];
      if (!action && company_id && company_type) return 'process_requests';
      return action;
    })();

    switch (normalizedAction) {
      case 'process_requests':
        // Build query with optional company filtering
        let requestsQuery = supabase
          .from('document_requests')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(10);

        // If company_id and company_type are provided, filter by them
        if (company_id && company_type === 'supplier') {
          requestsQuery = requestsQuery.eq('supplier_id', company_id);
        } else if (company_id && company_type === 'buyer') {
          requestsQuery = requestsQuery.eq('buyer_id', company_id);
        }

        const { data: requests, error } = await requestsQuery;

        console.log(`Found ${requests?.length || 0} pending requests for company ${company_id} (${company_type})`);

        if (!error && requests) {
          for (const request of requests) {
            await processDocumentRequest(request);
          }
        }
        break;

      case 'check_expiring':
        // Filter expiring documents by company if specified
        if (company_id && company_type) {
          await checkExpiringDocuments(company_id, company_type);
        } else {
          await checkExpiringDocuments();
        }
        break;

      case 'process_single':
        if (data?.request_id) {
          const { data: request, error } = await supabase
            .from('document_requests')
            .select('*')
            .eq('id', data.request_id)
            .single();

          if (!error && request) {
            await processDocumentRequest(request);
          }
        }
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action', received: requestBody }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        action_performed: normalizedAction,
        company_id: company_id,
        company_type: company_type,
        message: `Supplier agent ${normalizedAction} completed successfully`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Supplier agent error:', error);
    
    await logAgentActivity(
      'agent_error',
      'unknown',
      'system',
      { 
        error: error.message,
        action,
        company_id,
        company_type
      },
      false,
      undefined,
      error.message
    );

    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        action,
        company_id,
        company_type
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});