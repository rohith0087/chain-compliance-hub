
# Fix: Backfill Edge Function Platform Admin Check

## Root Cause

The `backfill-buyer-document-content` edge function is checking the **wrong table** for platform admin status:

| Current (Broken) | Correct |
|------------------|---------|
| `profiles.is_platform_admin` | `platform_administrators.is_active` |
| `profiles.id` | `platform_administrators.auth_user_id` |

The `is_platform_admin` column doesn't exist in the `profiles` table at all. The actual platform admin data is stored in a separate `platform_administrators` table with:
- `auth_user_id` - the UUID of the authenticated user
- `is_active` - whether the admin account is active
- `platform_roles` - array of roles like `['super_admin']`

## Evidence

1. **Edge Function Logs** show `POST | 403` - "Platform admin access required"
2. **Database Schema** confirms `profiles` table has NO `is_platform_admin` column
3. **Frontend Hook** (`usePlatformAdmin.tsx`) correctly uses `platform_administrators` table

## The Fix

Update the platform admin check in `backfill-buyer-document-content/index.ts` to query the correct table:

**Before (lines 62-72):**
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('is_platform_admin')
  .eq('id', userData.user.id)
  .single();

if (!profile?.is_platform_admin) {
  return new Response(
    JSON.stringify({ error: 'Platform admin access required' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**After:**
```typescript
const { data: adminRecord } = await supabase
  .from('platform_administrators')
  .select('id, is_active, platform_roles')
  .eq('auth_user_id', userData.user.id)
  .eq('is_active', true)
  .single();

if (!adminRecord) {
  return new Response(
    JSON.stringify({ error: 'Platform admin access required' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/backfill-buyer-document-content/index.ts` | Update platform admin check to use `platform_administrators` table |

## Additional CORS Header Update

While fixing this, I'll also update the CORS headers to include all standard Supabase headers to prevent any future CORS issues:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

## Deployment

After the fix, the edge function will be redeployed and you can retry the backfill from the Platform Admin dashboard.
