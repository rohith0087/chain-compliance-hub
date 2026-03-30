

# Supplier Risk -- Download Report (PDF)

## What We're Building

Wire the "Download Report" button (sidebar) and "Export PDF" button (header) to generate a detailed, professional PDF report for the currently selected supplier. The PDF includes all risk data, is timestamped, and shows the downloading user's name.

## PDF Content Layout

```text
Page 1: Cover + Summary
─────────────────────────
  Company logo area / title
  "Supplier Risk Assessment Report"
  Supplier: BlueRiver Co-Packers
  Generated: March 30, 2026 at 12:12 PM
  Downloaded by: John Smith (john@company.com)
  ─────────────────
  Risk Score: 73/100 (High Risk)
  Trend: +8 pts (last 7 days)
  Risk Breakdown table (5 categories)
  Score Explanation bullets

Page 2: Key Risk Drivers + Signals
─────────────────────────
  Key Risk Drivers table (description, impact, confidence, source)
  News Signals (headline, source, timestamp, impact)
  Web Intelligence Signals

Page 3: Regulatory & Documents
─────────────────────────
  Recall History table
  Document Compliance table (name, status, expiry)
  Document Risk Subscore

Page 4: Supplier Profile & Questionnaire
─────────────────────────
  Profile info (HQ, industry, facilities)
  Operations Q&A table
  Quality Q&A table
  Risk & Resilience Q&A table
  Monitoring sources
```

## Technical Approach

- Use **jsPDF** + **jspdf-autotable** for PDF generation (install both)
- Generate client-side on button click
- Get current user from `useAuth()` hook for the "downloaded by" field
- Use `new Date()` for timestamp
- Color-code risk levels in tables (red/amber/green backgrounds)
- Auto-download as `{SupplierName}_Risk_Report_{date}.pdf`

## Implementation

### 1. New utility: `src/utils/generateSupplierRiskPDF.ts`
- Accepts `SupplierRiskProfile` + `userName` + `userEmail`
- Builds multi-page PDF with:
  - Cover page with title, supplier name, timestamp, user info
  - Risk score section with breakdown table
  - Key drivers table with color-coded impact bars
  - News/web signals section
  - Recalls table
  - Documents table with status coloring
  - Questionnaire data tables
- Uses jspdf-autotable for clean table rendering

### 2. Update `SupplierProfileSidebar.tsx`
- Import `useAuth` and the PDF generator
- Wire "Download Report" button onClick to call the generator

### 3. Update `SupplierRiskAssessment.tsx`
- Wire "Export PDF" button onClick to call the same generator

### Dependencies
- `jspdf` + `jspdf-autotable` (npm install)

### Files Modified
- **New**: `src/utils/generateSupplierRiskPDF.ts`
- **Edit**: `src/components/buyer/supplier-risk/SupplierProfileSidebar.tsx`
- **Edit**: `src/components/buyer/supplier-risk/SupplierRiskAssessment.tsx`

