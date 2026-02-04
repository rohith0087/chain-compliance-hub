
# Fix: Document Status Showing Wrong Version

## Problem Identified

The document card for the ISO 9001 Certificate from Voot Foods displays **"Rejected"** when the **current/latest version is actually "Approved"**.

### Root Cause: Database Version Numbers Not Incrementing + Sort Logic Mismatch

| Component | Sort Method | Result |
|-----------|-------------|--------|
| `DocumentVersionHistory.tsx` | `created_at DESC` | ✅ Correctly identifies newest upload (approved) as "Current" |
| `BuyerDocumentsDashboard.tsx` | `version DESC` only | ❌ Both uploads have `version=1`, so sort is arbitrary |
| `ApprovedDocumentSummaryModal.tsx` | `version DESC` | ❌ Same issue |

**Database Evidence:**
```
Upload 1 (rejected): created_at = 08:38:10, version = 1
Upload 2 (approved): created_at = 08:39:18, version = 1  ← Should be version 2!
```

Both uploads have `version = 1` in the database, so when sorting by version, JavaScript's unstable sort can return either one first, causing the rejected version to incorrectly appear as the "latest."

---

## Solution: Two-Part Fix

### Part 1: Fix the Sort Logic (Frontend - Immediate Fix)

Update all components to sort by **version DESC, then created_at DESC** as a tiebreaker. This ensures that when versions are equal, the most recently uploaded file is used.

**Files to update:**

#### 1. `src/components/documents/BuyerDocumentsDashboard.tsx` (line 354-356)

```typescript
// BEFORE:
const sortedUploads = [...doc.document_uploads].sort((a: any, b: any) => 
  (b.version || 0) - (a.version || 0)
);

// AFTER:
const sortedUploads = [...doc.document_uploads].sort((a: any, b: any) => {
  // Primary: version DESC
  const versionDiff = (b.version || 0) - (a.version || 0);
  if (versionDiff !== 0) return versionDiff;
  // Tiebreaker: created_at DESC (newest first)
  return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
});
```

#### 2. `src/components/documents/ApprovedDocumentSummaryModal.tsx` (line 186)

Apply the same fix to ensure the summary modal identifies the correct "current" version.

#### 3. `src/components/documents/BuyerDocumentsManager.tsx`

Verify the `getLatestUpload` helper already uses `created_at` (it does, so no change needed there).

### Part 2: Fix the Data (Backend - Correct the Version Numbers)

The real issue is that when V2 was uploaded, the version column wasn't incremented. This should be fixed:

1. **SQL to fix existing data:**
```sql
-- Update the approved upload to version 2
UPDATE document_uploads 
SET version = 2 
WHERE id = 'bf7d0b4a-a04f-4478-bcaa-327e4858a0f8';
```

2. **Investigate why version wasn't incremented** when the supplier resubmitted - this could be a bug in the upload flow for rejected documents.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/documents/BuyerDocumentsDashboard.tsx` | Update sort at line 354-356 to use `version DESC, created_at DESC` |
| `src/components/documents/ApprovedDocumentSummaryModal.tsx` | Update sort at line 186 with same fix |

---

## Expected Result

After this fix:
- The ISO 9001 Certificate card will show **"Approved"** (the newer upload's status)
- Version History will continue to work correctly (already uses `created_at`)
- All components will consistently identify the newest upload as "current"
