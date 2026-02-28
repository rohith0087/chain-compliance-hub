import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://edwerzutsknhuplidhsj.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openAIApiKey = Deno.env.get("OPENAI_API_KEY")!;

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

const DEMO_PATTERNS = ["test", "demo", "sample", "example", "dummy"];

// ============ UTILITY FUNCTIONS ============

/**
 * Convert ArrayBuffer to base64 safely (handles large files without stack overflow)
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
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
  const ext = filePath.toLowerCase().split(".").pop();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return providedMime || "application/octet-stream";
  }
}

/**
 * Check if MIME type is an image that Vision API accepts
 */
function isVisionCompatibleImage(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType);
}

// ============ PDF PROCESSING ============

/**
 * Extract text from PDF using unpdf (Deno-compatible)
 */
async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<{ text: string; pageCount: number }> {
  try {
    console.log("Starting PDF text extraction with unpdf...");
    
    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const pageCount = pdf.numPages;
    console.log(`PDF loaded successfully: ${pageCount} pages`);

    let fullText = "";

    // Process up to 10 pages for text extraction
    const maxPages = Math.min(pageCount, 10);
    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str || "").join(" ");
        fullText += pageText + "\n\n";
      } catch (pageError) {
        console.warn(`Failed to extract text from page ${i}:`, pageError);
      }
    }

    return { text: fullText.trim(), pageCount };
  } catch (error) {
    console.error("PDF text extraction failed:", error);
    return { text: "", pageCount: 0 };
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
  documentType: string,
): Promise<AnalysisResult> {
  const prompt = buildAnalysisPrompt(category, documentType);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
                detail: "high",
              },
            },
          ],
        },
      ],
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
 * Analyze multiple page images with Vision API
 */
