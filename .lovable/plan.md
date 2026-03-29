

# COA Analysis Overview -- Rich Dashboard Redesign

## Current State
The Overview tab shows 6 simple stat tiles (Total COAs, Passed, Failed, Total Flags, Avg Score, Overdue). It's functionally correct but provides no analytical depth -- a COA analyst gets no actionable insights from it.

## What a COA Analyst Actually Needs

A quality/compliance analyst reviewing COAs daily wants to see at a glance:
1. **Which analytes are failing most** -- so they can address root causes with suppliers
2. **Which suppliers are problematic** -- pass/fail/partial breakdown per supplier
3. **Category risk heatmap** -- are failures concentrated in Micro, Heavy Metals, or Allergens?
4. **Recent submission timeline** -- trend of scores over time
5. **Critical alerts** -- Salmonella/Listeria detections, scores below 50, overdue schedules
6. **Score distribution** -- how many COAs fall in each quality band

## Plan

Rebuild `COAOverview.tsx` into a multi-section dashboard using data already available in `demoSubmissions`, `demoSchedules`, and `demoSpecs`. No new data fetching needed -- just smarter presentation of existing data.

### Layout (below the existing stat tiles row)

**Row 1: Two columns**
- **Left -- "Top Failing Analytes"**: Horizontal bar chart showing which analytes have the most failures/flags across all submissions (e.g., Lead: 2 fails, Gluten: 1 fail, Salmonella: 1 critical). Built with simple CSS bars, no charting library needed.
- **Right -- "Supplier Performance"**: Table with supplier name, COA count, pass rate ring (reuse `COAScoreCard`), last submission date, and trend indicator.

**Row 2: Two columns**
- **Left -- "Category Breakdown"**: Cards for Microbiological / Heavy Metals / Allergens showing pass/fail/flag counts per category with color-coded progress bars.
- **Right -- "Critical Alerts"**: A list of actionable items -- critical pathogen detections, scores <50, overdue schedules, lead exceedances >2x limit. Each with severity badge and link context.

**Row 3: Full width**
- **"Recent Submissions Timeline"**: Simple timeline/table showing last N submissions with score ring, supplier, product, date, and pass/fail badge. More useful than a chart for small data sets.

### Technical Details
- All data derived from existing `demoSubmissions` and `demoSchedules` arrays (with live data fallback already in place)
- Reuse `COAScoreCard` for score rings
- Use existing Card/CardContent components
- Use Tailwind for bar charts (no library dependency)
- Keep the top 6 stat tiles as-is, add sections below

### Files Modified
- `src/components/buyer/coa/COAOverview.tsx` -- expand from 47 lines to ~300 lines with new sections

