-- The evidence-mapping AI review now actually READS the document. Store what it
-- read (a short excerpt for transparency), whether it could read it, and the
-- structured findings it extracted (issuer, dates, scope, standards, etc.) so the
-- reviewer can see WHY it judged the evidence compliant or not.
alter table public.requirement_evidence_mappings
  add column if not exists ai_document_read boolean,
  add column if not exists ai_document_excerpt text,
  add column if not exists ai_findings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(ai_findings) = 'array');
