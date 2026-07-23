import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openAIApiKey = Deno.env.get("OPENAI_API_KEY")!;

// ============ NORMALIZATION DICTIONARIES ============

const UNIT_CONVERSIONS: Record<string, { target: string; factor: number }> = {
  "ppm": { target: "mg/kg", factor: 1 },
  "ppb": { target: "ug/kg", factor: 1 },
  "ug/g": { target: "mg/kg", factor: 1 },
  "µg/g": { target: "mg/kg", factor: 1 },
  "mg/l": { target: "mg/kg", factor: 1 },
  "mg/L": { target: "mg/kg", factor: 1 },
  "%": { target: "mg/kg", factor: 10000 },
  "percent": { target: "mg/kg", factor: 10000 },
};

const ANALYTE_MAP: Record<string, string> = {
  "e. coli": "E_COLI", "escherichia coli": "E_COLI", "e.coli": "E_COLI",
  "salmonella": "SALMONELLA", "salmonella spp": "SALMONELLA", "salmonella spp.": "SALMONELLA",
  "total plate count": "TPC", "tpc": "TPC", "aerobic plate count": "TPC", "apc": "TPC",
  "yeast and mold": "YEAST_MOLD", "yeast & mold": "YEAST_MOLD", "y&m": "YEAST_MOLD",
  "yeast and mould": "YEAST_MOLD", "yeasts and moulds": "YEAST_MOLD",
  "listeria": "LISTERIA", "listeria monocytogenes": "LISTERIA", "l. mono": "LISTERIA", "l. monocytogenes": "LISTERIA",
  "coliforms": "COLIFORMS", "total coliforms": "COLIFORMS",
  "lead": "LEAD", "pb": "LEAD",
  "arsenic": "ARSENIC", "as": "ARSENIC",
  "cadmium": "CADMIUM", "cd": "CADMIUM",
  "mercury": "MERCURY", "hg": "MERCURY",
  "peanut": "PEANUT", "peanuts": "PEANUT",
  "gluten": "GLUTEN", "wheat": "GLUTEN", "wheat/gluten": "GLUTEN",
  "milk": "MILK", "casein": "MILK", "whey": "MILK",
  "soy": "SOY", "soybean": "SOY", "soya": "SOY",
  "sesame": "SESAME",
  "egg": "EGG", "eggs": "EGG",
  "fish": "FISH",
  "shellfish": "SHELLFISH", "crustacean": "SHELLFISH",
  "tree nuts": "TREE_NUTS", "tree nut": "TREE_NUTS",
  "aflatoxin": "AFLATOXIN", "aflatoxin b1": "AFLATOXIN_B1",
  "moisture": "MOISTURE",
};

const METHOD_MAP: Record<string, string> = {
  "iso 6579": "ISO_6579", "iso 6579:2017": "ISO_6579",
  "aoac 2016.02": "AOAC_2016_02", "aoac 2016.2": "AOAC_2016_02",
  "iso 16649": "ISO_16649", "iso 16649-2": "ISO_16649",
  "aoac 991.14": "AOAC_991_14",
  "iso 4833": "ISO_4833", "iso 4833-1": "ISO_4833",
  "iso 21527": "ISO_21527",
  "iso 11290": "ISO_11290",
  "aoac 2004.02": "AOAC_2004_02",
  "iso 4832": "ISO_4832",
  "icp-ms": "ICP_MS", "icp ms": "ICP_MS", "icpms": "ICP_MS",
  "icp-oes": "ICP_OES", "icp oes": "ICP_OES",
  "elisa": "ELISA",
  "r5 elisa": "R5_ELISA", "r5-elisa": "R5_ELISA",
  "pcr": "PCR", "real-time pcr": "PCR", "rt-pcr": "PCR",
  "hplc": "HPLC",
  "gc-ms": "GC_MS",
  "aas": "AAS",
};

const CRITICAL_ANALYTES = new Set(["SALMONELLA", "LISTERIA"]);

