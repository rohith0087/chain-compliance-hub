
-- COA Specifications: Buyer-defined acceptable limits for analytes
CREATE TABLE public.coa_specifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  analyte_name TEXT NOT NULL,
  analyte_code TEXT NOT NULL,
  category TEXT NOT NULL,
  spec_min NUMERIC,
  spec_max NUMERIC,
  unit TEXT NOT NULL,
  method TEXT,
  acceptable_methods TEXT[] DEFAULT '{}',
  action_on_exceed TEXT NOT NULL DEFAULT 'flag',
  basis TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coa_specifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can manage own specs" ON public.coa_specifications
  FOR ALL USING (
    buyer_id IN (
      SELECT company_id FROM public.company_users
      WHERE profile_id = auth.uid() AND company_type = 'buyer' AND status = 'active'
    )
    OR buyer_id IN (
      SELECT id FROM public.buyers WHERE profile_id = auth.uid()
    )
  );

-- COA Schedules: Recurring schedule for COA submissions
CREATE TABLE public.coa_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  custom_interval_days INT,
  next_due_date DATE NOT NULL,
  last_submitted_date DATE,
  grace_period_days INT NOT NULL DEFAULT 3,
  auto_remind BOOLEAN NOT NULL DEFAULT true,
  reminder_days_before INT[] DEFAULT '{7,3,1}',
  status TEXT NOT NULL DEFAULT 'active',
  product_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coa_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can manage own schedules" ON public.coa_schedules
  FOR ALL USING (
    buyer_id IN (
      SELECT company_id FROM public.company_users
      WHERE profile_id = auth.uid() AND company_type = 'buyer' AND status = 'active'
    )
    OR buyer_id IN (
      SELECT id FROM public.buyers WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Suppliers can view own schedules" ON public.coa_schedules
  FOR SELECT USING (
    supplier_id IN (
      SELECT company_id FROM public.company_users
      WHERE profile_id = auth.uid() AND company_type = 'supplier' AND status = 'active'
    )
    OR supplier_id IN (
      SELECT id FROM public.suppliers WHERE profile_id = auth.uid()
    )
  );

-- COA Submissions: Each COA submission linked to document_uploads
CREATE TABLE public.coa_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES public.coa_schedules(id) ON DELETE SET NULL,
  buyer_id UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  document_upload_id UUID REFERENCES public.document_uploads(id) ON DELETE SET NULL,
  lot_number TEXT,
  product_name TEXT,
  submission_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  overall_score NUMERIC,
  pass_fail TEXT,
  flags_count INT NOT NULL DEFAULT 0,
  raw_extracted_data JSONB,
  normalized_data JSONB,
  comparison_results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coa_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can manage own submissions" ON public.coa_submissions
  FOR ALL USING (
    buyer_id IN (
      SELECT company_id FROM public.company_users
      WHERE profile_id = auth.uid() AND company_type = 'buyer' AND status = 'active'
    )
    OR buyer_id IN (
      SELECT id FROM public.buyers WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Suppliers can view own submissions" ON public.coa_submissions
  FOR SELECT USING (
    supplier_id IN (
      SELECT company_id FROM public.company_users
      WHERE profile_id = auth.uid() AND company_type = 'supplier' AND status = 'active'
    )
    OR supplier_id IN (
      SELECT id FROM public.suppliers WHERE profile_id = auth.uid()
    )
  );

-- COA Analyte Results: Per-analyte detail for each submission
CREATE TABLE public.coa_analyte_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.coa_submissions(id) ON DELETE CASCADE,
  analyte_name TEXT NOT NULL,
  analyte_code TEXT NOT NULL,
  raw_value TEXT NOT NULL,
  numeric_value NUMERIC,
  is_censored BOOLEAN NOT NULL DEFAULT false,
  censored_type TEXT,
  censored_threshold NUMERIC,
  raw_unit TEXT NOT NULL,
  normalized_unit TEXT NOT NULL,
  raw_method TEXT,
  normalized_method TEXT,
  basis TEXT,
  spec_min NUMERIC,
  spec_max NUMERIC,
  status TEXT NOT NULL DEFAULT 'unknown',
  flag_reason TEXT,
  confidence TEXT NOT NULL DEFAULT 'high',
  conversion_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coa_analyte_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can manage own analyte results" ON public.coa_analyte_results
  FOR ALL USING (
    submission_id IN (
      SELECT id FROM public.coa_submissions WHERE buyer_id IN (
        SELECT company_id FROM public.company_users
        WHERE profile_id = auth.uid() AND company_type = 'buyer' AND status = 'active'
      )
      OR buyer_id IN (
        SELECT id FROM public.buyers WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "Suppliers can view own analyte results" ON public.coa_analyte_results
  FOR SELECT USING (
    submission_id IN (
      SELECT id FROM public.coa_submissions WHERE supplier_id IN (
        SELECT company_id FROM public.company_users
        WHERE profile_id = auth.uid() AND company_type = 'supplier' AND status = 'active'
      )
      OR supplier_id IN (
        SELECT id FROM public.suppliers WHERE profile_id = auth.uid()
      )
    )
  );

-- COA Method Equivalencies: User-defined method equivalency rules
CREATE TABLE public.coa_method_equivalencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  analyte_code TEXT NOT NULL,
  method_a TEXT NOT NULL,
  method_b TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  authority TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coa_method_equivalencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can manage own method equivalencies" ON public.coa_method_equivalencies
  FOR ALL USING (
    buyer_id IN (
      SELECT company_id FROM public.company_users
      WHERE profile_id = auth.uid() AND company_type = 'buyer' AND status = 'active'
    )
    OR buyer_id IN (
      SELECT id FROM public.buyers WHERE profile_id = auth.uid()
    )
  );

-- COA Policy Settings: Per-buyer policy toggles
CREATE TABLE public.coa_policy_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL UNIQUE REFERENCES public.buyers(id) ON DELETE CASCADE,
  within_spec_is_match BOOLEAN NOT NULL DEFAULT true,
  censored_equivalent_is_match BOOLEAN NOT NULL DEFAULT true,
  require_basis_conversion BOOLEAN NOT NULL DEFAULT false,
  flag_non_convertible_units BOOLEAN NOT NULL DEFAULT true,
  auto_flag_unknown_analytes BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coa_policy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can manage own policy settings" ON public.coa_policy_settings
  FOR ALL USING (
    buyer_id IN (
      SELECT company_id FROM public.company_users
      WHERE profile_id = auth.uid() AND company_type = 'buyer' AND status = 'active'
    )
    OR buyer_id IN (
      SELECT id FROM public.buyers WHERE profile_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_coa_specifications_buyer ON public.coa_specifications(buyer_id);
CREATE INDEX idx_coa_specifications_supplier ON public.coa_specifications(supplier_id);
CREATE INDEX idx_coa_schedules_buyer ON public.coa_schedules(buyer_id);
CREATE INDEX idx_coa_schedules_supplier ON public.coa_schedules(supplier_id);
CREATE INDEX idx_coa_schedules_next_due ON public.coa_schedules(next_due_date);
CREATE INDEX idx_coa_submissions_buyer ON public.coa_submissions(buyer_id);
CREATE INDEX idx_coa_submissions_supplier ON public.coa_submissions(supplier_id);
CREATE INDEX idx_coa_submissions_schedule ON public.coa_submissions(schedule_id);
CREATE INDEX idx_coa_analyte_results_submission ON public.coa_analyte_results(submission_id);
CREATE INDEX idx_coa_method_equivalencies_buyer ON public.coa_method_equivalencies(buyer_id);

-- Updated_at triggers
CREATE TRIGGER update_coa_specifications_updated_at BEFORE UPDATE ON public.coa_specifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coa_schedules_updated_at BEFORE UPDATE ON public.coa_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coa_submissions_updated_at BEFORE UPDATE ON public.coa_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coa_policy_settings_updated_at BEFORE UPDATE ON public.coa_policy_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
