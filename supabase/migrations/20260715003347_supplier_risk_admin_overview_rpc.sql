-- Platform-wide supplier-risk overview for the super-admin page: ALL suppliers
-- (regardless of buyer connection), summarized from buyer-agnostic events.
CREATE OR REPLACE FUNCTION public.get_all_suppliers_risk_overview()
RETURNS TABLE(
  supplier_id uuid, company_name text, country text, industry text,
  active_events integer, review_events integer, max_severity numeric,
  dimensions text[], latest_event_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (public.is_super_admin(auth.uid()) OR public.is_platform_admin(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
  SELECT s.id, s.company_name, s.country, s.industry,
    count(*) FILTER (WHERE e.status IN ('open','accepted'))::integer,
    count(*) FILTER (WHERE e.status = 'under_review')::integer,
    COALESCE(max(e.severity) FILTER (WHERE e.status IN ('open','accepted','under_review')), 0),
    COALESCE(array_agg(DISTINCT e.dimension) FILTER (WHERE e.dimension IS NOT NULL AND e.status IN ('open','accepted','under_review')), ARRAY[]::text[]),
    max(e.detected_at)
  FROM suppliers s
  LEFT JOIN supplier_risk_events e ON e.supplier_id = s.id
  GROUP BY s.id, s.company_name, s.country, s.industry
  ORDER BY COALESCE(max(e.severity) FILTER (WHERE e.status IN ('open','accepted','under_review')), 0) DESC, s.company_name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_all_suppliers_risk_overview() TO authenticated, service_role;
