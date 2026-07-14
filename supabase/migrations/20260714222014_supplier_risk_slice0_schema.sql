-- ============================================================================
-- Supplier Risk — Slice 0: schema + RLS + feature flag
-- See docs/supplier-risk-integration-plan.md
--
-- Adds an ADAPTIVE EXTERNAL supplier-risk subsystem that complements (never
-- touches) the existing compliance risk in supplier_performance_metrics.
-- Buyer-agnostic events + provenance are shared knowledge; policies and score
-- snapshots are per-buyer and RLS-scoped with the app's existing helpers.
--
-- Vocabularies use text + CHECK (not pg enums) so the connector taxonomy can
-- evolve without enum ALTERs. Scores are NEVER computed by an LLM and NEVER
-- stored on events — only in supplier_risk_scores (append-only).
-- Nothing here runs on ingest yet; connectors/scoring arrive in later slices.
-- ============================================================================

-- Shared updated_at trigger for this subsystem (self-contained).
CREATE OR REPLACE FUNCTION public.supplier_risk_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. risk_source_records — provenance for every ingested signal (append-only)
-- ----------------------------------------------------------------------------
CREATE TABLE public.risk_source_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type        text NOT NULL,                       -- 'ofac_sdn','cpsc_recall','uflpa',...
  source_url         text,
  connector          text NOT NULL,                       -- connector name
  connector_version  text NOT NULL DEFAULT 'v1',
  content_sha256     text,
  retrieved_at       timestamptz NOT NULL DEFAULT now(),
  raw_payload        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- verbatim fetched record
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_risk_source_records_source_type ON public.risk_source_records (source_type);
CREATE INDEX idx_risk_source_records_sha256 ON public.risk_source_records (content_sha256);

