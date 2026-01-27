
# Fix User Impersonation - Missing Company ID Data

## Problem Summary

The impersonation feature shows "Cannot Impersonate - This user doesn't have an associated company" even though:
- The user `rcrohith017@gmail.com` shows company name "SS" in the search results
- The user has a buyer record with `buyer_id: d52b3a3c-96ce-4529-b3a6-61ab8aa100fd`

## Root Cause

The `confirmImpersonate()` function in `SuperAdminClientSupport.tsx` looks for:
```javascript
const companyId = selectedUser.company_id || selectedUser.buyer_id || selectedUser.supplier_id;
```

But the `get_platform_admin_users()` RPC function only returns:
- `is_buyer` (boolean) ✓
- `is_supplier` (boolean) ✓
- `company_name` (from profiles table) ✓
- Does NOT return `buyer_id` or `supplier_id` ✗

Since none of these ID fields exist in the user data, `companyId` is `undefined`, and the impersonation is blocked.

## Solution

Update the `get_platform_admin_users()` database function to also return `buyer_id` and `supplier_id`, then update the frontend hook to map these new fields.

## Technical Changes

### 1. Database Migration: Update get_platform_admin_users()

Add two new columns to the return type:

```sql
-- Current columns (keep these):
id, email, full_name, roles, company_name, created_at, 
last_sign_in_at, is_buyer, is_supplier, subscription_status,
subscription_plan_type, subscription_end_date, available_credits,
total_purchased_credits, total_consumed_credits, stripe_customer_id,
stripe_subscription_id

-- New columns to add:
buyer_id uuid,
supplier_id uuid
```

Query changes:
```sql
(SELECT b.id FROM buyers b WHERE b.profile_id = p.id LIMIT 1) as buyer_id,
(SELECT s.id FROM suppliers s WHERE s.profile_id = p.id LIMIT 1) as supplier_id
```

### 2. Frontend: Update usePlatformAdmin.tsx

Update the `DetailedUser` interface to include:
```typescript
buyer_id: string | null;
supplier_id: string | null;
```

Update the mapping in `fetchAllUsers`:
```typescript
buyer_id: user.buyer_id || null,
supplier_id: user.supplier_id || null,
```

### 3. Frontend: Update SuperAdminClientSupport.tsx

The `confirmImpersonate()` function already handles these fields correctly:
```javascript
const companyId = selectedUser.company_id || selectedUser.buyer_id || selectedUser.supplier_id;
```

This will now work because `buyer_id` will be present in the user data.

## Files to Modify

1. **Database Migration** - New SQL migration to update `get_platform_admin_users()` function
2. **src/hooks/usePlatformAdmin.tsx** - Add `buyer_id` and `supplier_id` to interface and mapping

## Additional Fix: Company Name Discrepancy

Note: The user's profile has `company_name: "SS"` but their buyer record has `company_name: "7/11"`. This is a data inconsistency in the user's records. The impersonation will use the profile's company_name ("SS") for display, which is what's currently shown in the UI.

For better accuracy, we could also update the query to prefer the buyer/supplier company name over the profile company name:

```sql
COALESCE(
  (SELECT b.company_name FROM buyers b WHERE b.profile_id = p.id LIMIT 1),
  (SELECT s.company_name FROM suppliers s WHERE s.profile_id = p.id LIMIT 1),
  p.company_name
) as company_name
```

This ensures the displayed company name matches the actual buyer/supplier record.

## Testing After Implementation

1. Log in as platform admin (`rzg0087@auburn.edu`)
2. Navigate to Platform Admin Dashboard → Support Tickets
3. Search for `rcrohith017@gmail.com`
4. User should appear with company name "7/11" (from buyer record)
5. Click "Impersonate" → Should now work and redirect to their buyer dashboard
