import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://edwerzutsknhuplidhsj.supabase.co';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

interface ProcessorRequest {
  document_upload_id: string;
  buyer_id: string;
}

interface AnalysisResult {
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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
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

    const { document_upload_id, buyer_id }: ProcessorRequest = await req.json();

    console.log(`Processing buyer document content: upload=${document_upload_id}, buyer=${buyer_id}`);

    if (!document_upload_id || !buyer_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: document_upload_id and buyer_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update extraction status to processing
    await supabase
      .from('document_uploads')
      .update({ content_extraction_status: 'processing' })
      .eq('id', document_upload_id);

    // Get document upload details with request info
    const { data: upload, error: uploadError } = await supabase
      .from('document_uploads')
      .select(`
        *,
        document_requests!inner(
          id,
          buyer_id,
          supplier_id,
          document_type,
          category,
          title,
          description
        )
      `)
      .eq('id', document_upload_id)
      .single();

    if (uploadError || !upload) {
      throw new Error(`Document upload not found: ${uploadError?.message}`);
    }

    // Validate buyer_id matches
    if (upload.document_requests.buyer_id !== buyer_id) {
      throw new Error('Buyer ID mismatch');
    }

    // Get supplier details
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('id, company_name, industry')
      .eq('id', upload.document_requests.supplier_id)
      .single();

    const supplierName = supplier?.company_name || 'Unknown Supplier';
    const supplierIndustry = supplier?.industry || 'General';
    const year = new Date().getFullYear();

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('compliance-documents')
      .download(upload.file_path);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert file to base64 for Vision API
    const fileBuffer = await fileData.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
    const fileName = upload.file_path.toLowerCase();

    // Determine file type for Vision API
    let mimeType = 'application/pdf';
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    } else if (fileName.endsWith('.png')) {
      mimeType = 'image/png';
    } else if (fileName.endsWith('.pdf')) {
      mimeType = 'application/pdf';
    }

    // Analyze document with Vision API
    const analysis = await analyzeDocumentWithVision(
      base64Data,
      mimeType,
      upload.document_requests.category || 'compliance',
      upload.document_requests.document_type || 'certificate'
    );

    // Create embedding for the extracted content
    const embedding = await createEmbedding(analysis.extractedText);

    // Generate relevance tags
    const relevanceTags = generateRelevanceTags(
      upload.document_requests.document_type,
      supplierIndustry,
      year,
      analysis.complianceStandards
    );

    // Store in ai_knowledge_entries with buyer context
    // CRITICAL: Use buyer_id and company_type = 'buyer' for proper RBAC
    const knowledgeEntry = {
      company_id: buyer_id,
      company_type: 'buyer',
      entry_type: 'buyer_document_content',
      title: `${upload.document_requests.document_type} - ${supplierName} (${year})`,
      content: analysis.extractedText,
      embedding: `[${embedding.join(',')}]`,
      source_reference: `buyer_upload:${document_upload_id}`,
      relevance_tags: relevanceTags,
      metadata: {
        document_upload_id: document_upload_id,
        document_request_id: upload.request_id,
        supplier_id: upload.document_requests.supplier_id,
        supplier_name: supplierName,
        document_type: upload.document_requests.document_type,
        category: upload.document_requests.category,
        year: year,
        expiration_date: upload.expiration_date,
        approval_date: new Date().toISOString(),
        summary: analysis.summary,
        key_dates: analysis.keyDates,
        entities: analysis.entities,
        compliance_standards: analysis.complianceStandards,
        risk_flags: analysis.riskFlags,
        confidence_score: analysis.confidenceScore,
        file_name: upload.file_name
      }
    };

    // Upsert to prevent duplicates
    const { error: knowledgeError } = await supabase
      .from('ai_knowledge_entries')
      .upsert(knowledgeEntry, {
        onConflict: 'source_reference'
      });

    if (knowledgeError) {
      console.error('Failed to insert knowledge entry:', knowledgeError);
      // Don't throw - log the error but continue to update document status
    }

    // Update document upload with extraction results
    const { error: updateError } = await supabase
      .from('document_uploads')
      .update({
        content_extraction_status: 'completed',
        content_extracted_at: new Date().toISOString(),
        content_summary: analysis.summary
      })
      .eq('id', document_upload_id);

    if (updateError) {
      console.error('Failed to update document upload:', updateError);
    }

