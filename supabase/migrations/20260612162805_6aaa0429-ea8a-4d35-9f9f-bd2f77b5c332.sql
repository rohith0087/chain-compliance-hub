
CREATE TABLE public.audit_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'Minor' CHECK (severity IN ('Minor','Major','Critical')),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Closed')),
  finding_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_findings_buyer ON public.audit_findings(buyer_id);
CREATE INDEX idx_audit_findings_supplier ON public.audit_findings(supplier_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_findings TO authenticated;
GRANT ALL ON public.audit_findings TO service_role;

ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;

-- Buyer owner or active team member of the buyer can manage findings
CREATE POLICY "Buyer team can view audit findings"
ON public.audit_findings FOR SELECT
TO authenticated
USING (
  buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
  OR buyer_id IN (
    SELECT company_id FROM public.company_users
    WHERE profile_id = auth.uid()
      AND company_type = 'buyer'
      AND status = 'active'
  )
);

CREATE POLICY "Buyer team can insert audit findings"
ON public.audit_findings FOR INSERT
TO authenticated
WITH CHECK (
  buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
  OR buyer_id IN (
    SELECT company_id FROM public.company_users
    WHERE profile_id = auth.uid()
      AND company_type = 'buyer'
      AND status = 'active'
  )
);

CREATE POLICY "Buyer team can update audit findings"
ON public.audit_findings FOR UPDATE
TO authenticated
USING (
  buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
  OR buyer_id IN (
    SELECT company_id FROM public.company_users
    WHERE profile_id = auth.uid()
      AND company_type = 'buyer'
      AND status = 'active'
  )
);

CREATE POLICY "Buyer team can delete audit findings"
ON public.audit_findings FOR DELETE
TO authenticated
USING (
  buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
  OR buyer_id IN (
    SELECT company_id FROM public.company_users
    WHERE profile_id = auth.uid()
      AND company_type = 'buyer'
      AND status = 'active'
  )
);

CREATE TRIGGER update_audit_findings_updated_at
BEFORE UPDATE ON public.audit_findings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
