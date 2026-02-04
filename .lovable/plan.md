

# UI Color Update: Approved Documents to Professional Blue

## Overview

Update the approved document cards and summary modal to use a consistent professional blue color (`#003f88` / `hsl(217, 100%, 28%)`) instead of the current green accent, maintaining consistency with the application's existing blue color palette.

## Current State vs. Target State

| Element | Current Color | Target Color |
|---------|---------------|--------------|
| Approved card hover border | Green (`--green-accent`) | Blue (`#003f88`) |
| "Click to view summary" text | Green (`--green-accent`) | Blue (`#003f88`) |
| Summary modal header icon background | Green gradient | Blue gradient |
| Summary modal header icon | Green | Blue |
| Summary card background | Faded green gradient | Faded blue gradient |
| Summary card border | Green accent | Blue accent |
| AI Analyzed badge | Green | Blue |
| Approved badge in modal | Green | Blue |

## Color Strategy

To maintain consistency with the application's existing color palette, I'll use the `--blue-accent` CSS variable (`217 91% 60%`) which is already defined in the design system. For the specific `#003f88` blue requested, I'll add a new CSS variable `--professional-blue` that can be reused across the application.

**New CSS Variable:**
```css
--professional-blue: 217 100% 28%;  /* #003f88 equivalent in HSL */
```

## Technical Changes

### File 1: `src/index.css`

Add a new professional blue variable to the design system:

```css
/* In :root */
--professional-blue: 217 100% 28%;  /* #003f88 */
```

---

### File 2: `src/components/documents/DocumentCardWithSelection.tsx`

**Change 1: Hover ring on approved/clickable cards (line 199)**

```diff
- ${isClickable ? 'cursor-pointer hover:ring-1 hover:ring-[hsl(var(--green-accent))]/50' : ''}
+ ${isClickable ? 'cursor-pointer hover:ring-1 hover:ring-[#003f88]/50' : ''}
```

**Change 2: "Click to view summary" text color (line 423)**

```diff
- <span className="text-xs text-[hsl(var(--green-accent))] font-medium">
+ <span className="text-xs text-[#003f88] font-medium">
```

---

### File 3: `src/components/documents/ApprovedDocumentSummaryModal.tsx`

**Change 1: AI Analyzed badge styling (lines 266-269)**

```diff
case 'completed':
  return {
-   icon: <Sparkles className="h-4 w-4 text-[hsl(var(--green-accent))]" />,
+   icon: <Sparkles className="h-4 w-4 text-[#003f88]" />,
    label: 'AI Analyzed',
-   className: 'bg-[hsl(var(--green-accent))]/10 text-[hsl(var(--green-accent))] border-[hsl(var(--green-accent))]/30',
+   className: 'bg-[#003f88]/10 text-[#003f88] border-[#003f88]/30',
  };
```

**Change 2: Header icon container background (line 397)**

```diff
- <div className="w-12 h-12 bg-gradient-to-br from-[hsl(var(--green-accent))]/20 to-[hsl(var(--emerald-accent))]/20 rounded-xl flex items-center justify-center">
+ <div className="w-12 h-12 bg-gradient-to-br from-[#003f88]/15 to-[hsl(var(--blue-accent))]/15 rounded-xl flex items-center justify-center">
```

**Change 3: Header icon color (line 398)**

```diff
- <FileText className="h-6 w-6 text-[hsl(var(--green-accent))]" />
+ <FileText className="h-6 w-6 text-[#003f88]" />
```

**Change 4: Approved badge in header (line 410)**

```diff
- <Badge className="bg-[hsl(var(--green-accent))]/10 text-[hsl(var(--green-accent))] border-[hsl(var(--green-accent))]/30 border">
+ <Badge className="bg-[#003f88]/10 text-[#003f88] border-[#003f88]/30 border">
```

**Change 5: Summary card background and border (line 437)**

```diff
- <Card className="border-[hsl(var(--green-accent))]/30 bg-gradient-to-br from-[hsl(var(--green-accent))]/5 to-transparent">
+ <Card className="border-[#003f88]/30 bg-gradient-to-br from-[#003f88]/5 to-transparent">
```

---

## Visual Result

After these changes:
- **Document Card**: Hovering over an approved document will show a subtle professional blue (`#003f88`) border ring instead of green
- **Summary Link**: "Click to view summary →" text will be in the professional blue
- **Summary Modal Header**: The document icon will have a faded blue background with a blue icon
- **Approved Badge**: Will use blue tones instead of green
- **Summary Card**: Will have a subtle blue-tinted background that blends naturally with the application's overall blue theme

## Files to Modify

| File | Purpose |
|------|---------|
| `src/components/documents/DocumentCardWithSelection.tsx` | Card hover border + summary link text |
| `src/components/documents/ApprovedDocumentSummaryModal.tsx` | Modal header, badges, and summary card styling |

