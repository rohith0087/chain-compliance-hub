

# Fix White Paper: Icons, Provider Names, and PDF Download

## Issues Found

1. **Provider names**: "GPT-4o Vision" appears on lines 361 and 449 -- needs to be replaced with generic "AI" language
2. **PDF download**: The "Download PDF" button (line 147) has no `onClick` handler -- does nothing
3. **Icon refresh**: The current icons are functional but the user wants them to feel less generic/AI-themed

## Changes

### 1. Remove Provider Names (WhitePaperPage.tsx)

- Line 361: `'GPT-4o Vision processes multi-page PDFs and DOCX files...'` → `'AI Vision extracts structured data from multi-page PDFs & DOCX files...'`
- Line 449: `'GPT-4o Vision extracts structured data from multi-page PDFs & DOCX'` → `'AI-powered extraction from multi-page PDFs & DOCX with 94% accuracy'`

### 2. Fix PDF Download

Add a `handleDownloadPdf` function using `window.print()` with a print-specific CSS media query approach. This captures the full styled page as a PDF without needing a heavy library like `@react-pdf/renderer` to rebuild the entire layout.

- Wire the "Download PDF" button's `onClick` to `window.print()`
- Add a `@media print` style block that hides the progress bar, buttons, and navigation while making the content full-width

### 3. Refresh Icons

Swap some icons to feel more product-specific and less generic:
- Section 02 pipeline step 02: `Brain` → `FileSearch` (document scanning vs generic AI brain)
- Section 04 risk factors: use more distinct icons -- `BarChart3` for trade sensitivity, `History` for recall history instead of repeating `Globe` and `AlertTriangle`
- Section 06 architecture: `Cpu` → `Server` for AI Agent Framework, `LineChart` → `Activity` for monitoring
- DataPointCard icons: vary more -- `Receipt` for cost cards, `Siren` for recall cards

### Files Modified
- `src/pages/WhitePaperPage.tsx` -- all three fixes in one file

