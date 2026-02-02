

# Retroactive Buyer Sample Attachment Feature

## Problem Statement

When a buyer sends a document request **before** uploading a sample template for that document type, and then later adds the sample template, **the existing request does not get updated with the new sample**. This is because the current implementation takes a "snapshot" of the sample at request creation time.

**Current Data Impact:**
- **458 total requests** without sample documents
- **24 active requests** (15 pending + 4 submitted + 2 approved + 3 withdrawn) where a sample template NOW exists but wasn't attached at creation time

## Proposed Solution

Add a mechanism to **retroactively attach buyer samples** to existing document requests that don't have one. This can work in two ways:

### Option A: Automatic Sync (Recommended)
When a buyer uploads or updates a sample template, automatically update all **pending** document requests of that type that don't already have a sample attached.

### Option B: Manual Action Button
Add a "Sync Samples" button in the Sample Template Manager that allows buyers to manually push their templates to existing pending requests.

I recommend **Option A** as it provides a seamless experience without requiring additional user action.

---

## Implementation Plan

### 1. Database Function: `sync_sample_to_pending_requests`

Create a PostgreSQL function that updates pending requests when a sample template is uploaded.

**Location:** New migration file

```sql
CREATE OR REPLACE FUNCTION sync_sample_to_pending_requests()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all pending document requests for this buyer/document_type
  -- that don't already have a sample attached
  UPDATE document_requests
  SET 
    sample_file_path = NEW.sample_file_path,
    sample_file_name = NEW.sample_file_name,
    sample_file_size = NEW.sample_file_size,
    sample_mime_type = NEW.sample_mime_type,
    sample_uploaded_by = NEW.uploaded_by,
    sample_uploaded_at = NEW.created_at
  WHERE buyer_id = NEW.buyer_id
    AND document_type = NEW.document_type
    AND sample_file_path IS NULL
    AND status = 'pending';
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Database Trigger

Attach the function to run automatically when a sample template is inserted or updated.

```sql
CREATE TRIGGER trigger_sync_sample_to_pending_requests
AFTER INSERT OR UPDATE ON buyer_sample_templates
FOR EACH ROW
EXECUTE FUNCTION sync_sample_to_pending_requests();
```

### 3. One-Time Backfill (Optional)

Run a one-time SQL command to sync existing templates to pending requests that were created before this feature.

```sql
UPDATE document_requests dr
SET 
  sample_file_path = bst.sample_file_path,
  sample_file_name = bst.sample_file_name,
  sample_file_size = bst.sample_file_size,
  sample_mime_type = bst.sample_mime_type,
  sample_uploaded_by = bst.uploaded_by,
  sample_uploaded_at = bst.created_at
FROM buyer_sample_templates bst
WHERE dr.buyer_id = bst.buyer_id
  AND dr.document_type = bst.document_type
  AND dr.sample_file_path IS NULL
  AND dr.status = 'pending';
```

---

## Technical Details

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/[timestamp]_sync_sample_to_pending_requests.sql` | Create | New migration with trigger function |

### Trigger Behavior

| Scenario | Behavior |
|----------|----------|
| Buyer uploads new sample template | All pending requests without samples get the new sample |
| Buyer updates existing template | All pending requests without samples get updated sample |
| Request already has sample (manual upload) | Not affected - keeps existing sample |
| Request is submitted/approved/completed | Not affected - only pending requests updated |

### Edge Cases Handled

1. **Request with manually uploaded sample**: Preserved (condition `sample_file_path IS NULL`)
2. **Non-pending requests**: Not updated (condition `status = 'pending'`)
3. **Template deletion**: No action (trigger only on INSERT/UPDATE)
4. **Multiple buyers**: Scoped to specific `buyer_id`

---

## Summary

This solution ensures that when a buyer uploads a sample template, it automatically flows to all their pending document requests of that type. No frontend changes required - the database trigger handles everything transparently.

