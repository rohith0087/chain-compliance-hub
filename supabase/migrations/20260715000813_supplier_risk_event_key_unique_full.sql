-- Fix: ON CONFLICT (event_key) — used by every connector's upsert — requires a
-- NON-partial unique index. The original partial index (WHERE event_key IS NOT
-- NULL) cannot back the upsert (Postgres 42P10). A full unique index still allows
-- multiple NULL event_keys (NULLS DISTINCT is the default).
DROP INDEX IF EXISTS public.uq_supplier_risk_events_event_key;
CREATE UNIQUE INDEX uq_supplier_risk_events_event_key
  ON public.supplier_risk_events (event_key);
