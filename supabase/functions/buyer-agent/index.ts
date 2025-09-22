import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Initialize environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://edwerzutsknhuplidhsj.supabase.co';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

console.log('Buyer Agent starting...');
console.log('Supabase URL:', supabaseUrl);
console.log('Service Role Key available:', !!supabaseServiceRoleKey);
console.log('OpenAI Key available:', !!openAIApiKey);

if (!supabaseServiceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
}

if (!openAIApiKey) {
  console.error('OPENAI_API_KEY is not set');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey!);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocumentUpload {
  id: string;
  request_id: string;
  file_name: string;
  file_path: string;
  status: string;
  expiration_date: string;
  uploader_id: string;
}

interface ValidationCriteria {
  buyer_id: string;
  document_type: string;
  criteria: any;
  required_fields: string[];
  validation_rules: any;
  auto_approve_threshold: number;
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
      agent_type: 'buyer',
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

async function analyzeDocument(upload: DocumentUpload, criteria: ValidationCriteria): Promise<any> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Get buyer details and historical data for validation
  const { data: request, error: requestError } = await supabase
    .from('document_requests')
    .select(`
      *,
      buyers!inner(company_name, contact_email, address)
    `)
    .eq('id', upload.request_id)
    .single();

  if (requestError || !request) {
    throw new Error('Failed to fetch request details');
  }

  // Get supplier historical compliance data
  const { data: supplierHistory, error: historyError } = await supabase
    .from('document_uploads')
    .select('status, expiration_date, created_at, reviewer_notes')
    .eq('uploader_id', upload.uploader_id)
    .order('created_at', { ascending: false })
    .limit(10);

  const buyer = request.buyers;
  const supplierStats = supplierHistory ? {
    total_submissions: supplierHistory.length,
    approval_rate: supplierHistory.filter(d => d.status === 'approved').length / supplierHistory.length,
    rejection_rate: supplierHistory.filter(d => d.status === 'rejected').length / supplierHistory.length,
    recent_issues: supplierHistory.slice(0, 3).filter(d => d.status === 'rejected').map(d => d.reviewer_notes)
  } : null;