// ============ UTILITY FUNCTIONS ============

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function normalizeAnalyteCode(name: string): string {
  const lower = name.toLowerCase().trim();
  return ANALYTE_MAP[lower] || name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function normalizeMethod(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  return METHOD_MAP[lower] || raw.toUpperCase().replace(/[^A-Z0-9_.]/g, '_');
}

function normalizeUnit(raw: string): { unit: string; factor: number; notes: string | null } {
  const lower = raw.toLowerCase().trim();
  const conv = UNIT_CONVERSIONS[lower];
  if (conv) {
    return { unit: conv.target, factor: conv.factor, notes: `Converted ${raw} → ${conv.target} (factor: ${conv.factor})` };
  }
  return { unit: raw, factor: 1, notes: null };
}

interface CensoredResult {
  is_censored: boolean;
  censored_type: string | null;
  censored_threshold: number | null;
  numeric_value: number | null;
}

function parseCensoredValue(raw: string): CensoredResult {
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();
  if (upper === "ND" || upper === "NOT DETECTED" || upper === "NEGATIVE" || upper === "N.D." || upper === "NEG") {
    return { is_censored: true, censored_type: "ND", censored_threshold: 0, numeric_value: 0 };
  }
  if (upper === "<LOD") return { is_censored: true, censored_type: "less_than_LOD", censored_threshold: null, numeric_value: 0 };
  if (upper === "<LOQ") return { is_censored: true, censored_type: "less_than_LOQ", censored_threshold: null, numeric_value: 0 };
  if (upper === "DETECTED" || upper === "POSITIVE" || upper === "POS") {
    return { is_censored: false, censored_type: null, censored_threshold: null, numeric_value: 1 };
  }
  const ltMatch = trimmed.match(/^<\s*([\d.]+)$/);
  if (ltMatch) {
    const threshold = parseFloat(ltMatch[1]);
    return { is_censored: true, censored_type: "less_than_LOD", censored_threshold: threshold, numeric_value: threshold };
  }
  const num = parseFloat(trimmed.replace(/,/g, ''));
  if (!isNaN(num)) return { is_censored: false, censored_type: null, censored_threshold: null, numeric_value: num };
  return { is_censored: false, censored_type: null, censored_threshold: null, numeric_value: null };
}

function normalizeBasis(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower.includes("dry")) return "dry";
  if (lower.includes("as-is") || lower.includes("as is") || lower.includes("wet")) return "as-is";
  if (lower.includes("per g") || lower.includes("per gram")) return "per_g";
  if (lower.includes("per ml") || lower.includes("per milliliter")) return "per_mL";
  return raw;
}

// ============ PDF/DOCX EXTRACTION ============

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    let text = "";
    const maxPages = Math.min(pdf.numPages, 10);
    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str || "").join(" ") + "\n\n";
      } catch { /* skip page */ }
    }
    return text.trim();
  } catch (e) {
    console.error("PDF extraction failed:", e);
    return "";
  }
}

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("text");
    if (!docXml) return "";
    return docXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } catch (e) {
    console.error("DOCX extraction failed:", e);
    return "";
  }
}

// ============ GPT EXTRACTION ============

interface ExtractedAnalyte {
  analyte_name: string;
  value: string;
  unit: string;
  method: string | null;
  basis: string | null;
}

interface GPTExtractionResult {
  lot_number: string | null;
  analytes: ExtractedAnalyte[];
}