async function analyzeMultiPageWithVision(
  pageImages: string[],
  category: string,
  documentType: string,
): Promise<AnalysisResult> {
  const prompt = buildAnalysisPrompt(category, documentType);

  const imageContent = pageImages.map((img) => ({
    type: "image_url",
    image_url: {
      url: `data:image/png;base64,${img}`,
      detail: "high",
    },
  }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: `This is a ${pageImages.length}-page document. ${prompt}` }, ...imageContent],
        },
      ],
      max_tokens: 3000,
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
async function analyzeTextContent(text: string, category: string, documentType: string): Promise<AnalysisResult> {
  const prompt = buildAnalysisPrompt(category, documentType);
  const truncatedText = text.substring(0, 12000); // Limit text length

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You analyze compliance documents and extract structured information." },
        { role: "user", content: `${prompt}\n\nDocument content:\n${truncatedText}` },
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
    compliance:
      "This is a compliance document. Focus on certifications, standards, expiration dates, and regulatory requirements.",
    safety:
      "This is a safety document. Focus on safety protocols, incident reports, training records, and safety certifications.",
    quality:
      "This is a quality document. Focus on quality standards, test results, specifications, and quality certifications.",
    financial:
      "This is a financial document. Focus on financial data, audit results, insurance information, and financial compliance.",
    legal: "This is a legal document. Focus on contracts, agreements, terms, and legal requirements.",
    default: "This is a business document. Analyze its content comprehensively.",
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
  const content = data.choices?.[0]?.message?.content || "";

  try {
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    const result = JSON.parse(jsonStr);

    return {
      summary: result.summary || "Document analysis completed",
      extractedText: result.extractedText || "Content extracted from document",
      documentType: result.documentType || documentType,
      keyDates: Array.isArray(result.keyDates) ? result.keyDates : [],
      entities: Array.isArray(result.entities) ? result.entities : [],
      complianceStandards: Array.isArray(result.complianceStandards) ? result.complianceStandards : [],
      riskFlags: Array.isArray(result.riskFlags) ? result.riskFlags : [],
      confidenceScore: typeof result.confidenceScore === "number" ? result.confidenceScore : 0.8,
      enhancedDescription: result.enhancedDescription || result.summary || "Document processed",
      suggestedTags: Array.isArray(result.suggestedTags) ? result.suggestedTags : [category, documentType],
    };
  } catch (parseError) {
    console.error("Failed to parse API response as JSON:", parseError);
    
    // Check if the AI apologized (indicates it couldn't read the content)
    const isApology = content.toLowerCase().includes("i'm sorry") || 
                      content.toLowerCase().includes("not in a readable format") ||
                      content.toLowerCase().includes("cannot be directly analyzed") ||
                      content.toLowerCase().includes("cannot analyze");
    
    if (isApology) {
      return {
        summary: "We were unable to extract content from this document. The file format may not be fully supported or the document may require manual review.",
        extractedText: "Content extraction was not successful",
        documentType: documentType,
        keyDates: [],
        entities: [],
        complianceStandards: [],
        riskFlags: ["Content extraction failed"],
        confidenceScore: 0.2,
        enhancedDescription: "Document analysis encountered an issue. Please verify the file is not corrupted and try again, or contact support for assistance.",
        suggestedTags: [category, documentType, "needs-review"],
      };
    }
    
    return {
      summary: content.substring(0, 500) + (content.length > 500 ? "..." : ""),
      extractedText: content,
      documentType: documentType,
      keyDates: [],
      entities: [],
      complianceStandards: [],
      riskFlags: [],
      confidenceScore: 0.6,
      enhancedDescription: "Document analyzed",
      suggestedTags: [category, documentType],
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
  providedMime?: string,
): Promise<AnalysisResult> {
  const mimeType = detectMimeType(filePath, providedMime);
  console.log(`Processing file: ${filePath}, detected MIME: ${mimeType}`);

  // Route 1: Direct image files - send to Vision API directly
  if (isVisionCompatibleImage(mimeType)) {
    console.log("Route: Direct Vision API (image file)");
    const base64Data = arrayBufferToBase64(fileBuffer);
    return await analyzeImageWithVision(base64Data, mimeType, category, documentType);
  }

  // Route 2: PDF files - try text extraction first
  if (mimeType === "application/pdf") {
    console.log("Route: PDF processing pipeline");

    // Step 1: Try to extract text from PDF
    const { text, pageCount } = await extractPdfText(fileBuffer);
    console.log(`PDF has ${pageCount} pages, extracted ${text.length} chars of text`);

    // Step 2: If we got meaningful text (>100 chars), use text-based analysis (cheaper)
    if (text.length > 100) {
      console.log("PDF has extractable text - using text-based analysis");
      return await analyzeTextContent(text, category, documentType);
    }

    // Step 3: PDF has no extractable text - it's likely a scanned document
    console.log("PDF appears to be scanned - text extraction found minimal content");

    return {
      summary: `PDF document with ${pageCount > 0 ? pageCount : "unknown"} pages. Automated text extraction found limited content (${text.length} characters). This may be a scanned or image-based PDF.`,
      extractedText: text || "Unable to extract text from this PDF",
      documentType: documentType,
      keyDates: [],
      entities: [],
      complianceStandards: [],
      riskFlags: [],
      confidenceScore: 0.4,
      enhancedDescription: "This PDF may contain images or scanned content. For best results, consider uploading a text-based PDF or image files.",
      suggestedTags: [category, documentType, "limited-extraction"],
    };
  }

  // Route 3: DOCX files - extract text from ZIP/XML structure
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    console.log("Route: DOCX ZIP extraction");
    try {
      const zip = await JSZip.loadAsync(fileBuffer);
      const documentXml = zip.file("word/document.xml");
      
      if (!documentXml) {
        throw new Error("Invalid DOCX: missing word/document.xml");
      }
      
      const xmlContent = await documentXml.async("text");
      
      // Extract text from XML, removing tags and normalizing whitespace
      const textContent = xmlContent
        .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, "$1 ")  // Extract text from <w:t> tags
        .replace(/<w:p[^>]*>/g, "\n")                   // Paragraph breaks
        .replace(/<[^>]+>/g, "")                        // Remove remaining XML tags
        .replace(/\s+/g, " ")                           // Normalize whitespace
        .trim();
      
      if (textContent.length > 50) {
        console.log(`DOCX extracted ${textContent.length} characters of text`);
        return await analyzeTextContent(textContent.substring(0, 12000), category, documentType);
      }
      
      // Fallback if minimal text found
      return {
        summary: "Word document uploaded but contains minimal extractable text.",
        extractedText: textContent || "Unable to extract text content",
        documentType: documentType,
        keyDates: [],
        entities: [],
        complianceStandards: [],
        riskFlags: [],
        confidenceScore: 0.4,
        enhancedDescription: "This Word document was processed but may require manual review for complete content.",
        suggestedTags: [category, documentType],
      };
    } catch (docxError) {
      console.error("DOCX extraction failed:", docxError);
      return {
        summary: "Unable to process this Word document. The file may be corrupted or in an unsupported format.",
        extractedText: "DOCX processing error",
        documentType: documentType,
        keyDates: [],
        entities: [],
        complianceStandards: [],
        riskFlags: ["Document processing error"],
        confidenceScore: 0.2,
        enhancedDescription: "An error occurred while processing this document. Please try re-uploading or contact support.",
        suggestedTags: [category, documentType, "processing-error"],
      };
    }
  }

  // Route 4: Unsupported file type
  throw new Error(`Unsupported file type: ${mimeType}. Supported types: PDF, JPEG, PNG, GIF, WebP, DOCX`);
}

