
# Fix Upload Error Handling and Filename Sanitization

## Problem Summary

When suppliers try to upload files with special characters in the filename (like spaces), the upload fails with an "Invalid key" error that exposes internal storage paths and IDs - a security issue.

## Root Causes

1. **Unsanitized Filenames**: Files with spaces or special characters in their names cause Supabase Storage to reject the upload
2. **Raw Error Exposure**: The error message from Supabase is displayed directly to users, revealing internal storage structure and UUIDs

## Solution Overview

### 1. Sanitize Filenames Before Upload

Add a filename sanitization function that removes or replaces problematic characters before uploading to storage. This applies to:
- `CustomTemplateResponse.tsx` (template submissions)
- `DocumentUploadDialog.tsx` (standard document uploads)
- `FileUploadZone.tsx` (bulk upload zone)

### 2. Create User-Friendly Error Messages

Replace raw Supabase error messages with user-friendly alternatives that don't expose internal details.

## Technical Implementation

### Step 1: Create Utility Function for Filename Sanitization

Create a shared utility that:
- Removes or replaces spaces and special characters
- Preserves file extension
- Generates unique names to avoid collisions

```text
sanitizeFileName("Screenshot 2026-01-27 at 12.28.52 PM.png")
→ "screenshot_2026-01-27_at_12_28_52_pm.png"
```

### Step 2: Update CustomTemplateResponse.tsx

Current (line 244):
```javascript
const fileName = `${Date.now()}-${selectedFile.name}`;
```

Updated:
```javascript
const sanitizedName = sanitizeFileName(selectedFile.name);
const fileName = `${Date.now()}-${sanitizedName}`;
```

### Step 3: Add User-Friendly Error Handler

Create error message mapping that:
- Detects "Invalid key" errors and shows "Please rename your file to remove special characters"
- Never exposes internal paths, IDs, or storage structure
- Provides actionable guidance

```javascript
const getUploadErrorMessage = (error: any) => {
  const message = error?.message || '';
  
  if (message.includes('Invalid key')) {
    return 'Upload failed. Please rename your file to remove special characters (spaces, symbols) and try again.';
  }
  if (message.includes('Payload too large')) {
    return 'File is too large. Maximum file size is 50MB.';
  }
  if (message.includes('not allowed')) {
    return 'This file type is not supported. Please upload PDF, DOC, DOCX, XLS, XLSX, or image files.';
  }
  
  return 'Upload failed. Please try again or contact support if the issue persists.';
};
```

### Step 4: Apply to All Upload Components

| File | Changes |
|------|---------|
| `src/lib/utils.ts` | Add `sanitizeFileName` utility function |
| `src/components/supplier/CustomTemplateResponse.tsx` | Use sanitized filename, add friendly error messages |
| `src/components/supplier/DocumentUploadDialog.tsx` | Use sanitized filename, add friendly error messages |
| `src/components/uploads/FileUploadZone.tsx` | Use sanitized filename, add friendly error messages |

## Files to Modify

1. **src/lib/utils.ts** - Add `sanitizeFileName` and `getUploadErrorMessage` utilities
2. **src/components/supplier/CustomTemplateResponse.tsx** - Apply filename sanitization and error handling
3. **src/components/supplier/DocumentUploadDialog.tsx** - Apply filename sanitization and error handling
4. **src/components/uploads/FileUploadZone.tsx** - Apply filename sanitization and error handling

## Expected Outcome

After implementation:
- Files with any name (including spaces and special characters) will upload successfully
- If an upload fails, users see helpful messages like "Please rename your file..." instead of internal storage paths
- No internal IDs, paths, or infrastructure details are ever exposed in error messages
