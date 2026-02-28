import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      console.error('Authentication failed:', userErr);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Document content extraction requested');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { document_id, file_path } = await req.json();

    console.log('Processing document with Vision API');

    // Update processing status
    await supabase
      .from('supplier_document_library')
      .update({ extraction_status: 'processing' })
      .eq('id', document_id);

    // Get document info for context
    const { data: docData } = await supabase
      .from('supplier_document_library')
      .select('supplier_id, document_name, category, description, document_type')
      .eq('id', document_id)
      .single();

    if (!docData) {
      throw new Error('Document not found');
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('compliance-documents')
      .download(file_path);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert file to base64 for Vision API
    const fileBuffer = await fileData.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
    const fileName = file_path.toLowerCase();

    // Determine file type for Vision API
    let mimeType = 'application/pdf';
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    } else if (fileName.endsWith('.png')) {
      mimeType = 'image/png';
    } else if (fileName.endsWith('.pdf')) {
      mimeType = 'application/pdf';
    }

    // Analyze document with OpenAI Vision
    const analysisResult = await analyzeDocumentWithVision(
      base64Data, 
      mimeType, 
      docData.category || 'compliance',
      docData.document_type || 'certificate'
    );

    // Create embeddings for the extracted content
    const embedding = await createEmbedding(analysisResult.extractedText);

    // Update document with enhanced analysis
    const { error: updateError } = await supabase
      .from('supplier_document_library')
      .update({
        extraction_status: 'completed',
        content_extracted: analysisResult.extractedText,
        content_summary: analysisResult.summary,
        ai_suggested_description: analysisResult.enhancedDescription,
        ai_suggested_tags: analysisResult.suggestedTags
      })
      .eq('id', document_id);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    // Store enhanced knowledge entry
    await supabase
      .from('ai_knowledge_entries')
      .upsert({
        company_id: docData.supplier_id,
        company_type: 'supplier',
        entry_type: 'document',
        title: docData.document_name,
        content: analysisResult.extractedText,
        source_reference: document_id,
        embedding: embedding,
        metadata: {
          category: docData.category,
          description: docData.description,
          document_id: document_id,
          summary: analysisResult.summary,
          document_type: analysisResult.documentType,
          key_dates: analysisResult.keyDates,
          entities: analysisResult.entities,
          compliance_standards: analysisResult.complianceStandards,
          risk_flags: analysisResult.riskFlags,
          confidence_score: analysisResult.confidenceScore
        }
      });

    console.log(`Successfully processed document with Vision API: ${document_id}`);

    return new Response(JSON.stringify({
      success: true,
      document_id,
      analysis: {
        summary: analysisResult.summary,
        document_type: analysisResult.documentType,
        confidence_score: analysisResult.confidenceScore,
        key_dates: analysisResult.keyDates,
        entities: analysisResult.entities,
        compliance_standards: analysisResult.complianceStandards,
        risk_flags: analysisResult.riskFlags
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing document:', error);

    // Update status to failed
    try {
      const body = await req.clone().json();
      if (body.document_id) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('supplier_document_library')
          .update({ extraction_status: 'failed' })
          .eq('id', body.document_id);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
    }

    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeDocumentWithVision(
  base64Data: string, 
  mimeType: string, 
  category: string,
  documentType: string
): Promise<{
  summary: string;
  extractedText: string;
  documentType: string;
  keyDates: string[];
  entities: string[];
  complianceStandards: string[];
  riskFlags: string[];
  confidenceScore: number;
  enhancedDescription: string;
  suggestedTags: string[];
}> {
  
  // Create category-specific prompts
  const categoryPrompts = {
    compliance: "This is a compliance document. Focus on certifications, standards, expiration dates, and regulatory requirements.",
    safety: "This is a safety document. Focus on safety protocols, incident reports, training records, and safety certifications.",
    quality: "This is a quality document. Focus on quality standards, test results, specifications, and quality certifications.",
    financial: "This is a financial document. Focus on financial data, audit results, insurance information, and financial compliance.",
    default: "This is a business document. Analyze its content comprehensively."
  };

  const prompt = `${categoryPrompts[category] || categoryPrompts.default}

Please analyze this document and provide a comprehensive analysis in JSON format:

{
  "summary": "A detailed 3-4 sentence summary of the document's main content and purpose",
  "extractedText": "Full text content extracted from the document",
  "documentType": "Specific type of document (e.g., 'ISO 9001 Certificate', 'HACCP Certificate', 'Insurance Policy', 'Safety Training Record')",
  "keyDates": ["Array of important dates found (issue dates, expiration dates, validity periods)"],
  "entities": ["Array of important entities (company names, certificate numbers, reference numbers, contact information)"],
  "complianceStandards": ["Array of compliance standards mentioned (ISO standards, regulatory requirements, certifications)"],
  "riskFlags": ["Array of potential risks or issues (expiring soon, missing information, non-compliance indicators)"],
  "confidenceScore": 0.95,
  "enhancedDescription": "A detailed description of what this document contains and its business purpose",
  "suggestedTags": ["Array of relevant tags for categorization and search"]
}

Focus on accuracy and extract all visible text. Pay special attention to dates, numbers, company names, and certification details.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Vision API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
      // Try to parse as JSON
      const result = JSON.parse(content);
      
      // Validate required fields and provide defaults
      return {
        summary: result.summary || 'Document analysis completed',
        extractedText: result.extractedText || 'Content extracted from document',
        documentType: result.documentType || documentType,
        keyDates: Array.isArray(result.keyDates) ? result.keyDates : [],
        entities: Array.isArray(result.entities) ? result.entities : [],
        complianceStandards: Array.isArray(result.complianceStandards) ? result.complianceStandards : [],
        riskFlags: Array.isArray(result.riskFlags) ? result.riskFlags : [],
        confidenceScore: typeof result.confidenceScore === 'number' ? result.confidenceScore : 0.8,
        enhancedDescription: result.enhancedDescription || result.summary || 'Document processed with Vision API',
        suggestedTags: Array.isArray(result.suggestedTags) ? result.suggestedTags : [category, documentType]
      };
    } catch (parseError) {
      console.error('Failed to parse Vision API response as JSON:', parseError);
      
      // Fallback: extract summary from text response
      return {
        summary: content.substring(0, 500) + '...',
        extractedText: content,
        documentType: documentType,
        keyDates: [],
        entities: [],
        complianceStandards: [],
        riskFlags: [],
        confidenceScore: 0.6,
        enhancedDescription: 'Document analyzed with Vision API',
        suggestedTags: [category, documentType]
      };
    }

  } catch (error) {
    console.error('Vision API analysis error:', error);
    throw new Error(`Failed to analyze document with Vision API: ${error.message}`);
  }
}

async function createEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text.substring(0, 8000), // Limit text length for embedding
      model: 'text-embedding-3-small',
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// This function is now replaced by analyzeDocumentWithVision above
// Keeping createEmbedding function as it's still needed