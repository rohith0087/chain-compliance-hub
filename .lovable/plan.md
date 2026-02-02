

# Multi-Step Document Processing Pipeline

## Issues Identified

| Error | Root Cause | Files Affected |
|-------|-----------|----------------|
| **Maximum call stack size exceeded** | `btoa(String.fromCharCode(...new Uint8Array(buffer)))` - spread operator with large files causes stack overflow | Both edge functions |
| **Invalid MIME type** | OpenAI Vision API only accepts image formats (JPEG, PNG, GIF, WebP), not PDFs | PDF documents (~12 files) |
| **DOCX files** | Word documents need text extraction before processing | 1 DOCX file found |

**Document Mix in Queue:**
- PDFs: ~14 documents
- PNG images: ~4 documents  
- DOCX: 1 document

---

## Proposed Multi-Step Processing Strategy

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DOCUMENT PROCESSING PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                                                            │
│  │  File Input │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: Detect File Type                                           │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  Check MIME type / file extension                                    │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ image/png    │  │ application/ │  │ application/ │              │   │
│  │  │ image/jpeg   │  │ pdf          │  │ docx/xlsx    │              │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │   │
│  └─────────┼─────────────────┼─────────────────┼───────────────────────┘   │
│            │                 │                 │                           │
│            ▼                 ▼                 ▼                           │
│  ┌─────────────────┐ ┌─────────────────────────────────────────────────┐   │
│  │ DIRECT VISION   │ │  STEP 2: Try Text Extraction (PDF)             │   │
│  │ API CALL        │ │  ─────────────────────────────────────────────  │   │
│  │ (no conversion) │ │  Use pdfjs-serverless to extract text           │   │
│  └────────┬────────┘ │                                                 │   │
│           │          │  ┌───────────────────────────────────────────┐  │   │
│           │          │  │ Text extracted?                           │  │   │
│           │          │  │   YES → Use text directly (no OCR needed) │  │   │
│           │          │  │   NO  → PDF is likely scanned images      │  │   │
│           │          │  └───────────────────────────────────────────┘  │   │
│           │          └─────────────────┬───────────────────────────────┘   │
│           │                            │                                   │
│           │                            ▼                                   │
│           │          ┌─────────────────────────────────────────────────┐   │
│           │          │  STEP 3: PDF to Image Conversion               │   │
│           │          │  ─────────────────────────────────────────────  │   │
│           │          │  Convert PDF pages to high-res PNG (2000px)     │   │
│           │          │  Process first 4 pages for token efficiency     │   │
│           │          └─────────────────┬───────────────────────────────┘   │
│           │                            │                                   │
│           ▼                            ▼                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  STEP 4: Vision API Analysis                                        │  │
│  │  ────────────────────────────────────────────────────────────────── │  │
│  │  Send images (1-4 pages) to GPT-4o Vision for OCR + understanding    │  │
│  │  Multi-image messages supported for multi-page docs                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### 1. Fix Stack Overflow (Critical - Affects All Documents)

Replace the dangerous spread operator pattern:

```typescript
// BEFORE (causes stack overflow for large files):
const base64Data = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

// AFTER (chunk-based conversion - handles any file size):
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32768; // Process in 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}
```

### 2. PDF Text Extraction First (Optimizes Token Usage)

Use `pdfjs-serverless` to extract text from native PDFs:

```typescript
import { getDocument } from 'https://esm.sh/pdfjs-serverless@0.3.2';

async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<{ text: string; pageCount: number }> {
  const pdf = await getDocument(new Uint8Array(pdfBuffer)).promise;
  const pageCount = pdf.numPages;
  let fullText = '';
  
  for (let i = 1; i <= Math.min(pageCount, 10); i++) { // Limit to 10 pages
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map(item => item.str).join(' ') + '\n';
  }
  
  return { text: fullText.trim(), pageCount };
}
```

### 3. PDF to Image Conversion (For Scanned PDFs)

Use `pdf-img-convert` for serverless-compatible PDF rendering:

