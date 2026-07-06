-- Consolidation #4: when a framework version is published, auto-register the
-- document types its requirements reference into document_type_definitions.
-- Without this, private.normalize_document_type_code() silently falls back to
-- 'generic_evidence' for unregistered types and the canonical matcher can
-- never match them to requirements (the empty-Mapping-Review bug). Making it a
-- trigger means the class of bug cannot recur for future frameworks.

create or replace function private.register_framework_evidence_doc_types()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    insert into public.document_type_definitions
      (code, name, category, aliases, required_fields, validation_rules, active_schema_version, is_active)
    select distinct on (dt.code)
      dt.code,
      -- human name from the evidence definition, else a title-cased code
      coalesce(nullif(dt.name, ''), initcap(replace(dt.code, '_', ' '))),
      'framework_evidence',
      -- alias on the evidence display name so loose lookups still resolve
      case when nullif(dt.name, '') is not null then array[lower(dt.name)] else '{}'::text[] end,
      '{}',
      '[]'::jsonb,
      1,
      true
    from public.requirement_versions rv
    cross join lateral jsonb_array_elements(rv.required_evidence) as ev(item)
    cross join lateral (
      select ev.item->>'document_type' as code, ev.item->>'name' as name
    ) dt
    where rv.framework_version_id = new.id
      and dt.code is not null
      and not exists (select 1 from public.document_type_definitions d where d.code = dt.code)
    on conflict (code) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists register_framework_evidence_doc_types on public.requirement_framework_versions;
create trigger register_framework_evidence_doc_types
  after insert or update of status on public.requirement_framework_versions
  for each row execute function private.register_framework_evidence_doc_types();
