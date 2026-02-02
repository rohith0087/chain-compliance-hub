
# Buyer-Side Document Reading & Knowledge Base Integration

## Executive Summary

When suppliers submit documents to fulfill buyer requests, those documents are currently **validated** by the buyer-agent but **not read/indexed** into the knowledge base. This means the Compliance Compass cannot answer questions about the actual content of submitted compliance documents.

This plan implements a complete pipeline to:
1. **Extract content** from submitted documents using GPT-4o Vision
2. **Store in knowledge base** indexed by `buyer_id` + `year` for efficient RBAC and search
3. **Connect to Compliance Compass** so buyers can query document contents

---

## Current Architecture Analysis

### What Exists Today

| Component | Handles | Knowledge Base? |
|-----------|---------|-----------------|
| `document-content-extractor` | Supplier Document Library uploads | ✅ Yes - stores as `company_type: 'supplier'` |
| `buyer-agent` | Document request validation | ❌ No - validates but doesn't extract/store |
| `knowledge-populator` | Document metadata aggregation | ✅ Yes - but only metadata, not full content |

### The Gap

```text
Supplier uploads to Library → document-content-extractor → ai_knowledge_entries (supplier-owned)
                                                                    ↓
                                                     Supplier Compass can search ✓

Supplier submits to Buyer Request → buyer-agent (validation only) → ❌ NO KNOWLEDGE ENTRY
                                                                    ↓
                                                     Buyer Compass CANNOT search ✗
```

### Current Knowledge Base Structure

```sql
ai_knowledge_entries:
  - company_id: UUID        -- Currently set to supplier_id
  - company_type: TEXT      -- Currently 'supplier' 
  - entry_type: TEXT        -- 'document', 'document_metadata', etc.
  - content: TEXT           -- Extracted text
  - embedding: VECTOR       -- For semantic search
  - metadata: JSONB         -- Rich metadata
  - source_reference: TEXT  -- Reference to source document
```

**Problem**: Buyer Compliance Compass filters by `company_id = buyer_id` and `company_type = 'buyer'`, but no such entries exist for document content.

---

## Proposed Solution

### New Data Flow

```text
Supplier submits to Buyer Request
         ↓
  buyer-agent (existing validation)
         ↓
  NEW: buyer-document-content-processor (extract content with Vision API)
         ↓
  ai_knowledge_entries (buyer_id + year indexed)
         ↓
  Buyer Compliance Compass can now search document contents ✓
```

### Knowledge Entry Structure for Buyer Documents

```sql
ai_knowledge_entries:
  company_id: buyer_id,
  company_type: 'buyer',
  entry_type: 'buyer_document_content',
  title: 'ISO 9001 Certificate - Supplier ABC (2026)',
  content: [extracted text],
  embedding: [vector],
  metadata: {
    document_upload_id: 'uuid',
    document_request_id: 'uuid',
    supplier_id: 'uuid',
    supplier_name: 'Supplier ABC',
    document_type: 'ISO 9001',
    year: 2026,
    expiration_date: '2026-12-31',
    approval_date: '2026-02-02',
    summary: 'AI-generated summary...',
    key_dates: [...],
    entities: [...],
    compliance_standards: [...]
  },
  source_reference: 'buyer_upload:document_upload_id',
  relevance_tags: ['iso', 'quality', 'certification', '2026']
```

---

## Implementation Plan

### Phase 1: New Edge Function - `buyer-document-content-processor`

Create a new edge function that processes approved buyer document uploads.

**File**: `supabase/functions/buyer-document-content-processor/index.ts`

**Responsibilities**:
1. Accept document upload ID as input
2. Fetch file from storage bucket
3. Call GPT-4o Vision for content extraction
4. Generate embeddings using text-embedding-3-small
5. Store in `ai_knowledge_entries` with buyer context
6. Update `document_uploads.metadata` with extraction status

**Key Implementation Details**:

```typescript
// Structure of knowledge entry for buyer documents
const knowledgeEntry = {
  company_id: request.buyer_id,          // CRITICAL: Use buyer_id, not supplier_id
  company_type: 'buyer',                  // CRITICAL: 'buyer' for RBAC
  entry_type: 'buyer_document_content',
  title: `${request.document_type} - ${supplier.company_name} (${year})`,
  content: extractedText,
  embedding: embeddingVector,
  metadata: {
    document_upload_id: upload.id,
    document_request_id: upload.request_id,
    supplier_id: request.supplier_id,
    supplier_name: supplier.company_name,
    document_type: request.document_type,
    year: new Date().getFullYear(),
    expiration_date: upload.expiration_date,
    approval_date: new Date().toISOString(),
    summary: aiSummary,
    key_dates: extractedDates,
    entities: extractedEntities,
    compliance_standards: detectedStandards
  },
  source_reference: `buyer_upload:${upload.id}`,
  relevance_tags: generateTags(request.document_type, supplier.industry, year)
};
```

### Phase 2: Integration with Buyer-Agent

Modify `buyer-agent` to trigger content extraction after approval.

**File**: `supabase/functions/buyer-agent/index.ts`