  const prompt = `
  As an advanced AI compliance specialist, perform multi-layered document validation with predictive risk assessment:
  
  Document Analysis:
  - Document: ${upload.file_name}
  - Document Type: ${request.document_type}
  - Expiration Date: ${upload.expiration_date}
  - Upload Date: ${upload.created_at || 'Not available'}
  
  Buyer Requirements:
  - Company: ${buyer.company_name}
  - Email: ${buyer.contact_email}
  - Address: ${buyer.address || 'Not specified'}
  
  Validation Criteria:
  ${JSON.stringify(criteria.criteria, null, 2)}
  
  Required Fields: ${criteria.required_fields?.join(', ') || 'None specified'}
  
  Validation Rules:
  ${JSON.stringify(criteria.validation_rules, null, 2)}
  
  Supplier Historical Performance:
  ${supplierStats ? JSON.stringify(supplierStats, null, 2) : 'No historical data available'}
  
  Perform comprehensive analysis including:
  1. Document type semantic matching and compatibility
  2. Expiration date validity and risk assessment
  3. Required fields likelihood and completeness
  4. Compliance scoring with confidence intervals
  5. Risk prediction based on historical patterns
  6. Automation recommendation with reasoning
  7. Workflow triggers for follow-up actions
  
  Return comprehensive JSON analysis:
  {
    "compliance_score": 0.0-1.0,
    "confidence_level": 0.0-1.0,
    "validation_results": {
      "document_type_match": boolean,
      "expiration_valid": boolean,
      "required_fields_likely": boolean,
      "company_match_likely": boolean,
      "format_compliance": boolean,
      "content_quality_score": 0.0-1.0
    },
    "risk_assessment": {
      "level": "low|medium|high|critical",
      "factors": ["list of risk factors identified"],
      "supplier_risk_profile": "reliable|moderate|concerning|high_risk",
      "probability_of_issues": 0.0-1.0
    },
    "predictive_insights": {
      "likely_expiry_issues": boolean,
      "resubmission_probability": 0.0-1.0,
      "compliance_trend": "improving|stable|declining",
      "future_risk_indicators": ["potential future issues"]
    },
    "recommendation": "approve|reject|manual_review|conditional_approve",
    "automation_confidence": 0.0-1.0,
    "issues": ["array of specific issues found"],
    "strengths": ["array of document strengths"],
    "rejection_reason": "specific reason if recommend reject",
    "improvement_suggestions": ["specific improvement recommendations"],
    "workflow_triggers": ["workflow_ids to trigger based on analysis"],
    "next_actions": ["recommended follow-up actions"]
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
        { role: 'system', content: 'You are an advanced AI compliance specialist with predictive analytics capabilities. Provide comprehensive document validation with risk assessment, historical analysis, and automation recommendations. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 1200,
    }),
  });

  const data = await response.json();
  
  // Enhanced JSON parsing with better error handling
  let aiResponse;
  try {
    const content = data.choices[0].message.content;
    console.log('Raw AI response:', content);
    
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    
    aiResponse = JSON.parse(jsonStr);
    console.log('Parsed AI response:', aiResponse);
    return aiResponse;
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError);
    console.error('Raw content:', data.choices[0].message.content);
    // Return fallback response
    return {
      compliance_score: 0.5,
      confidence_level: 0.3,
      validation_results: {
        document_type_match: true,
        expiration_valid: true,
        required_fields_likely: true,
        company_match_likely: true,
        format_compliance: true,
        content_quality_score: 0.5
      },
      risk_assessment: {
        level: 'medium',
        factors: ['AI analysis failed'],
        supplier_risk_profile: 'moderate',
        probability_of_issues: 0.5
      },
      predictive_insights: {
        likely_expiry_issues: false,
        resubmission_probability: 0.3,
        compliance_trend: 'stable',
        future_risk_indicators: []
      },
      recommendation: 'manual_review',
      automation_confidence: 0.0,
      issues: ['AI analysis failed - manual review required'],
      strengths: [],
      rejection_reason: '',
      improvement_suggestions: ['Ensure all required fields are present'],
      workflow_triggers: [],
      next_actions: ['Manual review required']
    };
  }
}

async function processDocumentUpload(upload: DocumentUpload) {
  try {
    console.log(`Processing document upload: ${upload.id}`);

    // Get the document request details
    const { data: request, error: requestError } = await supabase
      .from('document_requests')
      .select('*')
      .eq('id', upload.request_id)
      .single();

    if (requestError || !request) {
      throw new Error('Failed to fetch document request');
    }

    // Get validation criteria for this buyer and document type
    const { data: criteria, error: criteriaError } = await supabase
      .from('document_validation_criteria')
      .select('*')
      .eq('buyer_id', request.buyer_id)
      .eq('document_type', request.document_type)
      .single();

    // If no specific criteria, use default validation
    const validationCriteria = criteria || {
      buyer_id: request.buyer_id,
      document_type: request.document_type,
      criteria: {},
      required_fields: [],
      validation_rules: {},
      auto_approve_threshold: 0.85
    };

    await logAgentActivity(
      'document_analysis_start',
      upload.id,
      'document_upload',
      { document_type: request.document_type, has_criteria: !!criteria }
    );

    // Analyze the document using AI
    const analysis = await analyzeDocument(upload, validationCriteria);

    await logAgentActivity(
      'document_analysis_complete',
      upload.id,
      'document_upload',
      analysis,
      true,
      analysis.compliance_score
    );

    // Make decision based on analysis
    let newStatus = 'pending_review';
    let reviewerNotes = '';

    if (analysis.compliance_score >= validationCriteria.auto_approve_threshold && 
        analysis.recommendation === 'approve') {
      newStatus = 'approved';
      reviewerNotes = `Auto-approved by AI Agent (confidence: ${(analysis.compliance_score * 100).toFixed(1)}%)`;
      
      await logAgentActivity(
        'auto_approve',
        upload.id,
        'document_upload',
        { 
          compliance_score: analysis.compliance_score,
          validation_results: analysis.validation_results
        },
        true,
        analysis.compliance_score
      );

    } else if (analysis.recommendation === 'reject') {
      newStatus = 'rejected';
      reviewerNotes = `Auto-rejected by AI Agent: ${analysis.rejection_reason}`;
      
      await logAgentActivity(
        'auto_reject',
        upload.id,
        'document_upload',
        { 
          compliance_score: analysis.compliance_score,
          rejection_reason: analysis.rejection_reason,
          issues: analysis.issues
        },
        true,
        analysis.compliance_score
      );

      // Send rejection notification to supplier
      await supabase.functions.invoke('send-rejection-notification', {
        body: {
          upload_id: upload.id,
          supplier_id: upload.uploader_id,
          rejection_reason: analysis.rejection_reason,
          issues: analysis.issues,
          suggestions: analysis.issues // AI should provide suggestions
        }
      });

    } else {
      // Manual review required
      reviewerNotes = `AI analysis requires manual review. Compliance score: ${(analysis.compliance_score * 100).toFixed(1)}%. Issues: ${analysis.issues.join(', ')}`;
      
      await logAgentActivity(
        'manual_review_required',
        upload.id,
        'document_upload',
        { 
          compliance_score: analysis.compliance_score,
          issues: analysis.issues
        },
        true,
        analysis.compliance_score
      );
    }

    // Update document status
    const { error: updateError } = await supabase
      .from('document_uploads')
      .update({ 
        status: newStatus, 
        reviewer_notes: reviewerNotes 
      })
      .eq('id', upload.id);

    if (updateError) {
      throw new Error(`Failed to update document status: ${updateError.message}`);
    }

    // Update response time metrics
    if (newStatus === 'approved' || newStatus === 'rejected') {
      const responseTime = Math.floor((new Date().getTime() - new Date(upload.created_at).getTime()) / (1000 * 60 * 60)); // hours
      
      await supabase
        .from('supplier_response_metrics')
        .update({ 
          response_date: new Date().toISOString(),
          response_time_hours: responseTime,
          status: newStatus
        })
        .eq('supplier_id', upload.uploader_id)
        .eq('buyer_id', request.buyer_id);
    }

    console.log(`Processed document ${upload.id}: ${newStatus}`);

  } catch (error) {
    console.error(`Error processing document upload ${upload.id}:`, error);
    await logAgentActivity(
      'process_error',
      upload.id,
      'document_upload',
      { error: error.message },
      false,
      undefined,
      error.message
    );
  }
}

async function generateRejectionFeedback(uploadId: string) {
  try {
    // Get rejection details
    const { data: upload, error } = await supabase
      .from('document_uploads')
      .select(`
        *,
        document_requests!inner(
          document_type,
          suppliers!inner(profile_id, company_name)
        )
      `)
      .eq('id', uploadId)
      .eq('status', 'rejected')
      .single();

    if (error || !upload) {
      throw new Error('Upload not found or not rejected');
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `
    Generate helpful feedback for a rejected document submission:
    
