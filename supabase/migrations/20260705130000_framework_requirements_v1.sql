-- Drill-down for the Frameworks page: given a framework code, return the
-- requirements defined in its currently-published version (title, description,
-- citation, which subjects it applies to, and the evidence it asks for). This is
-- what makes "click a framework -> see its requirements" work, so the Requirement
-- Engine is browsable, not just an applicability calculator. Catalog content is
-- global + paraphrased; any authenticated user in the app may read it.
create or replace function public.framework_requirements_v1(p_framework_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_framework_id uuid;
  v_version_id uuid;
  v_version text;
  v_effective_from date;
begin
  if auth.uid() is null and auth.role() <> 'service_role' then
    raise exception 'Authentication required';
  end if;

  select id into v_framework_id from public.requirement_frameworks where code = p_framework_code;
  if v_framework_id is null then
    return jsonb_build_object('framework_code', p_framework_code, 'published', false, 'requirements', '[]'::jsonb);
  end if;

  -- Latest published version for this framework.
  select id, version, effective_from
    into v_version_id, v_version, v_effective_from
  from public.requirement_framework_versions
  where framework_id = v_framework_id and status = 'published'
  order by effective_from desc, published_at desc nulls last
  limit 1;

  if v_version_id is null then
    return jsonb_build_object('framework_code', p_framework_code, 'published', false, 'requirements', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'framework_code', p_framework_code,
    'published', true,
    'version', v_version,
    'effective_from', v_effective_from,
    'requirements', coalesce((
      select jsonb_agg(row_to_json(r) order by r.stable_key) from (
        select req.stable_key,
               req.subject_types,
               rv.title,
               rv.description,
               rv.citation,
               rv.source_url,
               rv.effective_from,
               rv.effective_to,
               coalesce(jsonb_array_length(rv.required_evidence), 0) as evidence_count,
               rv.required_evidence
        from public.requirement_versions rv
        join public.requirements req on req.id = rv.requirement_id
        where rv.framework_version_id = v_version_id and req.framework_id = v_framework_id
      ) r), '[]'::jsonb)
  );
end;
$function$;

grant execute on function public.framework_requirements_v1(text) to authenticated;
