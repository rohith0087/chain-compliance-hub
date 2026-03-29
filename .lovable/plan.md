

# COA Results -- Analyte Actions (False Positive + Notes) and Notes Tab

## What We're Building

Three connected features:

### 1. Clickable Analyte Rows with Action Dialog
When a user clicks any analyte row in the `COAComparisonTable`, a polished dialog opens with two actions:
- **Mark as False Positive** -- toggle button that visually marks the analyte as overridden (e.g., agent flagged it as "fail" but user confirms it's actually fine)
- **Add Note** -- text area to attach a note explaining the override or any observation

The dialog shows the analyte context (name, raw value, spec range, current status) at the top so the user knows exactly what they're annotating.

### 2. Visual Indicators on Overridden Analytes
After marking false positive:
- The row gets a subtle visual change (e.g., strikethrough on the flag reason, a small "Overridden" badge)
- The status icon changes to a distinct icon (e.g., `ShieldCheck` in a muted blue) to distinguish from a normal pass

### 3. Notes Tab (icon beside calendar)
- A `StickyNote` icon button next to the calendar icon in the filter bar
- Opens a popover/panel showing all notes across submissions
- Each note entry shows: analyte name, supplier, date, note text, whether it was a false positive override
- Serves as a running audit log of analyst decisions

## Dialog Design

```text
┌──────────────────────────────────────────────┐
│  Analyte Review                          [×] │
├──────────────────────────────────────────────┤
│                                              │
│  Analyte:    Gluten                          │
│  Value:      25 ppm  |  Spec Max: 20 ppm    │
│  Status:     ● Fail                          │
│  Method:     R5_ELISA                        │
│                                              │
│  ─────────────────────────────────────────── │
│                                              │
│  [ ] Mark as False Positive                  │
│      "The AI flagged this incorrectly.       │
│       This override will be recorded."       │
│                                              │
│  Note (optional)                             │
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│              [Cancel]  [Save Review]         │
└──────────────────────────────────────────────┘
```

Clean, minimal -- no gradients, no excessive color. Uses existing Shadcn Dialog, Checkbox, Textarea, Button.

## Technical Details

### State Management
- Use React `useState` in `COAResultsView` to hold a `Map<string, AnalyteNote>` keyed by `{submissionId}:{analyteId}`
- `AnalyteNote = { isFalsePositive: boolean; note: string; timestamp: string; supplierName: string; analyteName: string; submissionDate: string }`
- This is client-side for now (demo data); structure ready for Supabase persistence later

### Files Modified
- **`src/components/buyer/coa/COAComparisonTable.tsx`** -- make rows clickable, accept `onAnalyteClick` callback, show override indicators
- **`src/components/buyer/coa/COAResultsView.tsx`** -- add notes state, Notes icon button with popover, pass callbacks to table
- **New: `src/components/buyer/coa/AnalyteReviewDialog.tsx`** -- the review/override dialog component
- **New: `src/components/buyer/coa/COANotesPanel.tsx`** -- the notes popover panel listing all notes

### No changes to
- `coaDemoData.ts` types (notes are separate overlay state, not part of analyte data)
- Calendar or search logic