```typescript
import { convert } from 'https://esm.sh/pdf-img-convert@1.2.1';

async function convertPdfToImages(pdfBuffer: ArrayBuffer, maxPages: number = 4): Promise<string[]> {
  const images = await convert(new Uint8Array(pdfBuffer), {
    width: 2000,     // High resolution for OCR
    height: 2800,    // ~8.5x11 aspect ratio
    page_numbers: Array.from({ length: maxPages }, (_, i) => i + 1)
  });
  
  // Convert to base64 strings
  return images.map(img => arrayBufferToBase64(img.buffer));
}
```

### 4. Multi-Image Vision API Call

Send multiple page images in a single Vision API request:

```typescript
async function analyzeMultiPageDocument(
  pageImages: string[], // Array of base64 PNG images
  category: string,
  documentType: string
): Promise<AnalysisResult> {
  const imageContent = pageImages.map(img => ({
    type: 'image_url',
    image_url: { url: `data:image/png;base64,${img}`, detail: 'high' }
  }));
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Analyze this ${pageImages.length}-page document...` },
          ...imageContent
        ]
      }],
      max_tokens: 3000 // More tokens for multi-page
    })
  });
  // ... parse response
}
```

### 5. DOCX/XLSX Handling

Use `mammoth` for Word docs and return text for analysis:

```typescript
import mammoth from 'https://esm.sh/mammoth@1.6.0';

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}
```

---

## Updated Processing Flow

```typescript
async function processDocumentIntelligent(supabase: any, doc: any): Promise<AnalysisResult> {
  const fileBuffer = await downloadFile(supabase, doc.file_path);
  const mimeType = detectMimeType(doc.file_path, doc.mime_type);
  
  // Route based on file type
  switch (mimeType) {
    case 'image/png':
    case 'image/jpeg':
    case 'image/webp':
    case 'image/gif':
      // Direct Vision API - no conversion needed
      return await analyzeWithVision(fileBuffer, mimeType);
      
    case 'application/pdf':
      // Step 1: Try text extraction first
      const { text, pageCount } = await extractPdfText(fileBuffer);
      
      if (text.length > 100) {
        // Native PDF with text - use text-based analysis (cheaper)
        return await analyzeTextContent(text, doc.document_type);
      } else {
        // Scanned PDF - convert to images
        const pageImages = await convertPdfToImages(fileBuffer, Math.min(4, pageCount));
        return await analyzeMultiPageDocument(pageImages, doc.category, doc.document_type);
      }
      
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      // DOCX - extract text
      const docxText = await extractDocxText(fileBuffer);
      return await analyzeTextContent(docxText, doc.document_type);
      
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/backfill-buyer-document-content/index.ts` | Complete rewrite of document processing with multi-step pipeline |
| `supabase/functions/buyer-document-content-processor/index.ts` | Apply same fixes for real-time processing |

---

## Token Cost Optimization

| Document Type | Processing Path | Estimated Tokens |
|---------------|----------------|------------------|
| Native PDF (with text) | Text extraction → GPT-4 text analysis | ~500 tokens |
| Scanned PDF (1-2 pages) | PDF→Image → Vision API | ~1,500 tokens |
| Scanned PDF (3-4 pages) | PDF→Image → Vision API multi-image | ~3,000 tokens |
| Image (PNG/JPEG) | Direct Vision API | ~1,000 tokens |
| DOCX | Text extraction → GPT-4 text analysis | ~500 tokens |

---

## Error Handling Improvements

1. **Graceful Fallback**: If PDF text extraction fails, fall back to image conversion
2. **Page Limit**: Process max 4 pages to prevent timeout (edge functions have 60s limit)
3. **Image Size Check**: If converted images are too large, reduce resolution
4. **Retry Logic**: Retry failed API calls with exponential backoff

---

## Summary of Changes

1. **Fix stack overflow** - Chunk-based base64 encoding for large files
2. **PDF text extraction first** - Use `pdfjs-serverless` to check for native text
3. **PDF to image conversion** - Use `pdf-img-convert` for scanned documents
4. **Multi-image Vision calls** - Send up to 4 pages in single API request
5. **DOCX support** - Extract text using `mammoth`
6. **Intelligent routing** - Choose cheapest processing path based on file type
7. **Apply to both functions** - Backfill function and real-time processor

