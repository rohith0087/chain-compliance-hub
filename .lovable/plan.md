

# Fix "Key Risk Drivers" Bar Chart UI

## Problem
The progress bars all appear nearly full-width because the max scale is 20 but impacts range 4-12, making bars fill 20-60% — yet visually they look similar and give no sense of real data. The `bg-primary` (dark blue) indicator on `bg-secondary` track creates poor contrast, and there are no numeric scale markers to ground the visualization.

## Solution
Redesign the bars to be clearly proportional and data-precise:

1. **Dynamic max scale** -- use the highest impact in the current driver set (e.g., 12) as the bar max, so the top driver fills 100% and others are clearly proportional
2. **Color-coded bars by severity** -- instead of uniform `bg-primary` blue for all bars, use a gradient from red (high impact) → amber (medium) → green (low) to match the impact value
3. **Numeric labels on bars** -- show the impact number at the end of each bar so the exact value is readable without relying on the badge alone
4. **Thinner, more refined bars** -- keep `h-1.5` but add rounded segments and a lighter track color for better contrast
5. **Scale reference** -- add a subtle "0 → {max}" label beneath the bar section so users understand the axis

## Technical Details

Replace the `<Progress>` component with a custom Tailwind bar:
- Calculate `maxImpact = Math.max(...drivers.map(d => d.impact))` dynamically
- Bar width: `(d.impact / maxImpact) * 100%`
- Bar color: red for impact ≥ 8, amber for ≥ 5, green otherwise
- Add the count label inline at bar end

### File Modified
- `src/components/buyer/supplier-risk/KeyDrivers.tsx` -- single file change

