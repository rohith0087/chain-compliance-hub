-- Slice 5: scoped graph RPC. Assembles a supplier's risk network (the supplier,
-- its active risk events, provenance sources, and any ownership edges) as
-- {nodes, edges}. SECURITY DEFINER + scoped to connected buyers / the supplier / admin.
CREATE OR REPLACE FUNCTION public.get_supplier_risk_graph(p_supplier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text;
  v_nodes jsonb;
  v_edges jsonb;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (
       p_supplier_id IN (SELECT public.get_connected_supplier_ids_for_buyer())
       OR p_supplier_id = public.get_user_supplier_id()
       OR public.is_admin(auth.uid())
     ) THEN
    RAISE EXCEPTION 'not authorized for supplier %', p_supplier_id;
  END IF;

  SELECT id, company_name INTO v_id, v_name FROM suppliers WHERE id = p_supplier_id;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('nodes', '[]'::jsonb, 'edges', '[]'::jsonb);
  END IF;

  WITH ev AS (
    SELECT e.id, e.event_type, e.dimension, e.severity, e.status, e.source_record_id
    FROM supplier_risk_events e
    WHERE e.supplier_id = p_supplier_id
      AND e.status IN ('open','accepted','under_review','remediated')
  ),
  src AS (
    SELECT DISTINCT r.id, r.connector
    FROM risk_source_records r JOIN ev ON ev.source_record_id = r.id
  ),
  own AS (
    SELECT ed.edge_type, ed.verification, ed.target_entity_id, te.canonical_name AS target_name
    FROM risk_entities se
    JOIN risk_entity_edges ed ON ed.source_entity_id = se.id
    JOIN risk_entities te ON te.id = ed.target_entity_id
    WHERE se.supplier_id = p_supplier_id
  )
  SELECT
    jsonb_build_array(jsonb_build_object('id','supplier:'||v_id,'label',v_name,'type','supplier'))
      || COALESCE((SELECT jsonb_agg(jsonb_build_object('id','event:'||id,'label',replace(event_type,'_',' '),'type','event','dimension',dimension,'severity',severity,'status',status)) FROM ev), '[]'::jsonb)
      || COALESCE((SELECT jsonb_agg(jsonb_build_object('id','source:'||id,'label',connector,'type','source')) FROM src), '[]'::jsonb)
      || COALESCE((SELECT jsonb_agg(jsonb_build_object('id','entity:'||target_entity_id,'label',target_name,'type','entity')) FROM own), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('source','supplier:'||v_id,'target','event:'||id,'type','subject_of','verified',true)) FROM ev), '[]'::jsonb)
      || COALESCE((SELECT jsonb_agg(jsonb_build_object('source','event:'||id,'target','source:'||source_record_id,'type','evidenced_by','verified',true)) FROM ev WHERE source_record_id IS NOT NULL), '[]'::jsonb)
      || COALESCE((SELECT jsonb_agg(jsonb_build_object('source','supplier:'||v_id,'target','entity:'||target_entity_id,'type',edge_type,'verified',(verification='verified'))) FROM own), '[]'::jsonb)
  INTO v_nodes, v_edges;

  RETURN jsonb_build_object('nodes', v_nodes, 'edges', v_edges);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_risk_graph(uuid) TO authenticated, service_role;
