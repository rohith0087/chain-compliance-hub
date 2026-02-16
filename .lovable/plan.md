

# Supplier Risk Assessment Page (Static Demo)

## Overview

Add a new **"Supplier Risk"** submenu item under the existing **Compliance** section in the buyer sidebar. This renders a fully static, production-looking Supplier Risk Assessment page with rich demo data, charts, modals, and interactive elements -- all without any backend calls.

## Navigation Integration

Add a new entry `supplier-risk` to the Compliance submenu in the sidebar, and render the new component in the BuyerDashboard tab switch.

**Files to modify:**
- `src/components/buyer/BuyerSidebarLayout.tsx` -- add `{ title: 'Supplier Risk', value: 'supplier-risk', icon: ShieldAlert }` to the Compliance submenu
- `src/components/BuyerDashboard.tsx` -- import and render the new component when `activeTab === 'supplier-risk'`
- `src/components/buyer/CommandPaletteSearch.tsx` -- add the new page to search results

## New Files to Create

### Main Page Component
`src/components/buyer/supplier-risk/SupplierRiskAssessment.tsx`

The top-level page with:
- Breadcrumb: Compliance > Supplier Risk > [Supplier Name]
- Supplier dropdown selector (3 demo suppliers)
- Status badges (Connected, Monitoring ON, Last refresh)
- Action buttons (Request Details, Export PDF, Share, Report Issue)
- Two-column layout: left = main content, right = sidebar

### Sub-Components (all in `src/components/buyer/supplier-risk/`)

| Component | Purpose |
|-----------|---------|
| `riskData.ts` | All static demo data for 3 suppliers |
| `RiskScoreHero.tsx` | Large score card with donut chart (recharts), trend line, breakdown chips, industry selector, "Explain score" collapsible |
| `KeyDrivers.tsx` | Top risk drivers with impact bars, confidence badges, source tooltips |
| `SignalsSection.tsx` | Tabbed section: News & Trade Signals, Recalls & Regulatory, Web Presence. Includes skeleton shimmer effect |
| `DocumentRiskSection.tsx` | Document checklist with status badges and subscore |
| `ModelTuningPanel.tsx` | Toggle for default weights, sliders for factor tuning, fake "Recalculate" animation |
| `SupplierProfileSidebar.tsx` | Right sidebar: profile card, monitoring sources, next refresh, action buttons |
| `RequestDetailsModal.tsx` | 3-step stepper modal for requesting supplier details (Operations, Quality & Compliance, Risk & Resilience) |

## Demo Data (3 Suppliers)

```text
1. BlueRiver Co-Packers   | Food & Beverage | Score 73 (High)   | China + Mexico
2. NorthPeak Packaging     | Packaging       | Score 61 (Medium) | Domestic US
3. GreenField Ingredients  | Ingredients     | Score 38 (Low)    | US + Canada
```

Each supplier has unique: risk drivers, news feed items, recall history, questionnaire answers, and document statuses.

## Section Details

### 1. Risk Score Hero
- Donut chart (recharts PieChart) showing score out of 100, color-coded (red/amber/green)
- Small sparkline trend chart showing last 7 days
- Breakdown chips: Document Risk, Operational Risk, Regulatory Risk, Market/Geo Risk, Reputation Risk
- "ML model + industry tuned factors" label
- Industry selector dropdown (read-only display)
- Collapsible "Explain score" with bullet points

### 2. Key Drivers
- Sorted list of top factors driving the score
- Each row: description, impact badge (+N points), confidence pill (High/Med/Low), source tooltip icon
- Progress bar showing relative impact

### 3. Real-time Signals (3 tabs)
- **News & Trade Signals**: Card feed with headline, source, timestamp, tags, risk impact, reason sentence. Includes the US-China tariff corner case example
- **Recalls & Regulatory**: Cards from FDA/CPSC/USDA with event type, date, severity, status
- **Web Presence**: Litigation mentions, ESG signals, turnover signals with confidence levels
- Top shimmer/skeleton loader for "Refreshing..." visual

### 4. Request Details Modal
- 3-step stepper UI using existing Shadcn components
- Pre-filled sample answers shown on the page as "last submitted" preview card
- "Send request" button shows success toast

### 5. Model Tuning
- Toggle switch: "Use default industry weights"
- When OFF: Shadcn Slider components for 5 factors
- "Recalculate" button triggers a fake animation (score number rolls to a slightly different value)
- Note about ML model vs static rules

### 6. Document Risk
- Compact checklist table: document name, status badge (Approved/Pending/Expired), expiry date
- Subscore display: "22/100"

### 7. Supplier Profile Sidebar
- Card with supplier name, HQ, industry, facilities count, connected date
- Monitoring sources list with badges (FDA, CPSC, public recalls, sanctions, news)
- "Next refresh in: 48 minutes"
- Action buttons: Set alerts, Manage thresholds, Download report

## Visual Polish
- Modern cards with subtle shadows using existing Card components
- Skeleton loaders in the signals section
- Recharts for donut chart and trend sparkline (already installed)
- Generous use of Lucide icons and Shadcn badges
- Responsive two-column layout (stacks on mobile)
- Consistent with the app's existing blue-themed color palette
- Empty state for GreenField Ingredients news tab ("No news found in last 30 days")

## Technical Notes

- All data is static/hardcoded in `riskData.ts` -- no Supabase queries
- Uses existing UI components: Card, Badge, Tabs, Tooltip, Dialog, Slider, Switch, Collapsible, ScrollArea, Select, Progress
- Charts use `recharts` (already installed)
- Animations use `framer-motion` (already installed)
- No new dependencies needed