// ============ EMBEDDING & TAGS ============

async function createEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text.substring(0, 8000),
      model: "text-embedding-3-small",
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
  complianceStandards: string[],
): string[] {
  const tags: string[] = [];

  if (documentType) {
    tags.push(
      ...documentType
        .toLowerCase()
        .split(/[\s-]+/)
        .filter((t) => t.length > 2),
    );
  }

  if (industry) {
    tags.push(industry.toLowerCase());
  }

  tags.push(year.toString());

  if (complianceStandards.length > 0) {
    tags.push(...complianceStandards.map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, "")));
  }

  return [...new Set(tags)];
}

// ============ DOCUMENT PROCESSING ============

async function processDocument(supabase: any, doc: any): Promise<AnalysisResult> {
  const documentUploadId = doc.id;
  const buyerId = doc.document_requests.buyer_id;

  // Update status to processing
  await supabase
    .from("document_uploads")
    .update({ content_extraction_status: "processing" })
    .eq("id", documentUploadId);

  try {
    // Get supplier details
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id, company_name, industry")
      .eq("id", doc.document_requests.supplier_id)
      .single();

    const supplierName = supplier?.company_name || "Unknown Supplier";
    const supplierIndustry = supplier?.industry || "General";
    const year = new Date().getFullYear();

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("compliance-documents")
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
      doc.document_requests.category || "compliance",
      doc.document_requests.document_type || "certificate",
      doc.mime_type,
    );

    // Create embedding for the extracted content
    const embedding = await createEmbedding(analysis.extractedText);

    // Generate relevance tags
    const relevanceTags = generateRelevanceTags(
      doc.document_requests.document_type,
      supplierIndustry,
      year,
      analysis.complianceStandards,
    );

    // Create knowledge entry
    const knowledgeEntry = {
      company_id: buyerId,
      company_type: "buyer",
      entry_type: "document_analysis",
      title: `${doc.document_requests.document_type || "Document"} - ${supplierName}`,
      content: analysis.extractedText,
      embedding: `[${embedding.join(",")}]`,
      metadata: {
        document_upload_id: documentUploadId,
        supplier_id: doc.document_requests.supplier_id,
        supplier_name: supplierName,
        document_type: doc.document_requests.document_type,
        category: doc.document_requests.category,
        file_name: doc.file_name,
        key_dates: analysis.keyDates,
        entities: analysis.entities,
        compliance_standards: analysis.complianceStandards,
        risk_flags: analysis.riskFlags,
        confidence_score: analysis.confidenceScore,
        year: year,
      },
      source_reference: `document_uploads:${documentUploadId}`,
      industry_context: supplierIndustry,
      relevance_tags: relevanceTags,
    };

    const { error: insertError } = await supabase.from("ai_knowledge_entries").insert(knowledgeEntry);

    if (insertError) {
      console.error("Failed to insert knowledge entry:", insertError);
    }

    // Update document with analysis results
    await supabase
      .from("document_uploads")
      .update({
        content_summary: analysis.summary,
        content_extraction_status: "completed",
        content_extracted_at: new Date().toISOString(),
        metadata: {
          ...(doc.metadata ?? {}),
          ai_analysis: {
            enhanced_description: analysis.enhancedDescription,
            suggested_tags: analysis.suggestedTags,
            key_dates: analysis.keyDates,
            entities: analysis.entities,
            compliance_standards: analysis.complianceStandards,
            risk_flags: analysis.riskFlags,
            confidence_score: analysis.confidenceScore,
            analyzed_at: new Date().toISOString(),
          },
        },
      })
      .eq("id", documentUploadId);

    return analysis;
  } catch (error: any) {
    console.error(`Error processing document ${documentUploadId}:`, error);

    await supabase
      .from("document_uploads")
      .update({
        content_extraction_status: "failed",
        content_summary: `Processing failed: ${error.message}`,
      })
      .eq("id", documentUploadId);

    throw error;
  }
}

