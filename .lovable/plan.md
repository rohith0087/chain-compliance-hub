

# COA Results -- Calendar Filter & Supplier Search

## What We're Building

A polished filter bar above the Results list with two controls:
1. **Supplier Search** -- debounced text input that filters COA cards in real-time
2. **Calendar Popover** -- Shadcn Calendar in a Popover with colored status dots per date, clicking a date filters results to that day

## Layout

```text
┌─────────────────────────────────────────────────────┐
│  🔍 [Search for a supplier...        ]   📅 [icon] │  ← Filter Bar
├─────────────────────────────────────────────────────┤
│  (existing flags banner)                            │
│  (filtered COA result cards)                        │
└─────────────────────────────────────────────────────┘
```

- Search bar on the left (flex-1), calendar icon button on the right
- Calendar opens in a Popover on icon click
- Active date filter shown as a removable chip/badge next to the calendar icon
- "Clear filters" button appears when any filter is active

## Calendar Status Dots

For each date that has COA submissions, render a small colored dot below the day number:
- **Green** -- all COAs on that date passed
- **Yellow** -- minor issues (1-2 analyte failures across submissions)
- **Orange** -- moderate failures (3-5 analyte failures)
- **Red** -- majority/critical failures

Dots computed by grouping submissions by date, counting total failed analytes per date, then mapping to color thresholds.

## Technical Details

### File: `src/components/buyer/coa/COAResultsView.tsx`

**New state:**
- `searchQuery: string` -- supplier name filter
- `selectedDate: Date | undefined` -- calendar date filter

**Filter logic:**
```
filteredSubmissions = submissions
  .filter(s => s.supplier_name.toLowerCase().includes(searchQuery))
  .filter(s => !selectedDate || isSameDay(parseISO(s.submission_date), selectedDate))
```

**Calendar rendering:**
- Use Shadcn `Calendar` inside `Popover`/`PopoverContent`
- Add `pointer-events-auto` class per Shadcn datepicker guidelines
- Use `modifiers` and `modifiersClassNames` (or custom `components.DayContent`) to render colored dots
- Pre-compute a `Map<string, 'green'|'yellow'|'orange'|'red'>` from submissions data

**Search bar:**
- Simple `Input` with `Search` icon, no debounce needed for small dataset

**Active filter indicators:**
- When a date is selected, show a badge like "Feb 1, 2026 ×" next to the calendar
- When search is active, show the search text
- "Clear all" link when any filter active

### Dependencies
- `date-fns`: `isSameDay`, `format`, `parseISO` (already imported)
- Shadcn `Calendar`, `Popover`, `PopoverTrigger`, `PopoverContent` (already exist)
- `Input` component (already exists)
- Lucide: `Search`, `CalendarIcon`, `X`

### Files Modified
- `src/components/buyer/coa/COAResultsView.tsx` -- add filter bar, calendar popover, search input, filtering logic

