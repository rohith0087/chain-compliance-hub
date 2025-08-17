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

async function analyzeDocumentMatch(requestType: string, existingDocs: ExistingDocument[]) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = `
  Analyze if any of these existing documents match the requested document type: "${requestType}"
  
  Existing documents:
  ${existingDocs.map(doc => `- ${doc.file_name} (expires: ${doc.expiration_date})`).join('\n')}
  
  Return a JSON response with:
  {
    "bestMatch": {
      "documentId": "id of best matching document or null",
      "confidence": 0.0-1.0,
      "reasoning": "explanation"
    },
    "isExpired": boolean,
    "recommendations": ["array of recommendations"]
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
        { role: 'system', content: 'You are a document matching expert. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.3
    }),
  });

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
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

    // Use AI to analyze document matches
    const analysis = await analyzeDocumentMatch(request.document_type, existingDocs);
    
    await logAgentActivity(
      'document_analysis',
      request.id,
      'document_request',
      analysis,
      true,
      analysis.bestMatch.confidence
    );

    if (analysis.bestMatch.confidence > 0.7 && !analysis.isExpired) {
      // Auto-submit the matching document
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
            'auto_submit',
            request.id,
            'document_request',
            { 
              submitted_document: matchingDoc.id, 
              confidence: analysis.bestMatch.confidence,
              reasoning: analysis.bestMatch.reasoning
            },
            true,
            analysis.bestMatch.confidence
          );

          // Update request status
          await supabase
            .from('document_requests')
            .update({ status: 'submitted' })
            .eq('id', request.id);

          console.log(`Auto-submitted document for request ${request.id}`);
        }
      }
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

async function checkExpiringDocuments() {
  try {
    console.log('Checking for expiring documents...');

    // Find documents expiring in the next 30-60 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

    const { data: expiringDocs, error } = await supabase
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();

    switch (action) {
      case 'process_requests':
        // Get pending document requests for suppliers
        const { data: requests, error } = await supabase
          .from('document_requests')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(10);

        if (!error && requests) {
          for (const request of requests) {
            await processDocumentRequest(request);
          }
        }
        break;

      case 'check_expiring':
        await checkExpiringDocuments();
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
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Supplier agent error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});