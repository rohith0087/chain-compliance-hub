
# Fix User Impersonation Search - Not Returning Results

## Problem Summary

The User Impersonation search in the Platform Admin dashboard shows no results when searching for any user, even though those users exist in the database.

## Root Cause Analysis

There are **two critical issues** causing this:

### Issue 1: Role Mismatch Between Tables

The platform administrator (`rzg0087@auburn.edu`) has:
- `super_admin` role in **platform_administrators.platform_roles** array ✓
- Only `supplier` role in the **user_roles** table ✗

But the `get_all_users_detailed` RPC function checks `has_role(auth.uid(), 'super_admin')` which queries the **user_roles** table, not the **platform_administrators** table.

This causes the RPC call to fail with "Unauthorized: Only super admins can access this function".

### Issue 2: Incorrect Super Admin Detection in Hook

The `useSuperAdmin` hook (used by `SuperAdminClientSupport`) checks:
```javascript
const isSuperAdmin = user?.user_metadata?.roles?.includes('super_admin') || false;
```

This checks auth `user_metadata`, not the `platform_administrators` table. If this returns `false`, the hook never fetches users at all.

### Why the Search Shows Nothing

Since the authorization check fails, the `users` array in the component is empty. The search filter simply filters an empty array, hence no results appear.

## Solution Options

### Option A: Modify has_role Function (Recommended)
Extend the `has_role` function to also check `platform_administrators` table for super_admin/platform_admin roles. This provides a single source of truth.

### Option B: Create Platform Admin-Specific RPC
Create a new `get_all_users_for_platform_admin` function that checks the `platform_administrators` table instead of `user_roles`.

### Option C: Sync Roles to user_roles Table
When a user becomes a platform administrator with super_admin role, also insert a corresponding row in `user_roles`. Requires keeping both tables in sync.

## Recommended Implementation (Option A + Hook Fix)

### 1. Database: Update has_role Function

Modify the `has_role` function to check both tables:

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check user_roles table
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
  OR (
    -- Also check platform_administrators for super_admin/platform_admin
    _role IN ('super_admin', 'platform_admin')
    AND EXISTS (
      SELECT 1
      FROM public.platform_administrators
      WHERE auth_user_id = _user_id
        AND is_active = true
        AND _role::text = ANY(platform_roles::text[])
    )
  )
$$;
```

### 2. Frontend: Fix SuperAdminClientSupport to Use Platform Admin Data

The component currently uses `useSuperAdmin` which relies on `user_metadata`. We need to either:

**Option 2A**: Update `SuperAdminClientSupport` to use `usePlatformAdmin` instead (which correctly checks `platform_administrators` table and uses `get_platform_admin_users` RPC)

**Option 2B**: Update `useSuperAdmin` hook to also check `platform_administrators` table

Option 2A is cleaner since `usePlatformAdmin` already has proper platform admin detection.

### 3. Files to Modify

1. **Database Migration**: New SQL migration to update `has_role` function
2. **SuperAdminClientSupport.tsx**: Replace `useSuperAdmin` with `usePlatformAdmin` hook

## Implementation Details

### SuperAdminClientSupport.tsx Changes

Replace:
```javascript
const { users, loading: usersLoading } = useSuperAdmin();
```

With:
```javascript
const { users, loading: usersLoading } = usePlatformAdmin();
```

This uses the `get_platform_admin_users` RPC function which:
- Checks `platform_administrators` table for authorization
- Returns all users with proper details for impersonation
- Already works for the logged-in platform admin

### User Data Structure Alignment

The `DetailedUser` interface from `usePlatformAdmin` has slightly different fields than `useSuperAdmin`. The impersonation logic needs fields like:
- `id` - user's profile ID
- `email` - user's email
- `full_name` - user's display name
- `company_name` - associated company
- `company_type` or `user_type` - buyer/supplier distinction

Both hooks provide these fields, so the impersonation logic should work.

### Additional Company Data

The impersonation flow needs `company_id` and `company_type`. Currently, the search results may not have complete company information. We should also ensure the `get_platform_admin_users` function or a supplementary query provides:
- `buyer_id` (if user is a buyer)
- `supplier_id` (if user is a supplier)
- `company_type` ('buyer' or 'supplier')

## Testing After Implementation

1. Log in as platform admin (`rzg0087@auburn.edu`)
2. Navigate to Platform Admin Dashboard → Support Tickets
3. Search for `rcrohith017@gmail.com` in User Impersonation section
4. Should now see the user with their company information
5. Click Impersonate to start impersonation session

## Risk Assessment

- **Low Risk**: Changing `has_role` function is additive - it adds an additional check without removing existing functionality
- **Medium Risk**: Switching hooks in component - ensure all expected fields are present in the data
