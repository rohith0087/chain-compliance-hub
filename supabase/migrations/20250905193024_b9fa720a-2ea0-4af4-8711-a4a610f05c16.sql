-- Ensure RLS is enabled and proper policies exist for company_branches to allow owners and admins to manage branches and users with access to view them

-- Enable RLS (idempotent)
ALTER TABLE public.company_branches ENABLE ROW LEVEL SECURITY;

-- Drop existing conflicting policies if they exist
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_branches' AND policyname = 'Company admins or owners can manage branches'
  ) THEN
    DROP POLICY "Company admins or owners can manage branches" ON public.company_branches;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_branches' AND policyname = 'Users can view company branches they have access to'
  ) THEN
    DROP POLICY "Users can view company branches they have access to" ON public.company_branches;
  END IF;
END $$;

-- Allow company admins (via user_has_permission) OR company owners (buyer/supplier profile owner) to manage branches
CREATE POLICY "Company admins or owners can manage branches"
ON public.company_branches
FOR ALL
USING (
  public.user_has_permission(auth.uid(), company_id, company_type, 'manage_branches'::permission_type)
  OR (company_type = 'buyer' AND EXISTS (SELECT 1 FROM buyers b WHERE b.id = company_id AND b.profile_id = auth.uid()))
  OR (company_type = 'supplier' AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = company_id AND s.profile_id = auth.uid()))
)
WITH CHECK (
  public.user_has_permission(auth.uid(), company_id, company_type, 'manage_branches'::permission_type)
  OR (company_type = 'buyer' AND EXISTS (SELECT 1 FROM buyers b WHERE b.id = company_id AND b.profile_id = auth.uid()))
  OR (company_type = 'supplier' AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = company_id AND s.profile_id = auth.uid()))
);

-- Allow users to view branches for companies they have access to (company users) or that they own
CREATE POLICY "Users can view company branches they have access to"
ON public.company_branches
FOR SELECT
USING (
  public.user_has_company_access(auth.uid(), company_id, company_type)
  OR (company_type = 'buyer' AND EXISTS (SELECT 1 FROM buyers b WHERE b.id = company_id AND b.profile_id = auth.uid()))
  OR (company_type = 'supplier' AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = company_id AND s.profile_id = auth.uid()))
);
