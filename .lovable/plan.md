
# Approved Document Summary & Activity Modal (Updated with Version Handling)

## Overview

This feature adds a new modal that opens when a buyer clicks on an approved document in the Documents Dashboard. The modal will display:
1. **AI-Generated Summary** of the document content (prioritizing the latest approved version)
2. **Version History with Per-Version Summaries** (when multiple versions exist)
3. **Activity Timeline** showing all actions taken on the document
4. **Quick Actions**: View, Download, and Create Link buttons

## Version Summary Strategy

### The Question: Which version summary to show?

When a document has been rejected and resubmitted multiple times, there may be multiple versions with different `content_summary` values. Here's how we'll handle this:

### Approach: Show Latest Approved Summary + Version History

**Primary View (Summary Tab):**
- Display the **latest approved version's summary** prominently at the top
- This is the "current truth" - the most recent document that passed review

**Version Summaries Section:**
- Below the main summary, show a collapsible "Previous Versions" section
- Each version displays:
  - Version number (V1, V2, V3...)
  - Status badge (Approved/Rejected)
  - Its own `content_summary` (if extraction completed)
  - Upload date and expiration date
  - Rejection reason (if rejected)

### Why This Approach?

| Alternative | Problem |
|-------------|---------|
| Show only latest version | User loses historical context |
| Show all summaries equally | Confusing - unclear which is authoritative |
| Show only approved versions | May miss important context from rejected versions |
| **Show latest approved prominently + version history** | **Best UX - clear primary view with full historical access** |

### Data Flow for Versions

```text
document_uploads (sorted by version DESC):
  [
    { version: 3, status: 'approved', content_summary: 'Latest summary...' },  ← PRIMARY
    { version: 2, status: 'rejected', content_summary: 'Rejected summary...' },
    { version: 1, status: 'rejected', content_summary: 'Original summary...' }
  ]

Modal Display:
  ┌────────────────────────────────────────────────┐
  │  Document Summary                              │
  │  ─────────────────                             │
  │  [Current Version - V3]                        │
  │  "This ISO 9001:2015 certificate confirms..."  │
  │                                                │
  │  ▸ View Previous Versions (2 more)             │
  │    └─ V2 (Rejected): "Certificate had..."     │
  │    └─ V1 (Rejected): "Initial submission..."  │
  └────────────────────────────────────────────────┘
```

## Modal Design

### Layout Structure

