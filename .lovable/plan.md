

# Fix Key Risk Drivers Progress Bars

## Problem

The progress bars in the Key Risk Drivers section all appear to be full/nearly full across all 3 suppliers. This is because the current code calculates the bar width relative to the highest driver impact for that supplier (`maxImpact`), making the top driver always 100% and others proportionally close on a thin bar.

For BlueRiver (impacts: 12, 10, 8, 6, 4), the bars show: 100%, 83%, 67%, 50%, 33% -- but on a thin `h-1.5` bar with similar colors, they all look nearly identical.

## Solution

Use a **fixed absolute scale of 20 points** (the maximum possible weight from the Model Tuning sliders) instead of a dynamic `maxImpact`. This makes bars proportional to an absolute maximum, creating clear visual differentiation:

- +12 = 60% filled
- +10 = 50% filled
- +8 = 40% filled
- +6 = 30% filled
- +4 = 20% filled

## File to Modify

**`src/components/buyer/supplier-risk/KeyDrivers.tsx`** (line 16)

Replace:
```typescript
const maxImpact = Math.max(...drivers.map(d => d.impact));
```

With:
```typescript
const maxImpact = 20; // Fixed scale matching max tuning weight
```

This single-line change fixes the visual issue for all 3 suppliers.
