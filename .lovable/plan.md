

# Fix: PDF Processing Pipeline - Comprehensive Overhaul

## Problems Identified

### Problem 1: PDF.js Failing in Edge Functions (0 Pages)
**Root Cause**: The `pdfjs-dist` package at `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs` requires a worker script that cannot be initialized in Deno/Edge Functions. This causes `pdf.numPages` to return `0` even for valid 5-page PDFs with selectable text.

**Evidence**: From your screenshot showing "PDF document with 0 pages" for a 5-page Recall Audit Report that has clearly selectable text.

### Problem 2: Vision API Rejecting PDFs (Invalid MIME Type)
**Root Cause**: OpenAI Vision API **only accepts image formats** (PNG, JPEG, WebP, GIF). The current code attempts to send PDFs directly:
```typescript
// This FAILS - Vision API doesn't accept PDFs!
return await analyzeImageWithVision(base64Data, 'application/pdf', category, documentType);
```

**Evidence**: Error message "I'm unable to analyze the content of the document as it appears to be an image."

### Problem 3: Edge Function 403 Errors on "Analyze Now"
**Root Cause**: When clicking "Analyze Now" from the modal, the frontend calls `backfill-buyer-document-content` with only `document_upload_id`, but the function now expects authenticated buyer access. The single-document path is conflicting with the batch path authentication.

---

## Solution: Multi-Step Intelligent Processing Pipeline

```text
+------------------+
|   PDF Input      |
+--------+---------+
         |
         v
+------------------+
|  pdfjs-serverless|  <-- Replace pdfjs-dist (works in Deno!)
|  Text Extraction |
+--------+---------+
         |
    Text found?
    /         \
  YES          NO
   |            |
   v            v
+----------+  +------------------------+
| GPT-4o   |  | Convert PDF to Images  |
| Text API |  | (Page-by-Page at 2000px)|
| (cheap)  |  +----------+-------------+
+----------+             |
                         v
              +------------------------+
              | GPT-4o Vision API      |
              | (Multi-image message)  |
              | detail: "high"         |
              +------------------------+
```

---

## Technical Changes Required

### 1. Replace PDF.js with pdfjs-serverless

**Current (broken):**
```typescript
import * as pdfjs from 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs';
```

**Fixed:**
```typescript
import { getDocument } from 'https://esm.sh/pdfjs-serverless@0.5.0';
```

This library is specifically designed for Deno and serverless environments - it bundles the worker internally.

### 2. Add PDF-to-Image Conversion for Scanned PDFs

When text extraction fails (scanned PDFs), convert PDF pages to high-resolution PNG images using `pdf-img-convert`:

```typescript
import { pdf } from 'https://esm.sh/pdf-img-convert@1.2.1';

async function convertPdfToImages(pdfBuffer: ArrayBuffer, maxPages = 4): Promise<string[]> {
  const images = await pdf(new Uint8Array(pdfBuffer), {
    width: 2000,  // High resolution for OCR
    base64: true,
    pages: Array.from({ length: maxPages }, (_, i) => i + 1)
  });
  return images;
}
```

### 3. Multi-Image Vision API Call

Send multiple page images in a single API request for comprehensive analysis:

```typescript
async function analyzeMultiPageDocument(
  pageImages: string[],  // Array of base64 PNG images
  category: string,
  documentType: string
): Promise<AnalysisResult> {
  const imageContent = pageImages.map(img => ({
    type: 'image_url',
    image_url: { 
      url: `data:image/png;base64,${img}`, 
      detail: 'high'  // Critical for OCR quality
    }
  }));

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
          { type: 'text', text: `Analyze this ${pageImages.length}-page document. Extract ALL text and provide a comprehensive summary...` },
          ...imageContent
        ]
      }],
      max_tokens: 3000  // More tokens for multi-page analysis
    })
  });
  // ... parse response
}
```

### 4. Fix Single-Document Analysis Path

Update the "Analyze Now" flow to handle single document processing without requiring platform admin:

```typescript
// In serve() handler, add special path for single document:
if (requestBody.document_upload_id && !requestBody.buyer_ids) {
  // Single document mode - verify user has access
  const upload = await supabase
    .from('document_uploads')
    .select('*, document_requests!inner(buyer_id, supplier_id)')
    .eq('id', requestBody.document_upload_id)
    .single();
  
  // Allow if user is associated with buyer or supplier
  // ... process single document
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/backfill-buyer-document-content/index.ts` | - Replace pdfjs-dist with pdfjs-serverless - Add PDF-to-image conversion - Add multi-image Vision API call - Fix single-document auth path |
| `supabase/functions/buyer-document-content-processor/index.ts` | - Apply same PDF processing fixes - Ensure real-time processing uses correct pipeline |

---

## Updated Processing Logic Summary

| File Type | Text Extractable? | Processing Route | Estimated Tokens |
|-----------|------------------|------------------|------------------|
| PDF | YES (>100 chars) | Text → GPT-4o Text API | ~500-1000 |
| PDF | NO (scanned) | Pages → Images → Vision API | ~1500-3000 |
| PNG/JPEG/GIF/WebP | N/A | Direct → Vision API | ~1000 |
| DOCX | Attempt extraction | Text → GPT-4o Text API | ~500 |

---

## Expected Outcomes

1. **5-page PDF with text**: Now correctly extracted via pdfjs-serverless, analyzed with text API
2. **Scanned PDFs**: Converted to high-res images, analyzed with Vision API
3. **"Analyze Now" button**: Works without 403 errors for authorized users
4. **Page count**: Correctly reports actual page count (5 instead of 0)
5. **No more "appears to be an image"**: Vision API receives proper image format

---

## Deployment Steps

1. Update `backfill-buyer-document-content/index.ts` with new pipeline
2. Update `buyer-document-content-processor/index.ts` with same fixes
3. Deploy both edge functions
4. Test with a 5-page PDF that has selectable text
5. Test with a scanned certificate PDF
6. Verify "Analyze Now" works from the modal

