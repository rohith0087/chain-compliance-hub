import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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

async function analyzeDocument(upload: DocumentUpload, criteria: ValidationCriteria) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Get buyer details for validation
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

  const buyer = request.buyers;

  const prompt = `
  Analyze this document submission for compliance validation:
  
  Document: ${upload.file_name}
  Document Type: ${request.document_type}
  Expiration Date: ${upload.expiration_date}
  
  Buyer Requirements:
  - Company Name: ${buyer.company_name}
  - Email: ${buyer.contact_email}
  - Address: ${buyer.address || 'Not specified'}
  
  Validation Criteria:
  ${JSON.stringify(criteria.criteria, null, 2)}
  
  Required Fields: ${criteria.required_fields?.join(', ') || 'None specified'}
  
  Validation Rules:
  ${JSON.stringify(criteria.validation_rules, null, 2)}
  
  Based on the filename and provided information, analyze:
  1. Does the document type match the request?
  2. Is the expiration date acceptable (future date)?
  3. Does it likely contain the required fields?
  4. Any compliance concerns?
  
  Return JSON:
  {
    "compliance_score": 0.0-1.0,
    "validation_results": {
      "document_type_match": boolean,
      "expiration_valid": boolean,
      "required_fields_likely": boolean,
      "company_match_likely": boolean
    },
    "recommendation": "approve" | "reject" | "manual_review",
    "issues": ["array of issues found"],
    "rejection_reason": "specific reason if recommend reject"
  }
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
        { role: 'system', content: 'You are a document compliance expert. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.2
    }),
  });

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
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
    const { action, data } = await req.json();

    switch (action) {
      case 'process_uploads':
        // Get pending document uploads
        const { data: uploads, error } = await supabase
          .from('document_uploads')
          .select('*')
          .eq('status', 'pending_review')
          .order('created_at', { ascending: true })
          .limit(10);

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
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Buyer agent error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});