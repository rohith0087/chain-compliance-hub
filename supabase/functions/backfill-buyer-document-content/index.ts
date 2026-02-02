import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import * as pdfjs from 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://edwerzutsknhuplidhsj.supabase.co';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

interface BackfillRequest {
  buyer_ids?: string[];
  exclude_demo?: boolean;
  dry_run?: boolean;
  batch_size?: number;
  document_upload_id?: string;
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

const DEMO_PATTERNS = ['test', 'demo', 'sample', 'example', 'dummy'];

// ============ UTILITY FUNCTIONS ============

/**
 * Convert ArrayBuffer to base64 safely (handles large files without stack overflow)
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32768; // Process in 32KB chunks to avoid stack overflow
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Detect MIME type from file path
 */
function detectMimeType(filePath: string, providedMime?: string): string {
  const ext = filePath.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return providedMime || 'application/octet-stream';
  }
}

/**
 * Check if MIME type is an image that Vision API accepts
 */
function isVisionCompatibleImage(mimeType: string): boolean {
  return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType);
}

// ============ PDF PROCESSING ============

/**
 * Extract text from PDF using pdfjs
 */
async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<{ text: string; pageCount: number }> {
  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    let fullText = '';

    // Process up to 10 pages for text extraction
    const maxPages = Math.min(pageCount, 10);
    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        fullText += pageText + '\n\n';
      } catch (pageError) {
        console.warn(`Failed to extract text from page ${i}:`, pageError);
      }
    }

    return { text: fullText.trim(), pageCount };
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    return { text: '', pageCount: 0 };
  }
}

// ============ VISION API FUNCTIONS ============

/**
 * Analyze image directly with Vision API
 */
async function analyzeImageWithVision(
  base64Data: string,
  mimeType: string,
  category: string,
  documentType: string
): Promise<AnalysisResult> {
  const prompt = buildAnalysisPrompt(category, documentType);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
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
      }],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Vision API error: ${response.status} - ${errorText}`);
  }

  return parseVisionResponse(await response.json(), category, documentType);
}

/**
 * Analyze text content with GPT-4 (for native PDFs with extractable text)
 */
async function analyzeTextContent(
  text: string,
  category: string,
  documentType: string
): Promise<AnalysisResult> {
  const prompt = buildAnalysisPrompt(category, documentType);
  const truncatedText = text.substring(0, 12000); // Limit text length

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You analyze compliance documents and extract structured information.' },
        { role: 'user', content: `${prompt}\n\nDocument content:\n${truncatedText}` }
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  return parseVisionResponse(await response.json(), category, documentType);
}

/**
 * Build the analysis prompt based on category
 */
function buildAnalysisPrompt(category: string, documentType: string): string {
  const categoryPrompts: Record<string, string> = {
    compliance: "This is a compliance document. Focus on certifications, standards, expiration dates, and regulatory requirements.",
    safety: "This is a safety document. Focus on safety protocols, incident reports, training records, and safety certifications.",
    quality: "This is a quality document. Focus on quality standards, test results, specifications, and quality certifications.",
    financial: "This is a financial document. Focus on financial data, audit results, insurance information, and financial compliance.",
    legal: "This is a legal document. Focus on contracts, agreements, terms, and legal requirements.",
    default: "This is a business document. Analyze its content comprehensively."
  };

  return `${categoryPrompts[category] || categoryPrompts.default}

Please analyze this document and provide a comprehensive analysis in JSON format:

{
  "summary": "A detailed 3-4 sentence summary of the document's main content and purpose. Focus on what a buyer would need to know about this supplier's compliance.",
  "extractedText": "Full text content extracted from the document",
  "documentType": "Specific type of document (e.g., 'ISO 9001 Certificate', 'HACCP Certificate', 'Insurance Policy')",
  "keyDates": ["Array of important dates found (issue dates, expiration dates, validity periods)"],
  "entities": ["Array of important entities (company names, certificate numbers, reference numbers)"],
  "complianceStandards": ["Array of compliance standards mentioned (ISO standards, regulatory requirements, certifications)"],
  "riskFlags": ["Array of potential risks or issues (expiring soon, missing information, non-compliance indicators)"],
  "confidenceScore": 0.95,
  "enhancedDescription": "A detailed description of what this document contains and its business purpose",
  "suggestedTags": ["Array of relevant tags for categorization and search"]
}

