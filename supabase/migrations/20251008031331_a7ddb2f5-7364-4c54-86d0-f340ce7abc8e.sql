-- Phase 1: Database Schema Changes for Stage 5-7 Features

-- 1.1 Create supplier_performance_metrics table (Requirements #2, #11)
CREATE TABLE IF NOT EXISTS supplier_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  
  -- Performance Metrics
  compliance_score NUMERIC(5,2) NOT NULL,
  response_time_avg NUMERIC(10,2), -- hours
  on_time_submission_rate NUMERIC(5,2),
  document_quality_score NUMERIC(5,2),
  
  -- Risk Assessment (Requirement #11)
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_factors JSONB DEFAULT '[]'::jsonb,
  auto_calculated_risk TEXT,
  manual_risk_override TEXT,
  risk_override_reason TEXT,
  risk_override_by UUID REFERENCES auth.users(id),
  risk_override_at TIMESTAMPTZ,
  
  -- Trend Data
  trend_direction TEXT CHECK (trend_direction IN ('improving', 'stable', 'declining')),
  previous_compliance_score NUMERIC(5,2),
  
  -- Metrics Breakdown
  total_requests INTEGER DEFAULT 0,
  approved_requests INTEGER DEFAULT 0,
  pending_requests INTEGER DEFAULT 0,
  rejected_requests INTEGER DEFAULT 0,
  overdue_requests INTEGER DEFAULT 0,
  expired_documents INTEGER DEFAULT 0,
  
  -- Timestamps
  metric_period_start DATE NOT NULL,
  metric_period_end DATE NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(supplier_id, buyer_id, metric_period_start, metric_period_end)
);

CREATE INDEX IF NOT EXISTS idx_supplier_performance_supplier ON supplier_performance_metrics(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_performance_buyer ON supplier_performance_metrics(buyer_id);
CREATE INDEX IF NOT EXISTS idx_supplier_performance_risk ON supplier_performance_metrics(risk_level);
CREATE INDEX IF NOT EXISTS idx_supplier_performance_period ON supplier_performance_metrics(metric_period_start, metric_period_end);

-- 1.2 Add Item-Facility Linking (Requirement #3)
ALTER TABLE supplier_items
  ADD COLUMN IF NOT EXISTS facility_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS primary_facility_id UUID REFERENCES company_branches(id),
  ADD COLUMN IF NOT EXISTS production_details JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS item_facility_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES supplier_items(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES company_branches(id) ON DELETE CASCADE,
  is_primary_producer BOOLEAN DEFAULT false,
  production_capacity INTEGER,
  lead_time_days INTEGER,
  certifications JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, facility_id)
);

CREATE INDEX IF NOT EXISTS idx_item_facility_item ON item_facility_mappings(item_id);
CREATE INDEX IF NOT EXISTS idx_item_facility_facility ON item_facility_mappings(facility_id);

-- 1.3 Create document_assignments table (Requirement #13)
CREATE TABLE IF NOT EXISTS document_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_upload_id UUID NOT NULL REFERENCES document_uploads(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('review', 'approve', 'qa_check', 'final_sign_off')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'declined')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_assignment_user ON document_assignments(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_doc_assignment_document ON document_assignments(document_upload_id);

-- 1.4 RLS Policies

-- supplier_performance_metrics policies
ALTER TABLE supplier_performance_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers can view their supplier metrics" ON supplier_performance_metrics;
CREATE POLICY "Buyers can view their supplier metrics"
  ON supplier_performance_metrics FOR SELECT
  USING (buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS "System can manage performance metrics" ON supplier_performance_metrics;
CREATE POLICY "System can manage performance metrics"
  ON supplier_performance_metrics FOR ALL
  USING (true);

-- item_facility_mappings policies
ALTER TABLE item_facility_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suppliers can manage their item-facility mappings" ON item_facility_mappings;
CREATE POLICY "Suppliers can manage their item-facility mappings"
  ON item_facility_mappings FOR ALL
  USING (item_id IN (SELECT id FROM supplier_items WHERE supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())));

DROP POLICY IF EXISTS "Buyers can view connected supplier item-facility mappings" ON item_facility_mappings;
CREATE POLICY "Buyers can view connected supplier item-facility mappings"
  ON item_facility_mappings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM supplier_items si
    JOIN buyer_supplier_connections bsc ON bsc.supplier_id = si.supplier_id
    JOIN buyers b ON b.id = bsc.buyer_id
    WHERE si.id = item_facility_mappings.item_id
      AND b.profile_id = auth.uid()
      AND bsc.status = 'approved'
  ));

-- document_assignments policies
ALTER TABLE document_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their assignments" ON document_assignments;
CREATE POLICY "Users can view their assignments"
  ON document_assignments FOR SELECT
  USING (assigned_to = auth.uid() OR assigned_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their assignments" ON document_assignments;
CREATE POLICY "Users can update their assignments"
  ON document_assignments FOR UPDATE
  USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Admins can create assignments" ON document_assignments;
CREATE POLICY "Admins can create assignments"
  ON document_assignments FOR INSERT
  WITH CHECK (
    assigned_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.profile_id = auth.uid()
        AND cu.role IN ('company_admin', 'branch_manager')
        AND cu.status = 'active'
    )
  );