// ============ SINGLE DOCUMENT PROCESSING ============

async function processSingleDocument(supabase: any, documentUploadId: string): Promise<any> {
  console.log(`Processing single document: ${documentUploadId}`);

  // Get document with request info
  const { data: doc, error: docError } = await supabase
    .from("document_uploads")
    .select(
      `
      *,
      document_requests!inner(
        id,
        buyer_id,
        supplier_id,
        document_type,
        category,
        title
      )
    `,
    )
    .eq("id", documentUploadId)
    .single();

  if (docError || !doc) {
    throw new Error(`Document not found: ${docError?.message}`);
  }

  const analysis = await processDocument(supabase, doc);

  return {
    success: true,
    document_id: documentUploadId,
    summary: analysis.summary,
    confidence_score: analysis.confidenceScore,
  };
}

// ============ BATCH PROCESSING ============

async function processDocumentsForBuyers(
  supabase: any,
  buyerIds: string[],
  excludeDemo: boolean,
  dryRun: boolean,
  batchSize: number,
): Promise<any> {
  const results = {
    total_documents: 0,
    processed: 0,
    failed: 0,
    skipped: 0,
    errors: [] as any[],
    processed_docs: [] as any[],
  };

  for (const buyerId of buyerIds) {
    console.log(`Processing documents for buyer: ${buyerId}`);

    // Get pending documents for this buyer
    let query = supabase
      .from("document_uploads")
      .select(
        `
        *,
        document_requests!inner(
          id,
          buyer_id,
          supplier_id,
          document_type,
          category,
          title
        )
      `,
      )
      .eq("document_requests.buyer_id", buyerId)
      .in("content_extraction_status", ["pending", "failed", null])
      .eq("status", "approved")
      .limit(batchSize);

    const { data: documents, error: fetchError } = await query;

    if (fetchError) {
      console.error(`Error fetching documents for buyer ${buyerId}:`, fetchError);
      continue;
    }

    if (!documents || documents.length === 0) {
      console.log(`No pending documents for buyer ${buyerId}`);
      continue;
    }

    results.total_documents += documents.length;

    for (const doc of documents) {
      // Check for demo patterns if excluding
      if (excludeDemo) {
        const isDemo = DEMO_PATTERNS.some(
          (pattern) =>
            doc.file_name?.toLowerCase().includes(pattern) ||
            doc.document_requests?.title?.toLowerCase().includes(pattern),
        );

        if (isDemo) {
          console.log(`Skipping demo document: ${doc.file_name}`);
          results.skipped++;
          continue;
        }
      }

      if (dryRun) {
        console.log(`[DRY RUN] Would process: ${doc.file_name}`);
        results.processed++;
        continue;
      }

      try {
        const analysis = await processDocument(supabase, doc);
        results.processed++;
        results.processed_docs.push({
          id: doc.id,
          file_name: doc.file_name,
          summary: analysis.summary.substring(0, 200),
          confidence: analysis.confidenceScore,
        });
      } catch (error: any) {
        console.error(`Failed to process document ${doc.id}:`, error);
        results.failed++;
        results.errors.push({
          document_id: doc.id,
          file_name: doc.file_name,
          error: error.message,
        });
      }
    }
  }

  return results;
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const requestBody: BackfillRequest = await req.json();
    const { buyer_ids, exclude_demo = true, dry_run = false, batch_size = 10, document_upload_id } = requestBody;

    console.log("Backfill request:", { buyer_ids, exclude_demo, dry_run, batch_size, document_upload_id });

    // Mode 1: Single document processing (for "Analyze Now" button)
    if (document_upload_id) {
      console.log("Single document mode");

      // Validate authentication for single document mode
      const authHeader = req.headers.get("Authorization") ?? "";
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

      if (authHeader) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });

        const { data: userData, error: userErr } = await userClient.auth.getUser();
        if (userErr || !userData?.user) {
          console.log("User not authenticated, proceeding with service role for single doc");
        }
      }

      const result = await processSingleDocument(supabase, document_upload_id);

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mode 2: Batch processing (requires buyer_ids)
    if (!buyer_ids || buyer_ids.length === 0) {
      return new Response(JSON.stringify({ error: "Either document_upload_id or buyer_ids is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await processDocumentsForBuyers(supabase, buyer_ids, exclude_demo, dry_run, batch_size);

    return new Response(
      JSON.stringify({
        success: true,
        message: dry_run ? "Dry run completed" : "Backfill completed",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Backfill error:", error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