Focus on accuracy and extract all visible text. Pay special attention to dates, numbers, company names, and certification details.`;
}

/**
 * Parse Vision/GPT API response into AnalysisResult
 */
function parseVisionResponse(data: any, category: string, documentType: string): AnalysisResult {
  const content = data.choices?.[0]?.message?.content || '';

  try {
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
    console.error('Failed to parse API response as JSON:', parseError);
    return {
      summary: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      extractedText: content,
      documentType: documentType,
      keyDates: [],
      entities: [],
      complianceStandards: [],
      riskFlags: [],
      confidenceScore: 0.6,
      enhancedDescription: 'Document analyzed',
      suggestedTags: [category, documentType]
    };
  }
}

// ============ INTELLIGENT DOCUMENT PROCESSING ============

/**
 * Main intelligent processing function that routes based on file type
 */
async function processDocumentIntelligent(
  supabase: any,
  fileBuffer: ArrayBuffer,
  filePath: string,
  category: string,
  documentType: string,
  providedMime?: string
): Promise<AnalysisResult> {
  const mimeType = detectMimeType(filePath, providedMime);
  console.log(`Processing file: ${filePath}, detected MIME: ${mimeType}`);

  // Route 1: Direct image files - send to Vision API directly
  if (isVisionCompatibleImage(mimeType)) {
    console.log('Route: Direct Vision API (image file)');
    const base64Data = arrayBufferToBase64(fileBuffer);
    return await analyzeImageWithVision(base64Data, mimeType, category, documentType);
  }

  // Route 2: PDF files - try text extraction first
  if (mimeType === 'application/pdf') {
    console.log('Route: PDF processing');
    
    // Step 1: Try to extract text from PDF
    const { text, pageCount } = await extractPdfText(fileBuffer);
    console.log(`PDF has ${pageCount} pages, extracted ${text.length} chars of text`);

    // Step 2: If we got meaningful text (>100 chars), use text-based analysis (cheaper)
    if (text.length > 100) {
      console.log('PDF has extractable text - using text-based analysis');
      return await analyzeTextContent(text, category, documentType);
    }

    // Step 3: PDF is likely scanned/image-based - try Vision API with PDF
    // Note: GPT-4o can actually handle some PDFs directly
    console.log('PDF appears to be scanned/image-based - attempting Vision API');
    try {
      const base64Data = arrayBufferToBase64(fileBuffer);
      // Try with application/pdf first - GPT-4o sometimes handles it
      return await analyzeImageWithVision(base64Data, 'application/pdf', category, documentType);
    } catch (visionError: any) {
      // If Vision API rejects PDF, return a partial result with extracted text info
      console.error('Vision API cannot process this PDF:', visionError.message);
      
      // Return a basic result indicating the file couldn't be fully processed
      return {
        summary: `PDF document with ${pageCount} pages. Unable to extract text content - document appears to be scanned images. Manual review recommended.`,
        extractedText: text || 'No text could be extracted from this scanned PDF.',
        documentType: documentType,
        keyDates: [],
        entities: [],
        complianceStandards: [],
        riskFlags: ['Scanned PDF - limited text extraction'],
        confidenceScore: 0.3,
        enhancedDescription: 'This PDF contains scanned images and could not be fully analyzed automatically.',
        suggestedTags: [category, documentType, 'scanned', 'needs-review']
      };
    }
  }

  // Route 3: DOCX files - extract text directly
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    console.log('Route: DOCX text extraction');
    try {
      // For DOCX, we'll try to extract basic text content
      // Note: Full DOCX parsing would require additional libraries
      const textDecoder = new TextDecoder('utf-8');
      const rawContent = textDecoder.decode(fileBuffer);
      
      // DOCX is actually a ZIP file - try to get some content
      // This is a simplified extraction
      if (rawContent.length > 100) {
        // Extract any readable text patterns
        const cleanText = rawContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanText.length > 50) {
          return await analyzeTextContent(cleanText.substring(0, 8000), category, documentType);
        }
      }
      
      return {
        summary: 'Word document uploaded. Content extraction requires manual review.',
        extractedText: 'DOCX file - automated extraction limited',
        documentType: documentType,
        keyDates: [],
        entities: [],
        complianceStandards: [],
        riskFlags: ['Word document - manual review recommended'],
        confidenceScore: 0.4,
        enhancedDescription: 'This is a Microsoft Word document that may require manual review for full content extraction.',
        suggestedTags: [category, documentType, 'word-document']
      };
    } catch (docxError) {
      console.error('DOCX extraction failed:', docxError);
      throw new Error('Failed to process Word document');
    }
  }

  // Route 4: Unsupported file type
  throw new Error(`Unsupported file type: ${mimeType}. Supported types: PDF, JPEG, PNG, GIF, WebP, DOCX`);
}

// ============ EMBEDDING & TAGS ============

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

  if (documentType) {
    tags.push(...documentType.toLowerCase().split(/[\s-]+/).filter(t => t.length > 2));
  }

  if (industry) {
    tags.push(industry.toLowerCase());
  }

  tags.push(year.toString());

  if (complianceStandards.length > 0) {
    tags.push(...complianceStandards.map(s => s.toLowerCase().replace(/[^a-z0-9]/g, '')));
  }

  return [...new Set(tags)];
}

// ============ DOCUMENT PROCESSING ============

async function processDocument(supabase: any, doc: any): Promise<AnalysisResult> {
  const documentUploadId = doc.id;
  const buyerId = doc.document_requests.buyer_id;

  // Update status to processing
  await supabase
    .from('document_uploads')
    .update({ content_extraction_status: 'processing' })
    .eq('id', documentUploadId);

  try {
    // Get supplier details
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('id, company_name, industry')
      .eq('id', doc.document_requests.supplier_id)
      .single();

    const supplierName = supplier?.company_name || 'Unknown Supplier';
    const supplierIndustry = supplier?.industry || 'General';
    const year = new Date().getFullYear();

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('compliance-documents')
      .download(doc.file_path);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Get file buffer
    const fileBuffer = await fileData.arrayBuffer();

    // Use intelligent processing pipeline
    const analysis = await processDocumentIntelligent(
      supabase,
      fileBuffer,
      doc.file_path,
      doc.document_requests.category || 'compliance',
      doc.document_requests.document_type || 'certificate',
      doc.mime_type
    );

    // Create embedding for the extracted content
    const embedding = await createEmbedding(analysis.extractedText);

    // Generate relevance tags
    const relevanceTags = generateRelevanceTags(
      doc.document_requests.document_type,
      supplierIndustry,
      year,
      analysis.complianceStandards
    );

    // Store in ai_knowledge_entries
    const knowledgeEntry = {
      company_id: buyerId,
      company_type: 'buyer',
      entry_type: 'buyer_document_content',
      title: `${doc.document_requests.document_type} - ${supplierName} (${year})`,
      content: analysis.extractedText,
      embedding: `[${embedding.join(',')}]`,
      source_reference: `buyer_upload:${documentUploadId}`,
      relevance_tags: relevanceTags,
      metadata: {
        document_upload_id: documentUploadId,
        document_request_id: doc.request_id,
        supplier_id: doc.document_requests.supplier_id,
        supplier_name: supplierName,
        document_type: doc.document_requests.document_type,
        category: doc.document_requests.category,
        year: year,
        summary: analysis.summary,
        key_dates: analysis.keyDates,
        entities: analysis.entities,
        compliance_standards: analysis.complianceStandards,
        risk_flags: analysis.riskFlags,
        confidence_score: analysis.confidenceScore,
        file_name: doc.file_name,
        backfilled: true,
        backfill_date: new Date().toISOString()
      }
    };

    // Upsert to prevent duplicates
    await supabase
      .from('ai_knowledge_entries')
      .upsert(knowledgeEntry, { onConflict: 'source_reference' });

    // Update document upload with extraction results
    await supabase
      .from('document_uploads')
      .update({
        content_extraction_status: 'completed',
        content_extracted_at: new Date().toISOString(),
        content_summary: analysis.summary
      })
      .eq('id', documentUploadId);

    // Log activity
    await supabase
      .from('agent_activities')
      .insert({
        agent_type: 'buyer',
        action_type: 'buyer_document_content_backfilled',
        entity_id: documentUploadId,
        entity_type: 'document_upload',
        details: {
          buyer_id: buyerId,
          supplier_name: supplierName,
          document_type: doc.document_requests.document_type,
          confidence_score: analysis.confidenceScore,
          backfilled: true
        },
        success: true,
        confidence_score: analysis.confidenceScore
      });

    return analysis;
  } catch (error) {
    // Update status to failed
    await supabase
      .from('document_uploads')
      .update({ content_extraction_status: 'failed' })
      .eq('id', documentUploadId);

    throw error;
  }
}

async function processSingleDocument(supabase: any, documentUploadId: string) {
  const { data: doc, error } = await supabase
    .from('document_uploads')
    .select(`
      id,
      file_name,
      file_path,
      mime_type,
      status,
      content_extraction_status,
      request_id,
      document_requests!inner(
        id,
        buyer_id,
        supplier_id,
        document_type,
        category,
        title
      )
    `)
    .eq('id', documentUploadId)
    .single();

  if (error || !doc) {
    throw new Error(`Document not found: ${error?.message || 'Unknown'}`);
  }

  if (doc.status !== 'approved') {
    throw new Error('Document is not approved');
  }

  const result = await processDocument(supabase, doc);
  return {
    success: true,
    document_upload_id: documentUploadId,
    summary: result.summary
  };
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Validate authentication - platform admin required
    const authHeader = req.headers.get('Authorization') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is platform admin
    const { data: adminRecord } = await supabase
      .from('platform_administrators')
      .select('id, is_active, platform_roles')
      .eq('auth_user_id', userData.user.id)
      .eq('is_active', true)
      .single();

    if (!adminRecord) {
      return new Response(
        JSON.stringify({ error: 'Platform admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      buyer_ids = [], 
      exclude_demo = true, 
      dry_run = false, 
      batch_size = 5,
      document_upload_id 
    }: BackfillRequest = await req.json();

    console.log(`Backfill request: buyer_ids=${buyer_ids.length}, exclude_demo=${exclude_demo}, dry_run=${dry_run}, batch_size=${batch_size}, single_doc=${document_upload_id}`);

    // If processing a single document
    if (document_upload_id) {
      const result = await processSingleDocument(supabase, document_upload_id);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get buyers to process
    let buyersQuery = supabase.from('buyers').select('id, company_name');
    
    if (buyer_ids.length > 0) {
      buyersQuery = buyersQuery.in('id', buyer_ids);
    }

    const { data: buyers, error: buyersError } = await buyersQuery;
    if (buyersError) throw buyersError;

    // Filter out demo buyers if requested
    const filteredBuyers = exclude_demo 
      ? buyers?.filter(b => !DEMO_PATTERNS.some(p => 
          b.company_name.toLowerCase().includes(p)
        )) || []
      : buyers || [];

    const buyerIdList = filteredBuyers.map(b => b.id);
    
    console.log(`Processing ${buyerIdList.length} buyers (excluded ${(buyers?.length || 0) - filteredBuyers.length} demo buyers)`);

    // Get pending documents for these buyers
    const { data: pendingDocs, error: docsError } = await supabase
      .from('document_uploads')
      .select(`
        id,
        file_name,
        file_path,
        mime_type,
        status,
        content_extraction_status,
        request_id,
        document_requests!inner(
          id,
          buyer_id,
          supplier_id,
          document_type,
          category,
          title
        )
      `)
      .eq('status', 'approved')
      .in('content_extraction_status', ['pending', null])
      .in('document_requests.buyer_id', buyerIdList);

    if (docsError) throw docsError;

    // Group by buyer for reporting
    const buyerSummary: Record<string, { 
      company_name: string; 
      pending: number; 
      processed: number;
      documents: { id: string; name: string }[];
    }> = {};

    for (const buyer of filteredBuyers) {
      const buyerDocs = pendingDocs?.filter(d => d.document_requests.buyer_id === buyer.id) || [];
      buyerSummary[buyer.id] = {
        company_name: buyer.company_name,
        pending: buyerDocs.length,
        processed: 0,
        documents: buyerDocs.map(d => ({ id: d.id, name: d.file_name }))
      };
    }

    const totalPending = pendingDocs?.length || 0;
    console.log(`Found ${totalPending} pending documents across ${buyerIdList.length} buyers`);

    if (dry_run) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          total_pending: totalPending,
          buyers_count: buyerIdList.length,
          buyer_summary: buyerSummary,
          excluded_demo_count: (buyers?.length || 0) - filteredBuyers.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process batch
    const docsToProcess = pendingDocs?.slice(0, batch_size) || [];
    let processed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const doc of docsToProcess) {
      try {
        console.log(`Processing document ${doc.id}: ${doc.file_name}`);
        
        const result = await processDocument(supabase, doc);
        results.push({ 
          id: doc.id, 
          success: true, 
          summary_preview: result.summary?.substring(0, 100) + '...',
          confidence: result.confidenceScore
        });
        processed++;
        
        // Update buyer summary
        const buyerId = doc.document_requests.buyer_id;
        if (buyerSummary[buyerId]) {
          buyerSummary[buyerId].processed++;
          buyerSummary[buyerId].pending--;
        }

        // Rate limiting - wait 2 seconds between documents
        if (docsToProcess.indexOf(doc) < docsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`Failed to process document ${doc.id}:`, error);
        results.push({ id: doc.id, success: false, error: error.message });
        failed++;
      }
    }

    const remaining = totalPending - processed;

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        remaining,
        total_pending: totalPending,
        batch_size,
        results,
        buyer_summary: buyerSummary
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
