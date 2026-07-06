-- The verifier ordered rows by (occurred_at, id); rows written in the same
-- transaction share occurred_at and random UUIDs break ties arbitrarily, so
-- intact chains reported "prev_hash mismatch". A hash chain's authoritative
-- order is its own linkage: walk from the null-prev head following
-- row_hash -> prev_hash, detecting forks and breaks explicitly.
create or replace function public.verify_dossier_audit_chain_v1(p_dossier_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_total int;
  v_visited int := 0;
  v_prev text := null;
  v_row record;
  v_expected text;
begin
  select buyer_id into v_buyer_id from public.compliance_dossiers where id = p_dossier_id;
  if v_buyer_id is null then
    raise exception 'Dossier not found';
  end if;
  if not (auth.role() = 'service_role'
          or private.has_organization_access(v_actor_id, v_buyer_id, 'buyer')) then
    raise exception 'Buyer access required';
  end if;

  select count(*) into v_total from public.dossier_audit_log where dossier_id = p_dossier_id;

  while v_visited < v_total loop
    begin
      select * into strict v_row
      from public.dossier_audit_log
      where dossier_id = p_dossier_id
        and prev_hash is not distinct from v_prev;
    exception
      when no_data_found then
        return jsonb_build_object('valid', false, 'broken_at_row_id', null,
          'reason', 'chain break: no row continues the chain after position ' || v_visited);
      when too_many_rows then
        return jsonb_build_object('valid', false, 'broken_at_row_id', null,
          'reason', 'chain fork: multiple rows share the same prev_hash at position ' || v_visited);
    end;

    v_expected := private.compute_dossier_audit_row_hash(
      v_row.prev_hash, v_row.event_type, v_row.dossier_id, v_row.version_id,
      v_row.actor_id, v_row.occurred_at, v_row.metadata
    );
    if v_expected is distinct from v_row.row_hash then
      return jsonb_build_object('valid', false, 'broken_at_row_id', v_row.id, 'reason', 'row_hash mismatch');
    end if;

    v_prev := v_row.row_hash;
    v_visited := v_visited + 1;
  end loop;

  return jsonb_build_object('valid', true, 'broken_at_row_id', null, 'reason', null);
end;
$function$;
