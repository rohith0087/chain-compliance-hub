
# Fix Impersonation - Missing Navigation and Data

## Problem Summary

When a super admin impersonates a user, two issues occur:
1. **No data is displayed** - Dashboard shows 0 for all metrics
2. **Missing navigation** - Only "Quick Actions" and "Messages" appear in the sidebar

## Root Causes

### 1. Early Return in BuyerDashboard.tsx

When `impersonatedBuyerId` is present, the code fetches the buyer profile but exits early before loading metrics:

```javascript
if (impersonatedBuyerId) {
  const { data: buyer } = await supabase
    .from('buyers')
    .select('*')
    .eq('id', impersonatedBuyerId)
    .single();
  
  setBuyerProfile(buyer);
  setCompanyId(impersonatedBuyerId);
  return; // ← EARLY EXIT - stats never loaded!
}
```

### 2. Permissions Not Impersonation-Aware

The `useCompanyUserRole` hook checks ownership using the currently authenticated user's ID (super admin), not the impersonated user's ID:

```javascript
const { user } = useAuth(); // ← Super admin's user
// ...
.eq('profile_id', user.id) // ← Checks super admin's ID, not impersonated user
```

Since the super admin isn't the owner of the impersonated company, all permission checks fail.

## Solution

### Fix 1: Load Dashboard Stats When Impersonating

Modify the `fetchDashboardData` function to NOT return early when impersonating. Instead, proceed to load the dashboard metrics using the impersonated buyer ID.

**File:** `src/components/BuyerDashboard.tsx`

**Change:** Remove the early `return;` and restructure to continue loading stats with `impersonatedBuyerId` as the effective buyer ID.

### Fix 2: Grant Full Permissions During Impersonation

For super admins who are actively impersonating, bypass normal permission checks and treat them as if they have full owner access to the impersonated company.

**File:** `src/hooks/useCompanyUserRole.tsx`

**Change:** Add impersonation context check. When impersonating and the company ID matches the impersonated company, automatically grant owner-level permissions.

### Fix 3: Update Sidebar Company ID Resolution

The sidebar resolves company ID using the authenticated user's profile. During impersonation, it should use the impersonated company ID instead.

**File:** `src/components/buyer/BuyerSidebarLayout.tsx`

**Change:** Add impersonation awareness to the company ID resolution logic.

## Implementation Details

### Step 1: Fix BuyerDashboard.tsx - Load Stats for Impersonation

Remove the early return and use impersonatedBuyerId for metric queries:

```javascript
const fetchDashboardData = async () => {
  let effectiveBuyerId = impersonatedBuyerId;
  
  // If impersonating, use the impersonated buyer ID directly
  if (impersonatedBuyerId) {
    const { data: buyer } = await supabase
      .from('buyers')
      .select('*')
      .eq('id', impersonatedBuyerId)
      .single();
    
    setBuyerProfile(buyer);
    setCompanyId(impersonatedBuyerId);
    // REMOVED: return; - Continue to load stats
  } else {
    // Normal flow for non-impersonation
    // ... existing team member / owner logic
    effectiveBuyerId = teamMember?.company_id || buyer?.id;
  }

  // Load dashboard stats
  if (effectiveBuyerId) {
    // ... existing metric queries using effectiveBuyerId
  }
};
```

### Step 2: Fix useCompanyUserRole.tsx - Impersonation Permissions

Add impersonation context check at the start:

```javascript
import { useImpersonation } from '@/contexts/ImpersonationContext';

export const useCompanyUserRole = (companyId?: string, companyType?: 'buyer' | 'supplier') => {
  const { user } = useAuth();
  const { isImpersonating, impersonatedCompany } = useImpersonation();
  const [role, setRole] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // When impersonating, grant owner permissions if viewing impersonated company
    if (isImpersonating && impersonatedCompany) {
      if (companyId === impersonatedCompany.id && companyType === impersonatedCompany.type) {
        setRole('company_admin');
        setIsOwner(true);
        setLoading(false);
        return;
      }
    }
    
    // Normal permission checks
    if (user && companyId && companyType) {
      fetchUserRole();
    } else {
      setRole(null);
      setIsOwner(false);
      setLoading(false);
    }
  }, [user, companyId, companyType, isImpersonating, impersonatedCompany]);
  
  // ... rest of hook
};
```

### Step 3: Fix BuyerSidebarLayout.tsx - Impersonation-Aware Company ID

Update the company ID resolution to use impersonated company when applicable:

```javascript
const { isImpersonating, impersonatedCompany } = useImpersonation();

useEffect(() => {
  const resolveCompanyId = async () => {
    // During impersonation, use the impersonated company ID directly
    if (isImpersonating && impersonatedCompany?.type === 'buyer') {
      setResolvedCompanyId(impersonatedCompany.id);
      return;
    }
    
    // Normal resolution for non-impersonation
    if (!profile?.id) return;
    // ... existing logic
  };
  
  resolveCompanyId();
}, [profile?.id, buyerProfile?.id, isImpersonating, impersonatedCompany]);
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/BuyerDashboard.tsx` | Remove early return, load stats during impersonation |
| `src/hooks/useCompanyUserRole.tsx` | Grant owner permissions during impersonation |
| `src/components/buyer/BuyerSidebarLayout.tsx` | Use impersonated company ID for resolution |
| `src/components/supplier/SupplierSidebarLayout.tsx` | Same changes for supplier side |
| `src/hooks/useCompanyBranches.tsx` | Add impersonation awareness (if needed) |

## Testing After Implementation

1. Log in as platform admin (`rzg0087@auburn.edu`)
2. Navigate to Platform Admin Dashboard → Support Tickets
3. Search for `rcrohith017@gmail.com`
4. Click "Impersonate"
5. **Expected results:**
   - Full navigation sidebar visible (Dashboard, Suppliers, Requests & Documents, Compliance, etc.)
   - Dashboard metrics show actual data (suppliers count, active requests, etc.)
   - All tabs and features accessible as if viewing as the company owner
6. Click "End Impersonation" in banner to return to admin view
