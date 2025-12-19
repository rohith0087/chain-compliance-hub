-- Fix RLS infinite recursion on user_roles table
-- This was causing login timeouts and storage health issues

-- Step 1: Drop ALL existing policies on user_roles that may cause recursion
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can manage own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage roles" ON user_roles;

-- Step 2: Create simple non-recursive SELECT policy
-- This uses auth.uid() directly without any function calls that query user_roles
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Step 3: Fix auth_audit_logs insert policy to allow logging during auth flow
DROP POLICY IF EXISTS "Users can insert own auth logs" ON auth_audit_logs;
DROP POLICY IF EXISTS "Anyone can insert auth logs" ON auth_audit_logs;

CREATE POLICY "Anyone can insert auth logs" ON auth_audit_logs
  FOR INSERT WITH CHECK (true);