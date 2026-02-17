
# Swap Quick Actions & Recent Activity + Update Buttons

## What changes

In `src/components/dashboard/ActivityQuickActionsPanel.tsx`:

1. **Swap layout order**: Move the Quick Actions card to the top (first in the JSX), and the Recent Activity feed to the bottom. Quick Actions becomes `flex-shrink-0` (fixed height) and Recent Activity becomes `flex-1` (fills remaining space with scroll).

2. **Update two buttons**:
   - "Invite Supplier" becomes **"COA Analysis"** with a `FlaskConical` icon, navigating to `onNavigateToTab('coa-analysis')` (points to the COA Analysis sub-tab under Requests & Documents)
   - "Messages" becomes **"Supplier Risk"** with a `ShieldAlert` icon, navigating to `onNavigateToTab('supplier-risk')` (points to Supplier Risk under Compliance)

3. **Icon imports**: Replace `UserPlus` and `MessageSquare` with `FlaskConical` and `ShieldAlert` from lucide-react. Update button colors to match the new actions.

## File to modify

**`src/components/dashboard/ActivityQuickActionsPanel.tsx`**

- Lines 164-168: Update the `quickActions` array entries
- Lines 5-16: Update icon imports
- Lines 171-247: Swap the order of the two Card blocks (Quick Actions card first, Activity Feed card second)

No other files need changes.
