

# COA Overview Dashboard -- Fix Top Failing Analytes + Enterprise Polish

## Problems to Fix

### 1. Top Failing Analytes bar chart is ambiguous
- Bars show relative proportion (`total / maxAnalyteIssues * 100%`) but there's no axis label or scale -- user can't tell if bars represent count or severity
- Fix: Add an explicit x-axis label showing the count, and display the actual count number at the end of each bar. Replace the relative-width approach with a clear labeled horizontal bar chart

### 2. Missing temporal context (trending)
- KPI tiles are static snapshots with no month-over-month context
- Fix: Add small trend indicators (up/down arrows with % change) to each stat tile. Since we only have demo data, we'll generate synthetic "last period" values and show the delta

### 3. No global filtering
- No date range, region, or category filter for the overview
- Fix: Add a compact filter bar at the top with a date range selector and a supplier search/dropdown. Reuse the existing date range pattern from COAResultsView

## Implementation

### Top Failing Analytes (lines 166-208)
- Replace the current ambiguous bar with a proper horizontal bar that shows the **count** as a number label at the bar end
- Add a subtle x-axis caption: "Number of failures/flags across all COAs"
- Each bar gets the numeric count rendered inside or beside it
- Keep the fail/flag badge distinction

### Trend Indicators on Stat Tiles (lines 136-161)
- Add synthetic `prevPeriod` values (e.g., `totalSubmissions - 1`, `avgScore - 5`, etc.) for demo
- Show a small arrow + percentage next to each value:
  - Green up arrow = improvement
  - Red down arrow = decline
  - Gray dash = no change
- Use `ArrowUpRight` / `TrendingDown` icons (already imported)

### Filter Bar (new, above stat tiles)
- Compact row with:
  - Date range picker (reuse Popover + Calendar pattern)
  - Supplier dropdown/search (Select component with supplier list)
- When filters are active, all derived data (`failingAnalytes`, `supplierPerf`, `categoryBreakdown`, `criticalAlerts`, recent submissions) recalculate from filtered `submissions`

### Files Modified
- `src/components/buyer/coa/COAOverview.tsx` -- all changes in this single file

