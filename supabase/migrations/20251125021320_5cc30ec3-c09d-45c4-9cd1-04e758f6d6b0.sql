-- Allow company users to view teammate profiles
-- This enables company admins to see names/emails in the Company Users list

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create new comprehensive policy that allows viewing own profile AND teammate profiles
CREATE POLICY "Users can view their own and teammate profiles"
ON profiles
FOR SELECT
USING (
  -- User can view their own profile
  auth.uid() = id
  OR
  -- User can view profiles of teammates in the same company
  id IN (
    SELECT DISTINCT cu2.profile_id
    FROM company_users cu1
    INNER JOIN company_users cu2 
      ON cu1.company_id = cu2.company_id 
      AND cu1.company_type = cu2.company_type
    WHERE cu1.profile_id = auth.uid()
      AND cu1.status = 'active'
  )
);