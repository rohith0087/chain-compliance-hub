-- Create database function to check company role
-- Used for RLS policies and server-side authorization

CREATE OR REPLACE FUNCTION public.has_company_role(
  _user_id uuid,
  _company_id uuid,
  _company_type text,
  _required_role user_role
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM company_users cu
    WHERE cu.profile_id = _user_id
      AND cu.company_id = _company_id
      AND cu.company_type = _company_type
      AND cu.role = _required_role
      AND cu.status = 'active'
  );
END;
$$;

COMMENT ON FUNCTION public.has_company_role(uuid, uuid, text, user_role) IS 'Checks if a user has a specific role within a company. Used for RBAC enforcement in RLS policies and application logic. Returns true only if user has active status.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.has_company_role(uuid, uuid, text, user_role) TO authenticated;