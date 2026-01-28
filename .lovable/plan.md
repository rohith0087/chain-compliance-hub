
# Rename "Upload Document" Button to "Submit Document"

## Summary

Change the submit button text in the document upload dialog from "Upload Document" to "Submit Document" to reduce user confusion. Users are currently clicking the disabled "Upload Document" button expecting something to happen, not realizing they need to select a file first. Renaming to "Submit Document" makes it clearer that this is the final submission action.

## Changes

**File:** `src/components/supplier/DocumentUploadDialog.tsx`

| Line | Current Text | New Text |
|------|-------------|----------|
| 851 | `'Uploading...'` | `'Submitting...'` |
| 858 | `'Upload Document'` | `'Submit Document'` |

## What Stays the Same

- All existing logic remains unchanged
- The button is still disabled until a file is selected
- The Upload icon stays the same
- Resubmission text ("Resubmit Document", "Resubmitting...") remains unchanged
- "Update Metadata" text remains unchanged
