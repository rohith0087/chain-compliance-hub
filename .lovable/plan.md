
# Fix PDF and DOCX Document Parsing in Edge Functions

## Problem Summary

The document processing system is failing for PDF and DOCX files:

| File Type | Error | User Sees |
|-----------|-------|-----------|
| **PDF** | `pdfjs-dist` worker initialization fails in Deno | "Manual review is recommended..." |
| **DOCX** | ZIP binary decoded as UTF-8 produces garbage text sent to AI | "I'm sorry, but it seems that the document content provided is not in a readable format..." |
| **Images** | Works correctly | Proper summaries |

## Root Cause Analysis

### PDF Issue
The `pdfjs-dist` library throws an error even when `GlobalWorkerOptions.workerSrc = ""` is set because the library still dynamically accesses the worker source at runtime.

### DOCX Issue  
DOCX files are actually ZIP archives containing XML files. The current code incorrectly uses `TextDecoder.decode()` on the raw binary, which produces garbage characters. This garbage is then sent to GPT-4o, which responds with "I'm sorry, but it seems that the document content provided is not in a readable format..." - which is then stored as the summary.

## Solution

### Part 1: Use Deno-Compatible PDF Library

Replace `pdfjs-dist` with `pdfjs-serverless`, which is specifically built for serverless/Deno environments without worker dependencies.

**File: `supabase/functions/backfill-buyer-document-content/index.ts`**

```typescript
// BEFORE (line 4):
import { getDocument, GlobalWorkerOptions } from "https://esm.sh/pdfjs-dist@4.4.168/build/pdf.mjs";

// AFTER:
import { getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
```

Update `extractPdfText` function to use the new library:

```typescript
async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<{ text: string; pageCount: number }> {
  try {
    console.log("Starting PDF text extraction with unpdf...");
    
    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const pageCount = pdf.numPages;
    console.log(`PDF loaded successfully: ${pageCount} pages`);
    
    let fullText = "";
    const maxPages = Math.min(pageCount, 10);
    
    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || "")
          .join(" ");
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
```

### Part 2: Proper DOCX Parsing with JSZip

Use JSZip to extract the `word/document.xml` file from the DOCX archive, then parse the XML to extract text.

**Add import:**
```typescript
import JSZip from "https://esm.sh/jszip@3.10.1";
```

**Replace DOCX extraction logic:**

```typescript
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
```

### Part 3: Improve Error Messages for Users

Update the fallback in `parseVisionResponse` to provide user-friendly messages when the AI response is not valid JSON:

```typescript
function parseVisionResponse(data: any, category: string, documentType: string): AnalysisResult {
  const content = data.choices?.[0]?.message?.content || "";

  try {
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    const result = JSON.parse(jsonStr);
    // ... existing success logic
  } catch (parseError) {
    console.error("Failed to parse API response as JSON:", parseError);
    
    // Check if the AI apologized (indicates it couldn't read the content)
    const isApology = content.toLowerCase().includes("i'm sorry") || 
                      content.toLowerCase().includes("not in a readable format") ||
                      content.toLowerCase().includes("cannot be directly analyzed");
    
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
    
    // Normal fallback for other cases
    return {
      summary: content.substring(0, 500) + (content.length > 500 ? "..." : ""),
      extractedText: content,
      documentType: documentType,
      // ... rest of existing fallback
    };
  }
}
```

### Part 4: Add Fallback to Vision API for PDFs

If PDF text extraction fails or returns minimal text, use Vision API by converting the first page to a base64 data URL:

```typescript
// In the PDF processing route, after text extraction fails:
if (text.length < 100) {
  console.log("PDF has minimal text - attempting Vision API analysis");
  
  // For PDFs that failed text extraction, send the raw bytes to Vision
  // The AI can sometimes interpret PDF structure even without rendering
  const base64Pdf = arrayBufferToBase64(pdfBuffer);
  
  // Note: Vision API doesn't directly support PDFs, so we inform the user
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
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/backfill-buyer-document-content/index.ts` | Replace PDF library, add JSZip for DOCX, improve error messages |

## Expected Results

After these changes:

| File Type | Before | After |
|-----------|--------|-------|
| **PDF (text-based)** | "Error: No GlobalWorkerOptions.workerSrc" | Proper text extraction and summary |
| **PDF (scanned)** | Same error | Clear message explaining limitation |
| **DOCX** | "I'm sorry, but it seems..." (AI confusion) | Proper text extraction and summary |
| **Images** | Works | Works (no change) |

## User-Facing Message Improvements

Instead of showing technical/AI-generated apology messages, users will see:
- "We were unable to extract content from this document. The file format may not be fully supported or the document may require manual review."
- "This PDF may contain images or scanned content. For best results, consider uploading a text-based PDF or image files."