-- ----------------------------------------------------------------------------
-- 2. risk_entities — ownership graph nodes (parents, co-packers, facilities…)
-- ----------------------------------------------------------------------------
CREATE TABLE public.risk_entities (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type           text NOT NULL CHECK (entity_type IN (
                          'supplier','parent_company','subsidiary','co_packer',
                          'beneficial_owner','facility')),
  canonical_name        text NOT NULL,
  country               text,
  registration_number   text,
  lei                   text,
  domain                text,
  -- When this node IS a known app supplier, link it.
  supplier_id           uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  -- Merge pointer for entity resolution (points at the surviving canonical node).
  canonical_entity_id   uuid REFERENCES public.risk_entities(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_risk_entities_supplier ON public.risk_entities (supplier_id);
CREATE INDEX idx_risk_entities_name ON public.risk_entities (canonical_name);
CREATE INDEX idx_risk_entities_regnum ON public.risk_entities (registration_number);
CREATE TRIGGER trg_risk_entities_updated_at
  BEFORE UPDATE ON public.risk_entities
  FOR EACH ROW EXECUTE FUNCTION public.supplier_risk_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 3. risk_entity_edges — graph edges, each with provenance (verified|inferred)
-- ----------------------------------------------------------------------------
CREATE TABLE public.risk_entity_edges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_type         text NOT NULL CHECK (edge_type IN (
                      'owns','operates','manufactures_for','supplies',
                      'shares_address_with','uses_material','ships_through',
                      'located_in','co_packs_for')),
  source_entity_id  uuid NOT NULL REFERENCES public.risk_entities(id) ON DELETE CASCADE,
  target_entity_id  uuid NOT NULL REFERENCES public.risk_entities(id) ON DELETE CASCADE,
  source            text NOT NULL,                         -- provenance
  source_url        text,
  confidence        numeric NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  verification      text NOT NULL DEFAULT 'ai_inferred' CHECK (verification IN ('verified','ai_inferred')),
  discovered_at     date NOT NULL DEFAULT current_date,
  last_verified_at  date,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_risk_entity_edges_source ON public.risk_entity_edges (source_entity_id);
CREATE INDEX idx_risk_entity_edges_target ON public.risk_entity_edges (target_entity_id);

-- ----------------------------------------------------------------------------
-- 4. supplier_risk_events — buyer-AGNOSTIC structured events (no score here)
-- ----------------------------------------------------------------------------
CREATE TABLE public.supplier_risk_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id              uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  risk_entity_id           uuid REFERENCES public.risk_entities(id) ON DELETE SET NULL,
  facility_entity_id       uuid REFERENCES public.risk_entities(id) ON DELETE SET NULL,
  event_type               text NOT NULL,                  -- 'sanction_match','product_recall',...
  dimension                text NOT NULL CHECK (dimension IN (
                             'regulatory','product_safety','labor_esg','geopolitical',
                             'operational','financial','legal','cyber')),
  severity                 numeric NOT NULL CHECK (severity >= 0 AND severity <= 1),
  entity_match_confidence  numeric NOT NULL DEFAULT 0 CHECK (entity_match_confidence >= 0 AND entity_match_confidence <= 1),
  source_confidence        numeric NOT NULL DEFAULT 1 CHECK (source_confidence >= 0 AND source_confidence <= 1),
  industry_relevance       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status                   text NOT NULL DEFAULT 'open' CHECK (status IN (
                             'open','under_review','accepted','dismissed','remediated')),
  remediation_status       text NOT NULL DEFAULT 'open' CHECK (remediation_status IN (
                             'open','corrective_plan_filed','evidence_submitted','buyer_verified','closed_monitored')),
  evidence_status          text NOT NULL DEFAULT 'verified' CHECK (evidence_status IN (
                             'verified','ai_inferred','unconfirmed','disputed')),
  occurred_at              date,
  detected_at              timestamptz NOT NULL DEFAULT now(),
  source_record_id         uuid REFERENCES public.risk_source_records(id) ON DELETE SET NULL,
  event_key                text,                           -- idempotency / dedup key
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_risk_events_supplier ON public.supplier_risk_events (supplier_id);
CREATE INDEX idx_supplier_risk_events_entity ON public.supplier_risk_events (risk_entity_id);
CREATE UNIQUE INDEX uq_supplier_risk_events_event_key
  ON public.supplier_risk_events (event_key) WHERE event_key IS NOT NULL;
CREATE TRIGGER trg_supplier_risk_events_updated_at
  BEFORE UPDATE ON public.supplier_risk_events
  FOR EACH ROW EXECUTE FUNCTION public.supplier_risk_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5. buyer_risk_policies — per-buyer versioned weights & rules
-- ----------------------------------------------------------------------------
CREATE TABLE public.buyer_risk_policies (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id               uuid NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  policy_key             text NOT NULL DEFAULT 'default',
  version                integer NOT NULL DEFAULT 1,
  industry               text,
  dimensions             jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { dimension: weight }
  event_rules            jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { event_type: {applicability, min_severity} }
  critical_topics        text[] NOT NULL DEFAULT '{}',
  low_relevance_topics   text[] NOT NULL DEFAULT '{}',
  is_published           boolean NOT NULL DEFAULT false,
  created_by             uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, policy_key, version)
);
CREATE INDEX idx_buyer_risk_policies_buyer ON public.buyer_risk_policies (buyer_id);
CREATE TRIGGER trg_buyer_risk_policies_updated_at
  BEFORE UPDATE ON public.buyer_risk_policies
  FOR EACH ROW EXECUTE FUNCTION public.supplier_risk_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 6. supplier_risk_scores — append-only snapshots per buyer × supplier
-- ----------------------------------------------------------------------------
CREATE TABLE public.supplier_risk_scores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id          uuid NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  supplier_id       uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  overall_score     numeric NOT NULL,
  dimension_scores  jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_version    integer,
  engine_version    text NOT NULL DEFAULT 'v1',
  input_event_ids   uuid[] NOT NULL DEFAULT '{}',
  previous_score    numeric,
  change_reasons    jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_at     timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_risk_scores_lookup
  ON public.supplier_risk_scores (buyer_id, supplier_id, calculated_at DESC);

-- ----------------------------------------------------------------------------
-- 7. supplier_risk_feedback — analyst labels
-- ----------------------------------------------------------------------------
CREATE TABLE public.supplier_risk_feedback (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id       uuid NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  risk_event_id  uuid REFERENCES public.supplier_risk_events(id) ON DELETE CASCADE,
  feedback_type  text NOT NULL CHECK (feedback_type IN (
                   'relevant','not_relevant','false_entity_match','escalated',
                   'remediated','disruption_occurred')),
  note           text,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_risk_feedback_buyer ON public.supplier_risk_feedback (buyer_id);

-- ============================================================================
-- Grants + Row-Level Security
-- Writes to shared-knowledge tables (source records, entities, events, scores)
-- are service_role only (ingestion / deterministic engine). Buyers read via the
-- existing tenancy helpers; suppliers may read their own events.
-- ============================================================================

-- risk_source_records: admin/service_role only (raw provenance)
GRANT SELECT ON public.risk_source_records TO authenticated;
GRANT ALL ON public.risk_source_records TO service_role;
ALTER TABLE public.risk_source_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read risk source records" ON public.risk_source_records
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- risk_entities / risk_entity_edges: admin read for now; scoped graph RPC lands in Slice 5
GRANT SELECT ON public.risk_entities TO authenticated;
GRANT ALL ON public.risk_entities TO service_role;
ALTER TABLE public.risk_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read risk entities" ON public.risk_entities
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.risk_entity_edges TO authenticated;
GRANT ALL ON public.risk_entity_edges TO service_role;
ALTER TABLE public.risk_entity_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read risk entity edges" ON public.risk_entity_edges
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- supplier_risk_events: connected buyers + the supplier itself + admins can read
GRANT SELECT ON public.supplier_risk_events TO authenticated;
GRANT ALL ON public.supplier_risk_events TO service_role;
ALTER TABLE public.supplier_risk_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read risk events for connected suppliers" ON public.supplier_risk_events
  FOR SELECT TO authenticated USING (
    supplier_id IN (SELECT public.get_connected_supplier_ids_for_buyer())
    OR supplier_id = public.get_user_supplier_id()
    OR public.is_admin(auth.uid())
  );

-- buyer_risk_policies: a buyer manages its own policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_risk_policies TO authenticated;
GRANT ALL ON public.buyer_risk_policies TO service_role;
ALTER TABLE public.buyer_risk_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers read own risk policies" ON public.buyer_risk_policies
  FOR SELECT TO authenticated USING (
    buyer_id IN (SELECT public.get_user_buyer_ids()) OR public.is_admin(auth.uid())
  );
CREATE POLICY "Buyers insert own risk policies" ON public.buyer_risk_policies
  FOR INSERT TO authenticated WITH CHECK (
    buyer_id IN (SELECT public.get_user_buyer_ids())
  );
CREATE POLICY "Buyers update own risk policies" ON public.buyer_risk_policies
  FOR UPDATE TO authenticated
  USING (buyer_id IN (SELECT public.get_user_buyer_ids()))
  WITH CHECK (buyer_id IN (SELECT public.get_user_buyer_ids()));
CREATE POLICY "Buyers delete own risk policies" ON public.buyer_risk_policies
  FOR DELETE TO authenticated USING (buyer_id IN (SELECT public.get_user_buyer_ids()));

-- supplier_risk_scores: buyers read their own; engine (service_role) writes
GRANT SELECT ON public.supplier_risk_scores TO authenticated;
GRANT ALL ON public.supplier_risk_scores TO service_role;
ALTER TABLE public.supplier_risk_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers read own supplier risk scores" ON public.supplier_risk_scores
  FOR SELECT TO authenticated USING (
    buyer_id IN (SELECT public.get_user_buyer_ids()) OR public.is_admin(auth.uid())
  );

-- supplier_risk_feedback: a buyer reads/writes its own feedback
GRANT SELECT, INSERT ON public.supplier_risk_feedback TO authenticated;
GRANT ALL ON public.supplier_risk_feedback TO service_role;
ALTER TABLE public.supplier_risk_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers read own risk feedback" ON public.supplier_risk_feedback
  FOR SELECT TO authenticated USING (
    buyer_id IN (SELECT public.get_user_buyer_ids()) OR public.is_admin(auth.uid())
  );
CREATE POLICY "Buyers insert own risk feedback" ON public.supplier_risk_feedback
  FOR INSERT TO authenticated WITH CHECK (
    buyer_id IN (SELECT public.get_user_buyer_ids())
  );

-- ============================================================================
-- Feature flag (off by default; the whole subsystem gates on this)
-- ============================================================================
INSERT INTO public.feature_flags (key, description, default_enabled, lifecycle)
VALUES (
  'supplier_risk',
  'Adaptive external supplier-risk intelligence (sanctions/recalls/ESG/geo), complementary to compliance risk',
  false,
  'development'
)
ON CONFLICT (key) DO NOTHING;