    // Log agent activity
    await supabase
      .from('agent_activities')
      .insert({
        agent_type: 'buyer',
        action_type: 'buyer_document_content_extracted',
        entity_id: document_upload_id,
        entity_type: 'document_upload',
        details: {
          buyer_id,
          supplier_id: upload.document_requests.supplier_id,
          supplier_name: supplierName,
          document_type: upload.document_requests.document_type,
          confidence_score: analysis.confidenceScore,
          extracted_length: analysis.extractedText.length
        },
        success: true,
        confidence_score: analysis.confidenceScore
      });

    console.log(`Successfully processed buyer document content: ${document_upload_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        document_upload_id,
        buyer_id,
        analysis: {
          summary: analysis.summary,
          document_type: analysis.documentType,
          confidence_score: analysis.confidenceScore,
          key_dates_count: analysis.keyDates.length,
          entities_count: analysis.entities.length,
          compliance_standards: analysis.complianceStandards
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing buyer document content:', error);

    // Update status to failed
    try {
      const body = await req.clone().json();
      if (body.document_upload_id) {
        await supabase
          .from('document_uploads')
          .update({ content_extraction_status: 'failed' })
          .eq('id', body.document_upload_id);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function analyzeDocumentWithVision(
  base64Data: string,
  mimeType: string,
  category: string,
  documentType: string
): Promise<AnalysisResult> {
  const categoryPrompts: Record<string, string> = {
    compliance: "This is a compliance document. Focus on certifications, standards, expiration dates, and regulatory requirements.",
    safety: "This is a safety document. Focus on safety protocols, incident reports, training records, and safety certifications.",
    quality: "This is a quality document. Focus on quality standards, test results, specifications, and quality certifications.",
    financial: "This is a financial document. Focus on financial data, audit results, insurance information, and financial compliance.",
    legal: "This is a legal document. Focus on contracts, agreements, terms, and legal requirements.",
    default: "This is a business document. Analyze its content comprehensively."
  };

  const prompt = `${categoryPrompts[category] || categoryPrompts.default}

Please analyze this document and provide a comprehensive analysis in JSON format:

{
  "summary": "A detailed 3-4 sentence summary of the document's main content and purpose. Focus on what a buyer would need to know about this supplier's compliance.",
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

Focus on accuracy and extract all visible text. Pay special attention to dates, numbers, company names, and certification details. This document is being submitted by a supplier to a buyer for compliance verification.`;

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
              { type: 'text', text: prompt },
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
      const errorText = await response.text();
      throw new Error(`OpenAI Vision API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      const result = JSON.parse(jsonStr);

      return {
        summary: result.summary || 'Document analysis completed',
        extractedText: result.extractedText || 'Content extracted from document',
        documentType: result.documentType || documentType,
        keyDates: Array.isArray(result.keyDates) ? result.keyDates : [],
        entities: Array.isArray(result.entities) ? result.entities : [],
        complianceStandards: Array.isArray(result.complianceStandards) ? result.complianceStandards : [],
        riskFlags: Array.isArray(result.riskFlags) ? result.riskFlags : [],
        confidenceScore: typeof result.confidenceScore === 'number' ? result.confidenceScore : 0.8,
        enhancedDescription: result.enhancedDescription || result.summary || 'Document processed',
        suggestedTags: Array.isArray(result.suggestedTags) ? result.suggestedTags : [category, documentType]
      };
    } catch (parseError) {
      console.error('Failed to parse Vision API response as JSON:', parseError);
      
      return {
        summary: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
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
    throw new Error(`Failed to analyze document: ${error.message}`);
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
      input: text.substring(0, 8000),
      model: 'text-embedding-3-small',
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI Embedding API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

function generateRelevanceTags(
  documentType: string,
  industry: string,
  year: number,
  complianceStandards: string[]
): string[] {
  const tags: string[] = [];

  // Add document type keywords
  if (documentType) {
    tags.push(...documentType.toLowerCase().split(/[\s-]+/).filter(t => t.length > 2));
  }

  // Add industry
  if (industry) {
    tags.push(industry.toLowerCase());
  }

  // Add year
  tags.push(year.toString());

  // Add compliance standards (lowercased)
  if (complianceStandards.length > 0) {
    tags.push(...complianceStandards.map(s => s.toLowerCase().replace(/[^a-z0-9]/g, '')));
  }

  // Remove duplicates and return
  return [...new Set(tags)];
}