    Document: ${upload.file_name}
    Document Type: ${upload.document_requests.document_type}
    Rejection Reason: ${upload.reviewer_notes}
    
    Provide constructive feedback with:
    1. Clear explanation of issues
    2. Specific steps to fix the problems
    3. Requirements for resubmission
    4. Helpful tips for compliance
    
    Keep it professional and actionable.
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: 'You are a helpful compliance expert providing constructive feedback.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.3
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error('Error generating rejection feedback:', error);
    return 'Please review the document requirements and resubmit with the necessary corrections.';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log('Buyer agent received request:', requestBody);
    
    // Handle both old format ({ action, data }) and new format ({ action, company_id, company_type })
    const { action, data, company_id, company_type } = requestBody;

    // Normalize action and provide sensible defaults
    const normalizedAction = (() => {
      const map: Record<string, string> = {
        process_uploads: 'process_uploads',
        analyze_and_act: 'process_uploads', // legacy alias
        trigger_buyer: 'process_uploads',   // coordinator alias
        process_single: 'process_single',
        generate_feedback: 'generate_feedback',
      };
      if (action && map[action]) return map[action];
      if (!action && company_id && company_type) return 'process_uploads';
      return action;
    })();

    switch (normalizedAction) {
      case 'process_uploads':
        // Build query with optional company filtering
        let uploadsQuery = supabase
          .from('document_uploads')
          .select(`
            *,
            document_requests!inner(
              buyer_id,
              supplier_id,
              document_type
            )
          `)
          .eq('status', 'pending_review')
          .order('created_at', { ascending: true })
          .limit(10);

        // If company_id and company_type are provided, filter by them
        if (company_id && company_type === 'buyer') {
          uploadsQuery = uploadsQuery.eq('document_requests.buyer_id', company_id);
        } else if (company_id && company_type === 'supplier') {
          uploadsQuery = uploadsQuery.eq('document_requests.supplier_id', company_id);
        }

        const { data: uploads, error } = await uploadsQuery;

        console.log(`Found ${uploads?.length || 0} pending uploads for company ${company_id} (${company_type})`);

        if (!error && uploads) {
          for (const upload of uploads) {
            await processDocumentUpload(upload);
          }
        }
        break;

      case 'process_single':
        if (data?.upload_id) {
          const { data: upload, error } = await supabase
            .from('document_uploads')
            .select('*')
            .eq('id', data.upload_id)
            .single();

          if (!error && upload) {
            await processDocumentUpload(upload);
          }
        }
        break;

      case 'generate_feedback':
        if (data?.upload_id) {
          const feedback = await generateRejectionFeedback(data.upload_id);
          return new Response(
            JSON.stringify({ feedback }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
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
        message: `Buyer agent ${normalizedAction} completed successfully`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Buyer agent error:', error);
    
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
        error: error.message,
        action,
        company_id,
        company_type
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});