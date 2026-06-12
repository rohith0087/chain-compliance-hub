
-- 1. Extend audit_findings
ALTER TABLE public.audit_findings
  ADD COLUMN IF NOT EXISTS engagement_id uuid REFERENCES public.document_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS framework text,
  ADD COLUMN IF NOT EXISTS clause_reference text,
  ADD COLUMN IF NOT EXISTS recommendation text,
  ADD COLUMN IF NOT EXISTS evidence_doc_ids uuid[] DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_audit_findings_engagement ON public.audit_findings(engagement_id);

-- 2. Audit engagement summaries cache
CREATE TABLE IF NOT EXISTS public.audit_engagement_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engagement_id uuid REFERENCES public.document_requests(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  auditor_user_id uuid,
  plan_md text,
  risk_matrix jsonb DEFAULT '[]'::jsonb,
  report_url text,
  report_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_engagement_summaries TO authenticated;
GRANT ALL ON public.audit_engagement_summaries TO service_role;

ALTER TABLE public.audit_engagement_summaries ENABLE ROW LEVEL SECURITY;

-- Helper: can current user act for buyer_id?
CREATE OR REPLACE FUNCTION public.user_can_act_for_buyer(_buyer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buyers b WHERE b.id = _buyer_id AND b.profile_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = _buyer_id
      AND cu.company_type = 'buyer'
      AND cu.profile_id = auth.uid()
      AND cu.status = 'active'
  );
$$;

CREATE POLICY "Auditors manage own engagement summaries"
  ON public.audit_engagement_summaries
  FOR ALL
  USING (public.user_can_act_for_buyer(buyer_id))
  WITH CHECK (public.user_can_act_for_buyer(buyer_id));

CREATE INDEX IF NOT EXISTS idx_aes_engagement ON public.audit_engagement_summaries(engagement_id);
CREATE INDEX IF NOT EXISTS idx_aes_buyer ON public.audit_engagement_summaries(buyer_id);

CREATE TRIGGER trg_aes_updated_at
  BEFORE UPDATE ON public.audit_engagement_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
