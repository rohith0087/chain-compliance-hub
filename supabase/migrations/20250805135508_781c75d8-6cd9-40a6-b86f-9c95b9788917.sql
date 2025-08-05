-- Step 1: Create new enum values for user_role (must be in separate transaction)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'company_admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'branch_manager';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'document_manager';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'viewer';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'approver';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'auditor';

-- Create permission type enum
CREATE TYPE public.permission_type AS ENUM (
  'read',
  'write', 
  'approve',
  'delete',
  'invite_users',
  'manage_branches',
  'export_data'
);