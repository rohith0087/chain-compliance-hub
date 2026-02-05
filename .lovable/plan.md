# ✅ COMPLETED: Fix PDF and DOCX Document Parsing

**Implemented:** 2026-02-05

## Changes Made

1. **PDF Parsing**: Replaced `pdfjs-dist` with `unpdf` library for Deno compatibility
2. **DOCX Parsing**: Added JSZip to properly extract text from DOCX XML structure
3. **Error Messages**: Improved user-facing messages, detecting AI "apology" responses

PDF and DOCX files now parse correctly. Images continue to work as before.