**Changes**:
- After setting `status = 'approved'`, invoke `buyer-document-content-processor`
- Add extraction status tracking to `document_uploads.metadata`
- Handle extraction failures gracefully (don't block approval)

```typescript
// After approval in processDocumentUpload():
if (newStatus === 'approved') {
  // Trigger async content extraction for knowledge base
  try {
    await supabase.functions.invoke('buyer-document-content-processor', {
      body: {
        document_upload_id: upload.id,
        buyer_id: request.buyer_id
      }
    });
  } catch (extractError) {
    // Log but don't fail - extraction is supplementary
    console.error('Content extraction failed:', extractError);
    await logAgentActivity('content_extraction_failed', upload.id, 'document_upload', { error: extractError.message });
  }
}
```

### Phase 3: Database Changes

**New columns on `document_uploads`**:

| Column | Type | Purpose |
|--------|------|---------|
| `content_extraction_status` | TEXT | 'pending', 'processing', 'completed', 'failed' |
| `content_extracted_at` | TIMESTAMPTZ | When extraction completed |
| `content_summary` | TEXT | AI-generated summary for quick preview |

**Migration SQL**:

```sql
-- Add content extraction tracking to document_uploads
ALTER TABLE document_uploads
ADD COLUMN IF NOT EXISTS content_extraction_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS content_extracted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS content_summary TEXT;

-- Create index for year-based queries
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_buyer_year 
ON ai_knowledge_entries ((metadata->>'year'), company_id) 
WHERE company_type = 'buyer';

-- Create index for source reference lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_source_ref 
ON ai_knowledge_entries (source_reference);
```

### Phase 4: Update RAG Search for Buyer Context

Modify `simple-rag-chat` to include buyer document content in searches.

**File**: `supabase/functions/simple-rag-chat/index.ts`

**Changes**:
- Add year filtering to search queries when relevant
- Include `entry_type = 'buyer_document_content'` in results
- Display supplier name context in search results

**Enhanced search query**:

```typescript
// When searching knowledge base for buyer
const { data: knowledgeEntries } = await supabase.rpc('search_knowledge_entries', {
  query_embedding: `[${embedding.join(',')}]`,
  company_id_param: buyerId,
  company_type_param: 'buyer',
  similarity_threshold: 0.65,  // Slightly lower for document content
  match_count: 10
});

// Filter/boost by year if mentioned in query
if (mentionsYear(userQuery)) {
  const year = extractYear(userQuery);
  knowledgeEntries = knowledgeEntries.filter(e => 
    e.metadata?.year === year || !e.metadata?.year
  );
}
```

### Phase 5: Backfill Existing Approved Documents

Create a one-time script to process existing approved uploads.

**Approach**:
1. Query all `document_uploads` with `status = 'approved'`
2. For each, invoke `buyer-document-content-processor`
3. Rate limit to avoid API throttling (2 per minute)
4. Track progress in `metadata.backfill_status`

**SQL to identify backfill candidates**:

```sql
SELECT du.id, du.file_path, du.file_name, dr.buyer_id, dr.document_type
FROM document_uploads du
JOIN document_requests dr ON du.request_id = dr.id
WHERE du.status = 'approved'
AND du.content_extraction_status IS NULL
ORDER BY du.created_at DESC;
```

---

## Technical Details

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/buyer-document-content-processor/index.ts` | New edge function for content extraction |
| `supabase/migrations/[timestamp]_buyer_document_extraction.sql` | Database schema changes |

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/buyer-agent/index.ts` | Trigger extraction after approval |
| `supabase/functions/simple-rag-chat/index.ts` | Enhanced search for document content |
| `supabase/config.toml` | Add new function with `verify_jwt = true` |

### API Flow

```text
1. Supplier submits document → document_uploads (status: pending_review)
2. buyer-agent processes → validation + auto-approve/reject
3. If approved:
   a. Update status → 'approved'
   b. Invoke buyer-document-content-processor (async)
4. buyer-document-content-processor:
   a. Download file from storage
   b. Call GPT-4o Vision for extraction
   c. Generate embedding
   d. Upsert to ai_knowledge_entries (buyer-owned)
   e. Update document_uploads.content_extraction_status
5. Compliance Compass searches ai_knowledge_entries
   → Now includes actual document content!
```

### Security Considerations

1. **RBAC Enforcement**: Knowledge entries use `company_id = buyer_id` + `company_type = 'buyer'`
2. **RLS Policy**: Existing policy on `ai_knowledge_entries` already handles buyer access
3. **JWT Validation**: New function requires authentication
4. **Supplier Isolation**: Buyer A cannot see documents submitted to Buyer B

### Error Handling

| Scenario | Handling |
|----------|----------|
| File download fails | Log error, set status to 'failed', don't retry automatically |
| Vision API error | Retry once, then mark as 'failed' |
| Embedding creation fails | Fall back to title-only entry without embedding |
| Knowledge insert fails | Log error, don't block approval flow |

---

## Summary

This implementation creates a parallel content extraction pipeline for buyer document requests, ensuring that:

1. **Approved documents get read** using the same GPT-4o Vision technology
2. **Content is indexed for buyers** with proper RBAC (buyer_id + year)
3. **Compliance Compass can search** actual document contents
4. **Existing approved documents** can be backfilled

The architecture cleanly separates buyer-owned knowledge from supplier-owned knowledge, maintaining proper access control while enabling powerful semantic search across all compliance documents.