```text
┌──────────────────────────────────────────────────────────────┐
│  ×                                                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  📄 ISO 9001 Certificate                               │  │
│  │     Acme Foods Co.                    ✓ Approved       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────┬─────────────────┐                      │
│  │  📋 Summary      │  📊 Activity    │                      │
│  └──────────────────┴─────────────────┘                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  🤖 AI Summary (V3 - Current)                          │  │
│  │  ─────────────────────────────────────────────          │  │
│  │  This ISO 9001:2015 certificate was issued by          │  │
│  │  Bureau Veritas on January 15, 2026. The certificate   │  │
│  │  confirms that Acme Foods Co. maintains a quality      │  │
│  │  management system compliant with...                   │  │
│  │                                                        │  │
│  │  Key Details:                                          │  │
│  │  • Issued: January 15, 2026                            │  │
│  │  • Expires: January 15, 2027                           │  │
│  │  • Certifying Body: Bureau Veritas                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ▸ Previous Versions (2 more)                          │  │
│  │    ┌─────────────────────────────────────────────────┐ │  │
│  │    │ V2 - Rejected (Dec 20, 2025)                    │ │  │
│  │    │ "Certificate was expired and needed renewal..." │ │  │
│  │    │ ⚠️ Rejection: Certificate date past due         │ │  │
│  │    └─────────────────────────────────────────────────┘ │  │
│  │    ┌─────────────────────────────────────────────────┐ │  │
│  │    │ V1 - Rejected (Dec 15, 2025)                    │ │  │
│  │    │ "Initial submission of ISO certificate..."      │ │  │
│  │    │ ⚠️ Rejection: Wrong document uploaded           │ │  │
│  │    └─────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────┬──────────────┬────────────────┐                │
│  │  👁 View  │  ⬇ Download  │  🔗 Create Link │                │
│  └──────────┴──────────────┴────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

### Activity Tab Design

The Activity tab will show a complete timeline including all versions:

```text
Timeline:
├─ 🔗 Link Created (Feb 2, 2026, 10:30 AM) - John Buyer
├─ ✅ Document Approved (Feb 1, 2026, 2:15 PM) - AI Agent
├─ 📤 Document Uploaded V3 (Feb 1, 2026, 2:00 PM) - Jane Supplier
├─ ❌ Document Declined (Dec 20, 2025, 4:00 PM) - John Buyer
│     "Certificate date past due"
├─ 📤 Document Uploaded V2 (Dec 20, 2025, 3:30 PM) - Jane Supplier
├─ ❌ Document Declined (Dec 15, 2025, 11:00 AM) - John Buyer
│     "Wrong document uploaded"
├─ 📤 Document Uploaded V1 (Dec 15, 2025, 10:00 AM) - Jane Supplier
└─ 📝 Request Created (Dec 10, 2025, 9:00 AM) - John Buyer
```

## Technical Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/documents/ApprovedDocumentSummaryModal.tsx` | Main modal component with Summary + Activity tabs |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/documents/BuyerDocumentsDashboard.tsx` | Add `content_summary`, `content_extraction_status`, `content_extracted_at` to query |
| `src/components/documents/BuyerDocumentsManager.tsx` | Add state management for summary modal, click handler |
| `src/components/documents/DocumentCardWithSelection.tsx` | Add clickable area for approved documents to open modal |

### Updated Query in BuyerDocumentsDashboard

```typescript
document_uploads (
  id,
  file_name,
  file_path,
  file_size,
  mime_type,
  status,
  version,
  created_at,
  expiration_date,
  reviewer_notes,
  content_summary,             // NEW - AI-generated summary
  content_extraction_status,   // NEW - 'pending' | 'processing' | 'completed' | 'failed'
  content_extracted_at,        // NEW - when extraction completed
  uploader:uploader_id (
    full_name
  )
)
```

### Component Interface

```typescript
interface ApprovedDocumentSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    document_type: string;
    title?: string;
    category?: string;
    created_at: string;
    supplier?: { company_name: string };
    document_uploads?: Array<{
      id: string;
      file_name: string;
      file_path: string;
      status: string;
      version?: number;
      content_summary?: string;
      content_extraction_status?: string;
      content_extracted_at?: string;
      expiration_date?: string;
      created_at: string;
      reviewer_notes?: string;
      uploader?: { full_name: string };
    }>;
  };
  // Reuse existing handlers from BuyerDocumentsManager
  onView: () => void;
  onDownload: () => void;
  onCreateLink: () => void;
}
```

### Version Sorting Logic

```typescript
// Helper to get versions sorted and categorized
const getVersionsWithSummaries = (uploads: DocumentUpload[]) => {
  if (!uploads || uploads.length === 0) return { current: null, previous: [] };
  
  // Sort by version DESC (newest first)
  const sorted = [...uploads].sort((a, b) => (b.version || 0) - (a.version || 0));
  
  // Find the latest approved version (this is "current")
  const currentApproved = sorted.find(u => u.status === 'approved');
  
  // All other versions are "previous"
  const previous = sorted.filter(u => u.id !== currentApproved?.id);
  
  return { current: currentApproved || sorted[0], previous };
};
```

### Extraction Status Display

| Status | Display |
|--------|---------|
| `completed` | Show summary with "AI Analyzed" badge |
| `processing` | Show spinner with "Analyzing document..." |
| `pending` | Show "Summary pending - document queued for analysis" |
| `failed` | Show "Summary unavailable" with option to manually trigger |
| Not available (legacy) | Show "No summary available for this document" |

### UI States

**Summary Available:**
- Full summary text in a readable card
- Key details extracted (dates, entities) if available
- Version badge showing which version is displayed

**Summary Processing:**
- Animated skeleton/shimmer effect
- "AI is analyzing this document..." message
- Estimated time if possible

**Summary Failed/Unavailable:**
- Informative message explaining why
- For failed: offer to retry extraction
- For legacy docs: explain they predate the feature

## Click Handler Integration

**Where clicks are captured:**

```typescript
// In DocumentCardWithSelection.tsx
// Make the card clickable for approved documents
const handleCardClick = () => {
  if (document.status === 'approved' && onOpenSummary) {
    onOpenSummary();
  }
};

return (
  <Card 
    className={`... ${document.status === 'approved' ? 'cursor-pointer' : ''}`}
    onClick={handleCardClick}
  >
    ...
  </Card>
);
```

**Passed from BuyerDocumentsManager:**

```typescript
// In BuyerDocumentsManager.tsx
const [summaryModalOpen, setSummaryModalOpen] = useState(false);
const [summaryDocument, setSummaryDocument] = useState<any>(null);

const handleOpenSummary = (doc: any) => {
  setSummaryDocument(doc);
  setSummaryModalOpen(true);
};

// Pass to DocumentCardWithSelection
<DocumentCardWithSelection
  document={doc}
  onOpenSummary={doc.status === 'approved' ? () => handleOpenSummary(doc) : undefined}
  ...
/>
```

## Summary

This implementation:

1. **Shows the latest approved version's summary prominently** - Clear, authoritative view
2. **Provides full version history with per-version summaries** - Complete historical context
3. **Reuses existing components** - DocumentActivityChain for timeline, existing handlers for actions
4. **Handles edge cases gracefully** - Processing, failed, and legacy documents all have clear states
5. **Non-breaking** - Click handler is additive, doesn't affect existing button behaviors
6. **Clean, modern UI** - Consistent with app's gradient styling, uses shadcn/ui components
