-- Supplier Risk — Slice 3: deterministic scoring engine (NO LLM), reproducible + versioned.
-- Computes a buyer x supplier score from the buyer's published policy and the
-- supplier's active risk events, writing an append-only supplier_risk_scores snapshot.
--
-- Per-event impact:
--   severity x source_confidence x entity_match_confidence
--     x applicability (policy event_rules, default 1.0)
--     x recency_decay (exp(-rate x age_years), rate per dimension)
--     x status_factor x remediation_factor
-- Dimension score = probabilistic OR of its events' impacts, x100.
-- Overall = policy-weighted average across all 8 dimensions (equal weights if no policy).
CREATE OR REPLACE FUNCTION public.calculate_supplier_risk_score(
  p_buyer_id uuid,
  p_supplier_id uuid
) RETURNS public.supplier_risk_scores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_engine_version text := 'v1';
  v_weights   jsonb;
  v_rules     jsonb;
  v_policy_version integer;
  v_dim_scores jsonb;
  v_reasons    jsonb;
  v_input_ids  uuid[];
  v_overall    numeric := 0;
  v_wsum       numeric := 0;
  v_prev       numeric;
  v_result     public.supplier_risk_scores;
  d text;
  w numeric;
  s numeric;
  v_dims text[] := ARRAY['regulatory','product_safety','labor_esg','geopolitical','operational','financial','legal','cyber'];
BEGIN
  -- Authorize: the buyer's own user, an admin, or a system/service call (no auth.uid()).
  IF auth.uid() IS NOT NULL
     AND NOT (p_buyer_id IN (SELECT public.get_user_buyer_ids()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized for buyer %', p_buyer_id;
  END IF;

  SELECT dimensions, event_rules, version
    INTO v_weights, v_rules, v_policy_version
  FROM buyer_risk_policies
  WHERE buyer_id = p_buyer_id AND is_published
  ORDER BY version DESC LIMIT 1;
  v_weights := COALESCE(v_weights, '{}'::jsonb);
  v_rules   := COALESCE(v_rules, '{}'::jsonb);

  WITH active_events AS (
    SELECT e.id, e.dimension,
      LEAST(0.999, GREATEST(0,
        e.severity * e.source_confidence * e.entity_match_confidence
        * COALESCE((v_rules -> e.event_type ->> 'applicability')::numeric, 1.0)
        * exp( -(CASE e.dimension
                   WHEN 'regulatory' THEN 0.05 WHEN 'labor_esg' THEN 0.10
                   WHEN 'product_safety' THEN 0.20 WHEN 'operational' THEN 0.30
                   WHEN 'financial' THEN 0.30 WHEN 'geopolitical' THEN 0.50
                   WHEN 'legal' THEN 0.60 WHEN 'cyber' THEN 0.40 ELSE 0.30 END)
               * GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(e.occurred_at::timestamptz, e.detected_at))) / 31557600.0) )
        * (CASE e.status WHEN 'open' THEN 1.0 WHEN 'accepted' THEN 1.0
                         WHEN 'under_review' THEN 0.5 WHEN 'remediated' THEN 0.3 ELSE 0 END)
        * (CASE e.remediation_status WHEN 'open' THEN 1.0 WHEN 'corrective_plan_filed' THEN 0.8
                         WHEN 'evidence_submitted' THEN 0.6 WHEN 'buyer_verified' THEN 0.3
                         WHEN 'closed_monitored' THEN 0.1 ELSE 1.0 END)
      )) AS impact
    FROM supplier_risk_events e
    WHERE e.supplier_id = p_supplier_id
      AND e.status IN ('open','accepted','under_review','remediated')
  ),
  dim_agg AS (
    SELECT dimension,
           round((1 - exp(sum(ln(1 - impact)))) * 100) AS dim_score,
           count(*) AS n
    FROM active_events WHERE impact > 0
    GROUP BY dimension
  )
  SELECT
    COALESCE(jsonb_object_agg(dimension, dim_score), '{}'::jsonb),
    COALESCE(jsonb_agg(jsonb_build_object('dimension', dimension, 'score', dim_score, 'events', n) ORDER BY dim_score DESC), '[]'::jsonb)
  INTO v_dim_scores, v_reasons
  FROM dim_agg;

  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_input_ids
  FROM supplier_risk_events
  WHERE supplier_id = p_supplier_id
    AND status IN ('open','accepted','under_review','remediated');

  FOREACH d IN ARRAY v_dims LOOP
    w := COALESCE((v_weights ->> d)::numeric, 0);
    s := COALESCE((v_dim_scores ->> d)::numeric, 0);
    v_overall := v_overall + w * s;
    v_wsum := v_wsum + w;
  END LOOP;
  IF v_wsum > 0 THEN
    v_overall := round(v_overall / v_wsum);
  ELSE
    SELECT round(COALESCE(avg(value::numeric), 0)) INTO v_overall
    FROM jsonb_each_text(v_dim_scores);
  END IF;

  SELECT overall_score INTO v_prev
  FROM supplier_risk_scores
  WHERE buyer_id = p_buyer_id AND supplier_id = p_supplier_id
  ORDER BY calculated_at DESC LIMIT 1;

  INSERT INTO supplier_risk_scores
    (buyer_id, supplier_id, overall_score, dimension_scores, policy_version,
     engine_version, input_event_ids, previous_score, change_reasons)
  VALUES
    (p_buyer_id, p_supplier_id, v_overall, v_dim_scores, v_policy_version,
     v_engine_version, v_input_ids, v_prev, v_reasons)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_supplier_risk_score(uuid, uuid) TO authenticated, service_role;
