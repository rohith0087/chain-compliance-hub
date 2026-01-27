

# Super Admin Account Impersonation Feature

## Overview

This feature allows super administrators to access and view any buyer or supplier account in the system without needing their login credentials. This is essential for customer support, debugging issues, and understanding user experiences.

## Current State Analysis

The system already has:
- **Super Admin Dashboard** at `/super-admin` with user management, analytics, and client support
- **Partial Impersonation UI** in `SuperAdminClientSupport.tsx` that shows a confirmation dialog but only displays a toast message (no actual functionality)
- **User Context System** via `useUserContexts` hook that manages which company a user is viewing
- **Platform Administrators Table** storing super admin credentials and roles
- **Audit Logging** via `auth_audit_logs` for login/logout events

## Implementation Approach

### Architecture Decision: Session-Based Impersonation

Rather than creating a full authentication impersonation (which would require Supabase Admin API access and pose security risks), we'll implement a **context-based impersonation** system:

1. Super admin remains logged in as themselves (maintaining full super admin privileges)
2. A special "impersonation context" is activated that makes the UI behave as if they're the target user
3. All actions during impersonation are logged with both the super admin ID and the impersonated user ID
4. A persistent banner shows when impersonation is active with the ability to exit

### Security Considerations

- All impersonation sessions will be logged in a dedicated `impersonation_logs` table
- RLS policies will allow super admins to view data across all companies when impersonating
- Edge functions will detect impersonation context and log accordingly
- Clear visual indicators will prevent confusion between real and impersonated sessions

---

## Technical Implementation

### 1. Database Changes

**New Table: `impersonation_logs`**

```text
┌─────────────────────────────────────────────────────┐
│                 impersonation_logs                  │
├─────────────────────────────────────────────────────┤
│ id (uuid, PK)                                       │
│ super_admin_id (uuid, FK → auth.users)              │
│ impersonated_user_id (uuid, FK → profiles)          │
│ impersonated_company_id (uuid)                      │
│ impersonated_company_type (text: buyer/supplier)    │
│ started_at (timestamp)                              │
│ ended_at (timestamp, nullable)                      │
│ ip_address (text)                                   │
│ user_agent (text)                                   │
│ metadata (jsonb)                                    │
└─────────────────────────────────────────────────────┘
```

**New RLS Policies**

- Super admins can view all data from buyers/suppliers tables when impersonating
- Add helper function `is_impersonating()` to check current impersonation status

### 2. Frontend Context: Impersonation Provider

**New File: `src/contexts/ImpersonationContext.tsx`**

A React context that manages:
- `isImpersonating`: boolean flag
- `impersonatedUser`: the user being impersonated
- `impersonatedCompany`: the company context
- `startImpersonation(userId, companyId, companyType)`: begin impersonation
- `endImpersonation()`: stop impersonation
- `originalSuperAdmin`: preserved super admin identity

### 3. Updated Components

**SuperAdminClientSupport.tsx**

Modify the existing `confirmImpersonate` function to:
1. Call the impersonation context's `startImpersonation` method
2. Navigate to the appropriate dashboard (buyer or supplier)
3. Log the impersonation start event

**New Component: `ImpersonationBanner.tsx`**

A fixed banner at the top of the screen showing:
- "You are viewing as [User Name] from [Company Name]"
- "Exit Impersonation" button
- Visual distinction (orange/yellow background)

**BuyerDashboard.tsx / SupplierDashboard.tsx**

Integrate with impersonation context to:
- Use impersonated company ID when fetching data
- Show the impersonation banner
- Prevent certain destructive actions during impersonation

### 4. Hook Updates

**useCompanySetup.tsx**

Add impersonation awareness:
```
const { isImpersonating, impersonatedCompany } = useImpersonation();
const effectiveCompanyId = isImpersonating 
  ? impersonatedCompany.id 
  : normalCompanyId;
```

**useUserContexts.tsx**

Add support for impersonation mode that overrides normal context selection

### 5. Edge Function: Log Impersonation

**New Edge Function: `log-impersonation/index.ts`**

Records impersonation start/end events with:
- Super admin details
- Target user/company details
- Timestamp and duration
- IP address and user agent

### 6. Super Admin Dashboard Enhancement

**New Tab: "Active Impersonations"**

Shows currently active impersonation sessions across all super admins for security monitoring.

---

## User Flow

```text
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Super Admin    │────▶│  Client Support Tab  │────▶│  Search & Select    │
│  Dashboard      │     │  (existing)          │     │  User to Impersonate│
└─────────────────┘     └──────────────────────┘     └──────────┬──────────┘
                                                                 │
                                                                 ▼
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Return to      │◀────│  Click "Exit         │◀────│  Confirmation       │
│  Super Admin    │     │  Impersonation"      │     │  Dialog + Start     │
│  Dashboard      │     │  in Banner           │     │  Impersonation      │
└─────────────────┘     └──────────────────────┘     └──────────┬──────────┘
                                                                 │
                                                                 ▼
                                                     ┌─────────────────────┐
                                                     │  Navigate to User's │
                                                     │  Dashboard with     │
                                                     │  Impersonation      │
                                                     │  Banner Active      │
                                                     └─────────────────────┘
```

---

## Files to Create/Modify

### New Files
1. `src/contexts/ImpersonationContext.tsx` - Core impersonation state management
2. `src/components/super-admin/ImpersonationBanner.tsx` - Visual indicator component
3. `supabase/functions/log-impersonation/index.ts` - Audit logging edge function
4. `src/hooks/useImpersonation.tsx` - Convenience hook for accessing context

### Modified Files
1. `src/components/super-admin/SuperAdminClientSupport.tsx` - Wire up actual impersonation
2. `src/components/BuyerDashboard.tsx` - Add impersonation context support
3. `src/components/SupplierDashboard.tsx` - Add impersonation context support
4. `src/components/dashboard/DynamicDashboard.tsx` - Route to correct dashboard during impersonation
5. `src/App.tsx` - Wrap app with ImpersonationProvider
6. `src/hooks/useCompanySetup.tsx` - Use impersonated company when active
7. `src/hooks/useUserContexts.tsx` - Support impersonation override
8. `src/components/buyer/BuyerSidebarLayout.tsx` - Show impersonation banner
9. `src/components/supplier/SupplierSidebarLayout.tsx` - Show impersonation banner

### Database Migrations
1. Create `impersonation_logs` table
2. Add RLS policies for super admin data access during impersonation

---

## Security Audit Points

1. **Logging**: Every impersonation session is logged with start/end times
2. **Visual Indication**: Cannot accidentally perform actions thinking you're logged in as yourself
3. **Read-Heavy**: Impersonation should primarily be for viewing, with warnings on write operations
4. **Session Isolation**: Impersonation state is stored in React context, not local storage (clears on page refresh)
5. **Time Limits**: Optional auto-expiration after 30 minutes of impersonation