async function extractWithGPT(content: string, useVision: boolean, base64Data?: string, mimeType?: string): Promise<GPTExtractionResult> {
  const systemPrompt = `You are a COA (Certificate of Analysis) parser. Extract all analyte test results from this document.
Return a JSON object with:
- lot_number: the lot/batch number if found (string or null)
- analytes: array of objects with: analyte_name (string), value (raw string exactly as written e.g. "ND", "<0.01", "5200", "Negative"), unit (string), method (string or null), basis (string or null e.g. "dry basis", "as-is")

Be thorough - extract EVERY analyte/test result. Include microbiological, chemical, heavy metals, allergens, physical properties, etc.
Return ONLY the JSON object, no markdown.`;

  const messages: any[] = [{ role: "system", content: systemPrompt }];

  if (useVision && base64Data) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: "Parse this Certificate of Analysis document and extract all analyte results:" },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}`, detail: "high" } },
      ],
    });
  } else {
    messages.push({ role: "user", content: `Parse this Certificate of Analysis and extract all analyte results:\n\n${content.slice(0, 15000)}` });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o", messages, max_tokens: 4000, temperature: 0.1 }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || "";
  
  // Try to parse JSON from response (handle markdown code blocks)
  let jsonStr = rawContent;
  const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];
  
  try {
    const parsed = JSON.parse(jsonStr.trim());
    return {
      lot_number: parsed.lot_number || null,
      analytes: Array.isArray(parsed.analytes) ? parsed.analytes : [],
    };
  } catch {
    console.error("Failed to parse GPT response:", rawContent.slice(0, 500));
    return { lot_number: null, analytes: [] };
  }
}

// ============ COMPARISON ENGINE ============

interface SpecRow {
  analyte_code: string;
  analyte_name: string;
  spec_min: number | null;
  spec_max: number | null;
  unit: string;
  method: string | null;
  acceptable_methods: string[] | null;
  action_on_exceed: string;
  basis: string | null;
}

interface MethodEqRow {
  analyte_code: string;
  method_a: string;
  method_b: string;
  is_active: boolean;
}

interface PolicyRow {
  within_spec_is_match: boolean;
  censored_equivalent_is_match: boolean;
  require_basis_conversion: boolean;
  flag_non_convertible_units: boolean;
  auto_flag_unknown_analytes: boolean;
}

function areMethodsEquivalent(methodA: string | null, methodB: string | null, analyteCode: string, equivalencies: MethodEqRow[]): boolean {
  if (!methodA || !methodB) return true; // if method not specified, don't penalize
  if (methodA === methodB) return true;
  return equivalencies.some(eq =>
    eq.is_active && eq.analyte_code === analyteCode &&
    ((eq.method_a === methodA && eq.method_b === methodB) || (eq.method_a === methodB && eq.method_b === methodA))
  );
}

function compareAnalyte(
  analyteCode: string,
  numericValue: number | null,
  isCensored: boolean,
  normalizedMethod: string | null,
  spec: SpecRow | undefined,
  policy: PolicyRow,
  equivalencies: MethodEqRow[],
): { status: string; flagReason: string | null } {
  if (!spec) {
    if (policy.auto_flag_unknown_analytes) {
      return { status: "unknown_analyte", flagReason: "Analyte not in buyer specifications" };
    }
    return { status: "pass", flagReason: null };
  }

  // Check method equivalency
  const methodMatch = areMethodsEquivalent(normalizedMethod, spec.method, analyteCode, equivalencies);

  // For censored values (ND, <LOD)
  if (isCensored) {
    if (policy.censored_equivalent_is_match && (spec.spec_max === 0 || spec.spec_max === null)) {
      return { status: methodMatch ? "pass" : "flagged", flagReason: methodMatch ? null : "Method not equivalent" };
    }
    // Censored usually means below detection, treat as pass
    return { status: "pass", flagReason: null };
  }

  if (numericValue === null) {
    return { status: "flagged", flagReason: "Non-numeric value, manual review needed" };
  }

  // Check spec limits
  let exceedsSpec = false;
  let flagReason = "";
  if (spec.spec_max !== null && numericValue > spec.spec_max) {
    exceedsSpec = true;
    flagReason = `Value ${numericValue} ${spec.unit} exceeds spec max ${spec.spec_max} ${spec.unit}`;
  }
  if (spec.spec_min !== null && numericValue < spec.spec_min) {
    exceedsSpec = true;
    flagReason = `Value ${numericValue} ${spec.unit} below spec min ${spec.spec_min} ${spec.unit}`;
  }

  if (exceedsSpec) {
    return { status: "fail", flagReason };
  }

  if (!methodMatch) {
    return { status: "flagged", flagReason: `Method ${normalizedMethod} not equivalent to spec method ${spec.method}` };
  }

  return { status: "pass", flagReason: null };
}

function calculateScore(
  results: Array<{ status: string }>,
  totalSpecAnalytes: number,
): { score: number; passFail: string } {
  let score = 100;
  let hasCriticalFail = false;
  
  const missing = totalSpecAnalytes - results.filter(r => r.status !== "unknown_analyte").length;
  
  for (const r of results) {
    switch (r.status) {
      case "fail":
        score -= 5;
        break;
      case "flagged":
        score -= 5;
        break;
      case "unknown_analyte":
        score -= 2;
        break;
    }
  }

  // Deduct for missing/unreported analytes
  score -= missing * 10;
  
  // Check for critical analyte failures
  // (We need analyte codes for this, handle in main flow)
  
  score = Math.max(0, Math.min(100, score));

  let passFail: string;
  if (hasCriticalFail || score < 50) {
    passFail = "fail";
  } else if (score >= 80 && results.every(r => r.status !== "fail")) {
    passFail = "pass";
  } else {
    passFail = "partial";
  }

  return { score, passFail };
}

// ============ TENANT RESOLUTION / AUTHORIZATION ============

// Resolve the caller's company (buyer or supplier) server-side. Body-supplied
// tenant ids are never trusted on their own.
async function getCallerCompany(
  sb: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ companyId: string; companyType: string } | null> {
  const { data: cu } = await sb
    .from("company_users")
    .select("company_id, company_type")
    .eq("profile_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (cu?.company_id) return { companyId: cu.company_id as string, companyType: cu.company_type as string };
  const { data: buyer } = await sb.from("buyers").select("id").eq("profile_id", userId).maybeSingle();
  if (buyer) return { companyId: buyer.id as string, companyType: "buyer" };
  const { data: supplier } = await sb.from("suppliers").select("id").eq("profile_id", userId).maybeSingle();
  if (supplier) return { companyId: supplier.id as string, companyType: "supplier" };
  return null;
}

// A document upload belongs to the caller's company if the uploader is a member
// of that company, or the linked document request targets that company
// (supplier side) or was created by one of its members (buyer side).
async function documentBelongsToCompany(
  sb: ReturnType<typeof createClient>,
  documentUploadId: string,
  companyId: string,
): Promise<boolean> {
  const profileInCompany = async (profileId: string | null): Promise<boolean> => {
    if (!profileId) return false;
    const { data: cu } = await sb
      .from("company_users")
      .select("id")
      .eq("profile_id", profileId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (cu) return true;
    const { data: b } = await sb.from("buyers").select("id").eq("profile_id", profileId).eq("id", companyId).maybeSingle();
    if (b) return true;
    const { data: s } = await sb.from("suppliers").select("id").eq("profile_id", profileId).eq("id", companyId).maybeSingle();
    return !!s;
  };

  const { data: doc } = await sb
    .from("document_uploads")
    .select("uploader_id, request_id")
    .eq("id", documentUploadId)
    .maybeSingle();
  if (!doc) return false;

  if (await profileInCompany(doc.uploader_id as string | null)) return true;

  if (doc.request_id) {
    const { data: docReq } = await sb
      .from("document_requests")
      .select("supplier_id, requester_id")
      .eq("id", doc.request_id)
      .maybeSingle();
    if (docReq) {
      if (docReq.supplier_id === companyId) return true;
      if (await profileInCompany(docReq.requester_id as string | null)) return true;
    }
  }
  return false;
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rate limiting: 10 req/min/user
    const rateCheck = checkRateLimit(claimsData.claims.sub as string, 10, 60_000);
    if (!rateCheck.allowed) {
      return rateLimitResponse(corsHeaders, rateCheck.retryAfterMs);
    }

    const { submission_id, document_upload_id, buyer_id, supplier_id } = await req.json();

    // --- Tenant resolution: the caller's company comes from the database,
    // never from the request body. ---
    const caller = await getCallerCompany(supabase, claimsData.claims.sub as string);
    if (!caller) {
      return new Response(JSON.stringify({ error: "No company associated with this account" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const forbidden = (message: string) => new Response(
      JSON.stringify({ error: message }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

    // Reject body tenant ids that contradict the caller's resolved company.
    if (buyer_id && caller.companyType === "buyer" && buyer_id !== caller.companyId) {
      return forbidden("buyer_id does not match your organization");
    }
    if (supplier_id && caller.companyType === "supplier" && supplier_id !== caller.companyId) {
      return forbidden("supplier_id does not match your organization");
    }

    let submissionId = submission_id;

    // If no submission_id, create one from document_upload_id
    if (!submissionId && document_upload_id) {
      // The referenced document must belong to the caller's company.
      if (!(await documentBelongsToCompany(supabase, document_upload_id, caller.companyId))) {
        return forbidden("Document upload does not belong to your organization");
      }
      // Force the caller-side tenant id to the server-resolved company; only
      // the counterparty id may come from the body.
      const effectiveBuyerId = caller.companyType === "buyer" ? caller.companyId : buyer_id;
      const effectiveSupplierId = caller.companyType === "supplier" ? caller.companyId : supplier_id;
      if (!effectiveBuyerId || !effectiveSupplierId) {
        return new Response(JSON.stringify({ error: "buyer_id and supplier_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: newSub, error: subErr } = await supabase
        .from("coa_submissions")
        .insert({
          buyer_id: effectiveBuyerId,
          supplier_id: effectiveSupplierId,
          document_upload_id,
          analysis_status: "analyzing",
        })
        .select("id")
        .single();
      if (subErr) throw new Error(`Failed to create submission: ${subErr.message}`);
      submissionId = newSub.id;
    }

    if (!submissionId) {
      return new Response(JSON.stringify({ error: "submission_id or document_upload_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify the submission belongs to the caller's company (either side)
    // before mutating or reading it.
    const { data: submissionOwner, error: ownerErr } = await supabase
      .from("coa_submissions")
      .select("buyer_id, supplier_id")
      .eq("id", submissionId)
      .single();
    if (ownerErr || !submissionOwner) throw new Error("Submission not found");
    if (submissionOwner.buyer_id !== caller.companyId && submissionOwner.supplier_id !== caller.companyId) {
      return forbidden("Submission does not belong to your organization");
    }

    // Update status to analyzing
    await supabase.from("coa_submissions").update({ analysis_status: "analyzing" }).eq("id", submissionId);

    // Fetch submission
    const { data: submission, error: subFetchErr } = await supabase
      .from("coa_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();
    if (subFetchErr || !submission) throw new Error("Submission not found");

    // Fetch linked document
    let fileBuffer: ArrayBuffer | null = null;
    let mimeType = "application/pdf";
    let filePath = "";
    
    if (submission.document_upload_id) {
      const { data: doc } = await supabase
        .from("document_uploads")
        .select("file_path, mime_type")
        .eq("id", submission.document_upload_id)
        .single();
      
      if (doc) {
        filePath = doc.file_path;
        mimeType = doc.mime_type || "application/pdf";
        
        // Download from storage
        const { data: fileData, error: dlErr } = await supabase.storage
          .from("documents")
          .download(filePath);
        
        if (dlErr) {
          console.error("Download error:", dlErr);
          // Try alternate bucket
          const { data: fileData2 } = await supabase.storage.from("supplier-documents").download(filePath);
          if (fileData2) fileBuffer = await fileData2.arrayBuffer();
        } else if (fileData) {
          fileBuffer = await fileData.arrayBuffer();
        }
      }
    }

    if (!fileBuffer) {
      await supabase.from("coa_submissions").update({
        analysis_status: "error",
        raw_extracted_data: { error: "Could not download document file" },
      }).eq("id", submissionId);
      return new Response(JSON.stringify({ error: "Could not download document" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Extract content
    let extractedText = "";
    let useVision = false;
    let base64Data = "";

    if (mimeType === "application/pdf" || filePath.endsWith(".pdf")) {
      extractedText = await extractPdfText(fileBuffer);
      if (extractedText.length < 100) {
        // Scanned PDF - use vision
        useVision = true;
        base64Data = arrayBufferToBase64(fileBuffer);
      }
    } else if (mimeType?.includes("wordprocessing") || filePath.endsWith(".docx")) {
      extractedText = await extractDocxText(fileBuffer);
    } else if (mimeType?.startsWith("image/")) {
      useVision = true;
      base64Data = arrayBufferToBase64(fileBuffer);
    } else {
      extractedText = new TextDecoder().decode(fileBuffer);
    }

    // GPT extraction
    let extraction: GPTExtractionResult;
    try {
      extraction = await extractWithGPT(extractedText, useVision, base64Data, mimeType);
    } catch (gptErr) {
      console.error("GPT extraction failed:", gptErr);
      await supabase.from("coa_submissions").update({
        analysis_status: "error",
        raw_extracted_data: { error: String(gptErr) },
      }).eq("id", submissionId);
      return new Response(JSON.stringify({ error: "AI extraction failed", details: String(gptErr) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (extraction.analytes.length === 0) {
      await supabase.from("coa_submissions").update({
        analysis_status: "error",
        raw_extracted_data: { error: "No analytes extracted from document" },
      }).eq("id", submissionId);
      return new Response(JSON.stringify({ error: "No analytes found in document" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch buyer specs, policy, equivalencies
    const [specsRes, policyRes, eqRes] = await Promise.all([
      supabase.from("coa_specifications").select("*").eq("buyer_id", submission.buyer_id).eq("is_active", true),
      supabase.from("coa_policy_settings").select("*").eq("buyer_id", submission.buyer_id).single(),
      supabase.from("coa_method_equivalencies").select("*").eq("buyer_id", submission.buyer_id).eq("is_active", true),
    ]);

    const specs: SpecRow[] = specsRes.data || [];
    const policy: PolicyRow = policyRes.data || {
      within_spec_is_match: true,
      censored_equivalent_is_match: true,
      require_basis_conversion: false,
      flag_non_convertible_units: true,
      auto_flag_unknown_analytes: true,
    };
    const equivalencies: MethodEqRow[] = eqRes.data || [];

    // Normalize and compare each analyte
    const analyteResults: any[] = [];
    let flagsCount = 0;
    let hasCriticalFail = false;

    for (const raw of extraction.analytes) {
      const analyteCode = normalizeAnalyteCode(raw.analyte_name);
      const normalizedMethod = normalizeMethod(raw.method);
      const unitConv = normalizeUnit(raw.unit);
      const censored = parseCensoredValue(raw.value);
      const basis = normalizeBasis(raw.basis);

      // Apply unit conversion to numeric value
      let finalNumeric = censored.numeric_value;
      if (finalNumeric !== null && unitConv.factor !== 1) {
        finalNumeric = finalNumeric * unitConv.factor;
      }

      // Find matching spec
      const spec = specs.find(s => s.analyte_code === analyteCode);

      // Compare
      const comparison = compareAnalyte(analyteCode, finalNumeric, censored.is_censored, normalizedMethod, spec, policy, equivalencies);

      if (comparison.status === "fail" || comparison.status === "flagged") flagsCount++;
      if (comparison.status === "fail" && CRITICAL_ANALYTES.has(analyteCode)) hasCriticalFail = true;

      analyteResults.push({
        submission_id: submissionId,
        analyte_name: raw.analyte_name,
        analyte_code: analyteCode,
        raw_value: raw.value,
        numeric_value: finalNumeric,
        is_censored: censored.is_censored,
        censored_type: censored.censored_type,
        censored_threshold: censored.censored_threshold,
        raw_unit: raw.unit,
        normalized_unit: unitConv.unit,
        raw_method: raw.method,
        normalized_method: normalizedMethod,
        basis,
        spec_min: spec?.spec_min ?? null,
        spec_max: spec?.spec_max ?? null,
        status: comparison.status,
        flag_reason: comparison.flagReason,
        confidence: censored.numeric_value !== null || censored.is_censored ? "high" : "medium",
        conversion_notes: unitConv.notes,
      });
    }

    // Calculate score
    const { score, passFail: calculatedPassFail } = calculateScore(analyteResults, specs.length);
    const passFail = hasCriticalFail ? "fail" : calculatedPassFail;
    const finalScore = hasCriticalFail ? Math.min(score, 40) : score;

    // Write analyte results
    if (analyteResults.length > 0) {
      const { error: insertErr } = await supabase.from("coa_analyte_results").insert(analyteResults);
      if (insertErr) console.error("Failed to insert analyte results:", insertErr);
    }

    // Update submission
    await supabase.from("coa_submissions").update({
      analysis_status: "completed",
      overall_score: finalScore,
      pass_fail: passFail,
      flags_count: flagsCount,
      lot_number: extraction.lot_number || submission.lot_number,
      raw_extracted_data: { text_length: extractedText.length, analytes_extracted: extraction.analytes.length },
      normalized_data: { analyte_count: analyteResults.length },
      comparison_results: { specs_count: specs.length, flags_count: flagsCount, critical_fail: hasCriticalFail },
    }).eq("id", submissionId);

    // If schedule_id exists, update last_submitted_date
    if (submission.schedule_id) {
      await supabase.from("coa_schedules").update({
        last_submitted_date: new Date().toISOString().split("T")[0],
      }).eq("id", submission.schedule_id);
    }

    return new Response(JSON.stringify({
      success: true,
      submission_id: submissionId,
      score: finalScore,
      pass_fail: passFail,
      flags_count: flagsCount,
      analytes_processed: analyteResults.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("COA analyzer error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
